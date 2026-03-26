import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  attachErrorHandler,
  asyncHandler,
  createBaseApp,
  createPool,
  fetchJson,
  getNumberEnv,
  many,
  one,
  RedisBus,
  requireAuth,
  requireEnv,
  requireServiceDbUrl,
  requireRoles,
  runStatements,
  type Role
} from "../../../../packages/shared/src/index.js";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string;
  birthdate: string | null;
  sex: string | null;
  weight: number | null;
  microchip: string | null;
  allergies: string | null;
  primary_clinic_id: string;
  created_at: string;
};

const petSchema = z.object({
  name: z.string().min(2),
  species: z.string().min(2),
  breed: z.string().min(2),
  birthdate: z.string().optional(),
  sex: z.string().optional(),
  weight: z.coerce.number().positive().optional(),
  microchip: z.string().optional(),
  allergies: z.string().optional(),
  primaryClinicId: z.string().uuid(),
  relationType: z.string().default("OWNER")
});

const app = createBaseApp("pet-service");
const port = getNumberEnv("PET_SERVICE_PORT", 8082);
const pool = createPool(requireServiceDbUrl("PET"), "pet-service");
const userServiceUrl = requireEnv("USER_SERVICE_URL");
const bus = new RedisBus(requireEnv("REDIS_URL"));

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS pets (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        breed TEXT NOT NULL,
        birthdate DATE,
        sex TEXT,
        weight NUMERIC(10, 2),
        microchip TEXT,
        allergies TEXT,
        primary_clinic_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS pet_owners (
        pet_id UUID NOT NULL,
        owner_user_id UUID NOT NULL,
        relation_type TEXT NOT NULL,
        PRIMARY KEY (pet_id, owner_user_id)
      )
    `
  ]);
}

async function getUserContext(userId: string, correlationId: string) {
  return fetchJson<{
    userId: string;
    roles: Role[];
    clinicIds: string[];
  }>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

async function getOwnerIdsForPet(petId: string): Promise<string[]> {
  const owners = await many<{ owner_user_id: string }>(
    pool,
    "SELECT owner_user_id FROM pet_owners WHERE pet_id = $1",
    [petId]
  );
  return owners.map((owner) => owner.owner_user_id);
}

function toPetDto(pet: PetRow, ownerIds: string[]) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    birthdate: pet.birthdate,
    sex: pet.sex,
    weight: pet.weight,
    microchip: pet.microchip,
    allergies: pet.allergies,
    primaryClinicId: pet.primary_clinic_id,
    ownerIds
  };
}

async function canAccessPet(userId: string, pet: PetRow, correlationId: string): Promise<boolean> {
  const ownerIds = await getOwnerIdsForPet(pet.id);
  if (ownerIds.includes(userId)) {
    return true;
  }
  const context = await getUserContext(userId, correlationId);
  if (context.roles.includes("ADMIN")) {
    return true;
  }
  return context.clinicIds.includes(pet.primary_clinic_id);
}

app.post(
  "/pets",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["OWNER", "ADMIN"]);
    const payload = petSchema.parse(req.body);
    const petId = randomUUID();

    await pool.query(
      `
        INSERT INTO pets (
          id, name, species, breed, birthdate, sex, weight, microchip, allergies, primary_clinic_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        petId,
        payload.name,
        payload.species,
        payload.breed,
        payload.birthdate ?? null,
        payload.sex ?? null,
        payload.weight ?? null,
        payload.microchip ?? null,
        payload.allergies ?? null,
        payload.primaryClinicId
      ]
    );

    await pool.query(
      `
        INSERT INTO pet_owners (pet_id, owner_user_id, relation_type)
        VALUES ($1, $2, $3)
      `,
      [petId, user.id, payload.relationType]
    );

    const pet = await one<PetRow>(pool, "SELECT * FROM pets WHERE id = $1", [petId]);
    await bus.publish(
      "pet.created",
      {
        petId,
        ownerUserId: user.id,
        clinicId: payload.primaryClinicId,
        species: payload.species
      },
      req.correlationId
    );

    res.status(201).json({
      pet: toPetDto(pet as PetRow, [user.id])
    });
  })
);

app.get(
  "/pets",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    let pets: PetRow[] = [];

    if (context.roles.includes("ADMIN")) {
      pets = await many<PetRow>(pool, "SELECT * FROM pets ORDER BY created_at DESC");
    } else if (context.roles.includes("OWNER")) {
      pets = await many<PetRow>(
        pool,
        `
          SELECT p.*
          FROM pets p
          INNER JOIN pet_owners po ON po.pet_id = p.id
          WHERE po.owner_user_id = $1
          ORDER BY p.created_at DESC
        `,
        [user.id]
      );
    } else {
      pets = await many<PetRow>(
        pool,
        `
          SELECT *
          FROM pets
          WHERE primary_clinic_id = ANY($1::uuid[])
          ORDER BY created_at DESC
        `,
        [context.clinicIds.length ? context.clinicIds : ["00000000-0000-0000-0000-000000000000"]]
      );
    }

    const enriched = await Promise.all(
      pets.map(async (pet) => toPetDto(pet, await getOwnerIdsForPet(pet.id)))
    );

    res.json({ pets: enriched });
  })
);

app.get(
  "/pets/:id",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const pet = await one<PetRow>(pool, "SELECT * FROM pets WHERE id = $1", [req.params.id]);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    if (!(await canAccessPet(user.id, pet, req.correlationId))) {
      res.status(403).json({ error: "Pet access denied" });
      return;
    }

    res.json({ pet: toPetDto(pet, await getOwnerIdsForPet(pet.id)) });
  })
);

app.get(
  "/internal/pets/:id",
  asyncHandler(async (req, res) => {
    const pet = await one<PetRow>(pool, "SELECT * FROM pets WHERE id = $1", [req.params.id]);
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    res.json({ pet: toPetDto(pet, await getOwnerIdsForPet(pet.id)) });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`pet-service listening on ${port}`);
  });
});

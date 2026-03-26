import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  attachErrorHandler,
  asyncHandler,
  createBaseApp,
  createPool,
  decryptField,
  encryptField,
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
  sha256,
  type Role
} from "../../../../packages/shared/src/index.js";

type PetDto = {
  id: string;
  ownerIds: string[];
  primaryClinicId: string;
};

type UserContext = {
  userId: string;
  roles: Role[];
  clinicIds: string[];
};

type MedicalRecordRow = {
  id: string;
  pet_id: string;
  clinic_id: string;
  vet_user_id: string;
  reason: string;
  notes_encrypted: string;
  created_at: string;
};

type VaccinationRow = {
  id: string;
  pet_id: string;
  vaccine_code: string;
  date: string;
  batch: string;
  clinic_id: string;
};

type PrescriptionRow = {
  id: string;
  pet_id: string;
  clinic_id: string;
  drug: string;
  dose: string;
  frequency: string;
  start: string;
  end: string;
  notes_encrypted: string;
};

const consentSchema = z.object({
  petId: z.string().uuid(),
  clinicId: z.string().uuid(),
  scope: z.string().min(4),
  expiresAt: z.string().optional()
});

const recordSchema = z.object({
  petId: z.string().uuid(),
  clinicId: z.string().uuid(),
  reason: z.string().min(4),
  notes: z.string().min(8)
});

const vaccinationSchema = z.object({
  petId: z.string().uuid(),
  clinicId: z.string().uuid(),
  vaccineCode: z.string().min(2),
  date: z.string().min(8),
  batch: z.string().min(2)
});

const prescriptionSchema = z.object({
  petId: z.string().uuid(),
  clinicId: z.string().uuid(),
  drug: z.string().min(2),
  dose: z.string().min(1),
  frequency: z.string().min(2),
  start: z.string().min(8),
  end: z.string().min(8),
  notes: z.string().min(4)
});

const app = createBaseApp("ehr-service");
const port = getNumberEnv("EHR_SERVICE_PORT", 8083);
const pool = createPool(requireServiceDbUrl("EHR"), "ehr-service");
const bus = new RedisBus(requireEnv("REDIS_URL"));
const encryptionKey = requireEnv("EHR_ENCRYPTION_KEY");
const petServiceUrl = requireEnv("PET_SERVICE_URL");
const userServiceUrl = requireEnv("USER_SERVICE_URL");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY,
        pet_id UUID NOT NULL,
        clinic_id UUID NOT NULL,
        vet_user_id UUID NOT NULL,
        reason TEXT NOT NULL,
        notes_encrypted TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS vaccinations (
        id UUID PRIMARY KEY,
        pet_id UUID NOT NULL,
        vaccine_code TEXT NOT NULL,
        date DATE NOT NULL,
        batch TEXT NOT NULL,
        clinic_id UUID NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY,
        pet_id UUID NOT NULL,
        clinic_id UUID NOT NULL,
        drug TEXT NOT NULL,
        dose TEXT NOT NULL,
        frequency TEXT NOT NULL,
        start DATE NOT NULL,
        "end" DATE NOT NULL,
        notes_encrypted TEXT NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS consents (
        id UUID PRIMARY KEY,
        pet_id UUID NOT NULL,
        owner_user_id UUID NOT NULL,
        clinic_id UUID NOT NULL,
        scope TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        token_hash TEXT NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS access_logs (
        id UUID PRIMARY KEY,
        actor_user_id UUID,
        pet_id UUID NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip TEXT,
        result TEXT NOT NULL
      )
    `
  ]);
}

async function getPet(petId: string, correlationId: string): Promise<PetDto> {
  const response = await fetchJson<{ pet: PetDto }>(`${petServiceUrl}/internal/pets/${petId}`, {
    correlationId
  });
  return response.pet;
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, {
    correlationId
  });
}

async function logAccess(
  actorUserId: string | null,
  petId: string,
  action: string,
  resource: string,
  ip: string | undefined,
  result: string
) {
  await pool.query(
    `
      INSERT INTO access_logs (id, actor_user_id, pet_id, action, resource, ip, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [randomUUID(), actorUserId, petId, action, resource, ip ?? null, result]
  );
}

async function ensureOwnerAccess(userId: string, pet: PetDto) {
  return pet.ownerIds.includes(userId);
}

async function ensureClinicAccess(
  userId: string,
  clinicId: string,
  allowedRoles: Role[],
  correlationId: string
) {
  const context = await getUserContext(userId, correlationId);
  if (context.roles.includes("ADMIN")) {
    return true;
  }
  return allowedRoles.some((role) => context.roles.includes(role)) && context.clinicIds.includes(clinicId);
}

async function ensureConsent(petId: string, clinicId: string): Promise<boolean> {
  const consent = await one(
    pool,
    `
      SELECT 1
      FROM consents
      WHERE pet_id = $1
        AND clinic_id = $2
        AND expires_at > NOW()
    `,
    [petId, clinicId]
  );
  return Boolean(consent);
}

function toRecordDto(record: MedicalRecordRow) {
  return {
    id: record.id,
    petId: record.pet_id,
    clinicId: record.clinic_id,
    vetUserId: record.vet_user_id,
    reason: record.reason,
    notes: decryptField(record.notes_encrypted, encryptionKey),
    createdAt: record.created_at
  };
}

function toPrescriptionDto(prescription: PrescriptionRow) {
  return {
    id: prescription.id,
    petId: prescription.pet_id,
    clinicId: prescription.clinic_id,
    drug: prescription.drug,
    dose: prescription.dose,
    frequency: prescription.frequency,
    start: prescription.start,
    end: prescription.end,
    notes: decryptField(prescription.notes_encrypted, encryptionKey)
  };
}

app.post(
  "/ehr/consents",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["OWNER"]);
    const payload = consentSchema.parse(req.body);
    const pet = await getPet(payload.petId, req.correlationId);

    if (!(await ensureOwnerAccess(user.id, pet))) {
      await logAccess(user.id, payload.petId, "CREATE", "CONSENT", req.ip, "DENIED");
      res.status(403).json({ error: "Consent can only be created by the pet owner" });
      return;
    }

    const token = randomUUID();
    await pool.query(
      `
        INSERT INTO consents (id, pet_id, owner_user_id, clinic_id, scope, expires_at, token_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        randomUUID(),
        payload.petId,
        user.id,
        payload.clinicId,
        payload.scope,
        payload.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        sha256(token)
      ]
    );

    await logAccess(user.id, payload.petId, "CREATE", "CONSENT", req.ip, "ALLOWED");

    res.status(201).json({
      consent: {
        petId: payload.petId,
        clinicId: payload.clinicId,
        scope: payload.scope
      }
    });
  })
);

app.get(
  "/ehr/consents",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    const petId = typeof req.query.petId === "string" ? req.query.petId : undefined;

    let query = "SELECT * FROM consents WHERE 1=1";
    const values: unknown[] = [];

    if (context.roles.includes("OWNER")) {
      values.push(user.id);
      query += ` AND owner_user_id = $${values.length}`;
    } else if (!context.roles.includes("ADMIN")) {
      values.push(context.clinicIds.length ? context.clinicIds : ["00000000-0000-0000-0000-000000000000"]);
      query += ` AND clinic_id = ANY($${values.length}::uuid[])`;
    }

    if (clinicId) {
      values.push(clinicId);
      query += ` AND clinic_id = $${values.length}`;
    }

    if (petId) {
      values.push(petId);
      query += ` AND pet_id = $${values.length}`;
    }

    const consents = await many<{
      pet_id: string;
      clinic_id: string;
      owner_user_id: string;
      scope: string;
      expires_at: string;
    }>(pool, query, values);

    res.json({
      consents: consents.map((consent) => ({
        petId: consent.pet_id,
        clinicId: consent.clinic_id,
        ownerUserId: consent.owner_user_id,
        scope: consent.scope,
        expiresAt: consent.expires_at
      }))
    });
  })
);

app.post(
  "/ehr/records",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["VET", "CLINIC_ADMIN"]);
    const payload = recordSchema.parse(req.body);
    const pet = await getPet(payload.petId, req.correlationId);

    if (!(await ensureClinicAccess(user.id, payload.clinicId, ["VET", "CLINIC_ADMIN"], req.correlationId))) {
      await logAccess(user.id, payload.petId, "CREATE", "RECORD", req.ip, "DENIED");
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    if (!(await ensureConsent(payload.petId, payload.clinicId))) {
      await logAccess(user.id, payload.petId, "CREATE", "RECORD", req.ip, "DENIED");
      res.status(403).json({ error: "Active EHR consent required" });
      return;
    }

    const recordId = randomUUID();
    await pool.query(
      `
        INSERT INTO medical_records (id, pet_id, clinic_id, vet_user_id, reason, notes_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        recordId,
        payload.petId,
        payload.clinicId,
        user.id,
        payload.reason,
        encryptField(payload.notes, encryptionKey)
      ]
    );

    await logAccess(user.id, payload.petId, "CREATE", "RECORD", req.ip, "ALLOWED");
    await bus.publish(
      "ehr.record.updated",
      {
        petId: payload.petId,
        clinicId: payload.clinicId,
        ownerUserId: pet.ownerIds[0],
        actorUserId: user.id,
        kind: "RECORD"
      },
      req.correlationId
    );

    const record = await one<MedicalRecordRow>(pool, "SELECT * FROM medical_records WHERE id = $1", [recordId]);
    res.status(201).json({ record: toRecordDto(record as MedicalRecordRow) });
  })
);

app.get(
  "/ehr/pets/:petId/records",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const petId = String(req.params.petId);
    const pet = await getPet(petId, req.correlationId);
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : pet.primaryClinicId;

    const ownerAccess = await ensureOwnerAccess(user.id, pet);
    let staffAccess = false;
    if (!ownerAccess) {
      staffAccess = await ensureClinicAccess(
        user.id,
        clinicId,
        ["VET", "CLINIC_ADMIN", "RECEPTIONIST"],
        req.correlationId
      );
    }

    if (!ownerAccess && (!staffAccess || !(await ensureConsent(petId, clinicId)))) {
      await logAccess(user.id, petId, "READ", "RECORD", req.ip, "DENIED");
      res.status(403).json({ error: "Record access denied" });
      return;
    }

    const records = await many<MedicalRecordRow>(
      pool,
      "SELECT * FROM medical_records WHERE pet_id = $1 ORDER BY created_at DESC",
      [petId]
    );

    await logAccess(user.id, petId, "READ", "RECORD", req.ip, "ALLOWED");
    res.json({ records: records.map(toRecordDto) });
  })
);

app.post(
  "/ehr/vaccinations",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["VET", "CLINIC_ADMIN"]);
    const payload = vaccinationSchema.parse(req.body);
    const pet = await getPet(payload.petId, req.correlationId);

    if (!(await ensureClinicAccess(user.id, payload.clinicId, ["VET", "CLINIC_ADMIN"], req.correlationId))) {
      await logAccess(user.id, payload.petId, "CREATE", "VACCINATION", req.ip, "DENIED");
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    if (!(await ensureConsent(payload.petId, payload.clinicId))) {
      await logAccess(user.id, payload.petId, "CREATE", "VACCINATION", req.ip, "DENIED");
      res.status(403).json({ error: "Active EHR consent required" });
      return;
    }

    const vaccinationId = randomUUID();
    await pool.query(
      `
        INSERT INTO vaccinations (id, pet_id, vaccine_code, date, batch, clinic_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [vaccinationId, payload.petId, payload.vaccineCode, payload.date, payload.batch, payload.clinicId]
    );

    await logAccess(user.id, payload.petId, "CREATE", "VACCINATION", req.ip, "ALLOWED");
    await bus.publish(
      "ehr.record.updated",
      {
        petId: payload.petId,
        clinicId: payload.clinicId,
        ownerUserId: pet.ownerIds[0],
        actorUserId: user.id,
        kind: "VACCINATION"
      },
      req.correlationId
    );

    res.status(201).json({
      vaccination: {
        id: vaccinationId,
        ...payload
      }
    });
  })
);

app.get(
  "/ehr/pets/:petId/vaccinations",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const petId = String(req.params.petId);
    const pet = await getPet(petId, req.correlationId);
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : pet.primaryClinicId;
    const ownerAccess = await ensureOwnerAccess(user.id, pet);
    let staffAccess = false;
    if (!ownerAccess) {
      staffAccess = await ensureClinicAccess(
        user.id,
        clinicId,
        ["VET", "CLINIC_ADMIN", "RECEPTIONIST"],
        req.correlationId
      );
    }

    if (!ownerAccess && (!staffAccess || !(await ensureConsent(petId, clinicId)))) {
      await logAccess(user.id, petId, "READ", "VACCINATION", req.ip, "DENIED");
      res.status(403).json({ error: "Vaccination access denied" });
      return;
    }

    const vaccinations = await many<VaccinationRow>(
      pool,
      "SELECT * FROM vaccinations WHERE pet_id = $1 ORDER BY date DESC",
      [petId]
    );

    await logAccess(user.id, petId, "READ", "VACCINATION", req.ip, "ALLOWED");
    res.json({
      vaccinations: vaccinations.map((item) => ({
        id: item.id,
        petId: item.pet_id,
        clinicId: item.clinic_id,
        vaccineCode: item.vaccine_code,
        date: item.date,
        batch: item.batch
      }))
    });
  })
);

app.post(
  "/ehr/prescriptions",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["VET", "CLINIC_ADMIN"]);
    const payload = prescriptionSchema.parse(req.body);
    const pet = await getPet(payload.petId, req.correlationId);

    if (!(await ensureClinicAccess(user.id, payload.clinicId, ["VET", "CLINIC_ADMIN"], req.correlationId))) {
      await logAccess(user.id, payload.petId, "CREATE", "PRESCRIPTION", req.ip, "DENIED");
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    if (!(await ensureConsent(payload.petId, payload.clinicId))) {
      await logAccess(user.id, payload.petId, "CREATE", "PRESCRIPTION", req.ip, "DENIED");
      res.status(403).json({ error: "Active EHR consent required" });
      return;
    }

    const prescriptionId = randomUUID();
    await pool.query(
      `
        INSERT INTO prescriptions (id, pet_id, clinic_id, drug, dose, frequency, start, "end", notes_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        prescriptionId,
        payload.petId,
        payload.clinicId,
        payload.drug,
        payload.dose,
        payload.frequency,
        payload.start,
        payload.end,
        encryptField(payload.notes, encryptionKey)
      ]
    );

    await logAccess(user.id, payload.petId, "CREATE", "PRESCRIPTION", req.ip, "ALLOWED");
    await bus.publish(
      "ehr.record.updated",
      {
        petId: payload.petId,
        clinicId: payload.clinicId,
        ownerUserId: pet.ownerIds[0],
        actorUserId: user.id,
        kind: "PRESCRIPTION"
      },
      req.correlationId
    );

    const prescription = await one<PrescriptionRow>(pool, "SELECT * FROM prescriptions WHERE id = $1", [
      prescriptionId
    ]);

    res.status(201).json({ prescription: toPrescriptionDto(prescription as PrescriptionRow) });
  })
);

app.get(
  "/ehr/pets/:petId/prescriptions",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const petId = String(req.params.petId);
    const pet = await getPet(petId, req.correlationId);
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : pet.primaryClinicId;
    const ownerAccess = await ensureOwnerAccess(user.id, pet);
    let staffAccess = false;
    if (!ownerAccess) {
      staffAccess = await ensureClinicAccess(
        user.id,
        clinicId,
        ["VET", "CLINIC_ADMIN", "RECEPTIONIST"],
        req.correlationId
      );
    }

    if (!ownerAccess && (!staffAccess || !(await ensureConsent(petId, clinicId)))) {
      await logAccess(user.id, petId, "READ", "PRESCRIPTION", req.ip, "DENIED");
      res.status(403).json({ error: "Prescription access denied" });
      return;
    }

    const prescriptions = await many<PrescriptionRow>(
      pool,
      "SELECT * FROM prescriptions WHERE pet_id = $1 ORDER BY start DESC",
      [petId]
    );

    await logAccess(user.id, petId, "READ", "PRESCRIPTION", req.ip, "ALLOWED");
    res.json({
      prescriptions: prescriptions.map(toPrescriptionDto)
    });
  })
);

app.get(
  "/ehr/access-logs",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["ADMIN", "CLINIC_ADMIN"]);
    const logs = await many<{
      actor_user_id: string | null;
      pet_id: string;
      action: string;
      resource: string;
      timestamp: string;
      ip: string | null;
      result: string;
    }>(
      pool,
      `
        SELECT actor_user_id, pet_id, action, resource, timestamp, ip, result
        FROM access_logs
        ORDER BY timestamp DESC
        LIMIT 200
      `
    );

    res.json({
      logs: logs.map((log) => ({
        actorUserId: log.actor_user_id,
        petId: log.pet_id,
        action: log.action,
        resource: log.resource,
        timestamp: log.timestamp,
        ip: log.ip,
        result: log.result
      }))
    });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`ehr-service listening on ${port}`);
  });
});

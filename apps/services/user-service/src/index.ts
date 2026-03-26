import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  attachErrorHandler,
  asyncHandler,
  comparePassword,
  createBaseApp,
  createPool,
  getEnv,
  getNumberEnv,
  hashPassword,
  many,
  one,
  requireAuth,
  requireEnv,
  requireServiceDbUrl,
  requireRoles,
  roles,
  runStatements,
  signAccessToken,
  type AuthContext,
  type Role
} from "../../../../packages/shared/src/index.js";

type UserRow = {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  status: string;
  full_name: string;
  created_at: string;
};

type ClinicRow = {
  id: string;
  legal_name: string;
  tax_id: string;
  address: string;
  geo: string | null;
  schedule_json: string | null;
  created_by: string;
  created_at: string;
};

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8),
  fullName: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const roleUpdateSchema = z.object({
  roles: z.array(z.enum(roles)).min(1)
});

const clinicSchema = z.object({
  legalName: z.string().min(3),
  taxId: z.string().min(4),
  address: z.string().min(6),
  geo: z.string().optional(),
  scheduleJson: z.string().optional()
});

const staffSchema = z.object({
  userId: z.string().uuid(),
  staffRole: z.enum(["CLINIC_ADMIN", "VET", "RECEPTIONIST"] as const)
});

const port = getNumberEnv("USER_SERVICE_PORT", 8081);
const app = createBaseApp("user-service");
const pool = createPool(requireServiceDbUrl("USER"), "user-service");

const jwtPrivateKey = requireEnv("JWT_PRIVATE_KEY");
const jwtIssuer = requireEnv("JWT_ISSUER");
const jwtAudience = requireEnv("JWT_AUDIENCE");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL,
        role_id UUID NOT NULL,
        PRIMARY KEY (user_id, role_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS clinics (
        id UUID PRIMARY KEY,
        legal_name TEXT NOT NULL,
        tax_id TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        geo TEXT,
        schedule_json TEXT,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS clinic_staff (
        id UUID PRIMARY KEY,
        clinic_id UUID NOT NULL,
        user_id UUID NOT NULL,
        staff_role TEXT NOT NULL,
        UNIQUE (clinic_id, user_id, staff_role)
      )
    `
  ]);

  for (const role of roles) {
    await pool.query(
      `
        INSERT INTO roles (id, name)
        VALUES ($1, $2)
        ON CONFLICT (name) DO NOTHING
      `,
      [randomUUID(), role]
    );
  }

  await bootstrapAdmin();
}

async function bootstrapAdmin() {
  const adminEmail = getEnv("BOOTSTRAP_ADMIN_EMAIL", "admin@petwell.local");
  const existing = await one<UserRow>(pool, "SELECT * FROM users WHERE email = $1", [adminEmail]);
  if (existing) {
    return;
  }

  const adminId = randomUUID();
  await pool.query(
    `
      INSERT INTO users (id, email, phone, full_name, password_hash, status)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    `,
    [
      adminId,
      adminEmail,
      getEnv("BOOTSTRAP_ADMIN_PHONE", "3000000000"),
      "PetWell Admin",
      await hashPassword(getEnv("BOOTSTRAP_ADMIN_PASSWORD", "Admin123!"))
    ]
  );

  await assignRoles(adminId, ["ADMIN"]);
}

async function getRoleIds(roleNames: Role[]): Promise<string[]> {
  const result = await many<{ id: string }>(
    pool,
    "SELECT id FROM roles WHERE name = ANY($1::text[])",
    [roleNames]
  );
  return result.map((row) => row.id);
}

async function assignRoles(userId: string, roleNames: Role[]) {
  await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
  const roleIds = await getRoleIds(roleNames);
  for (const roleId of roleIds) {
    await pool.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, roleId]
    );
  }
}

async function getRolesForUser(userId: string): Promise<Role[]> {
  const result = await many<{ name: Role }>(
    pool,
    `
      SELECT r.name
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1
      ORDER BY r.name
    `,
    [userId]
  );
  return result.map((row) => row.name);
}

async function getClinicIdsForUser(userId: string): Promise<string[]> {
  const result = await many<{ clinic_id: string }>(
    pool,
    "SELECT DISTINCT clinic_id FROM clinic_staff WHERE user_id = $1",
    [userId]
  );
  return result.map((row) => row.clinic_id);
}

async function getAuthUser(user: UserRow): Promise<AuthContext> {
  return {
    id: user.id,
    email: user.email,
    roles: await getRolesForUser(user.id)
  };
}

async function isClinicAdmin(userId: string, clinicId: string): Promise<boolean> {
  const row = await one(
    pool,
    `
      SELECT 1
      FROM clinic_staff
      WHERE clinic_id = $1
        AND user_id = $2
        AND staff_role = 'CLINIC_ADMIN'
    `,
    [clinicId, userId]
  );
  return Boolean(row);
}

app.post(
  "/users/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const existing = await one<UserRow>(pool, "SELECT * FROM users WHERE email = $1", [payload.email]);

    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const userId = randomUUID();
    await pool.query(
      `
        INSERT INTO users (id, email, phone, full_name, password_hash, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      `,
      [userId, payload.email, payload.phone, payload.fullName, await hashPassword(payload.password)]
    );

    await assignRoles(userId, ["OWNER"]);

    const user = await one<UserRow>(pool, "SELECT * FROM users WHERE id = $1", [userId]);
    const authUser = await getAuthUser(user as UserRow);

    res.status(201).json({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles
      },
      token: signAccessToken(authUser, jwtPrivateKey, jwtIssuer, jwtAudience)
    });
  })
);

app.post(
  "/users/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await one<UserRow>(pool, "SELECT * FROM users WHERE email = $1", [payload.email]);

    if (!user || !(await comparePassword(payload.password, user.password_hash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const authUser = await getAuthUser(user);

    res.json({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        clinicIds: await getClinicIdsForUser(authUser.id)
      },
      token: signAccessToken(authUser, jwtPrivateKey, jwtIssuer, jwtAudience)
    });
  })
);

app.get(
  "/users/me",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const dbUser = await one<UserRow>(pool, "SELECT * FROM users WHERE id = $1", [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        clinicIds: await getClinicIdsForUser(user.id),
        fullName: dbUser?.full_name ?? user.email
      }
    });
  })
);

app.get(
  "/users/admin/users",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["ADMIN"]);

    const users = await many<
      UserRow & {
        roles_csv: string;
      }
    >(
      pool,
      `
        SELECT
          u.*,
          COALESCE(string_agg(DISTINCT r.name, ',' ORDER BY r.name), '') AS roles_csv
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `
    );

    res.json({
      users: users.map((item) => ({
        id: item.id,
        email: item.email,
        phone: item.phone,
        fullName: item.full_name,
        status: item.status,
        roles: item.roles_csv ? item.roles_csv.split(",") : []
      }))
    });
  })
);

app.put(
  "/users/admin/users/:userId/roles",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["ADMIN"]);
    const payload = roleUpdateSchema.parse(req.body);
    const targetUserId = String(req.params.userId);

    await assignRoles(targetUserId, payload.roles);
    res.json({
      userId: targetUserId,
      roles: payload.roles
    });
  })
);

app.post(
  "/users/clinics",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireRoles(user, ["ADMIN", "CLINIC_ADMIN"]);

    const payload = clinicSchema.parse(req.body);
    const clinicId = randomUUID();

    await pool.query(
      `
        INSERT INTO clinics (id, legal_name, tax_id, address, geo, schedule_json, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        clinicId,
        payload.legalName,
        payload.taxId,
        payload.address,
        payload.geo ?? null,
        payload.scheduleJson ?? null,
        user.id
      ]
    );

    if (user.roles.includes("CLINIC_ADMIN")) {
      await pool.query(
        `
          INSERT INTO clinic_staff (id, clinic_id, user_id, staff_role)
          VALUES ($1, $2, $3, 'CLINIC_ADMIN')
          ON CONFLICT DO NOTHING
        `,
        [randomUUID(), clinicId, user.id]
      );
    }

    res.status(201).json({
      clinic: {
        id: clinicId,
        legalName: payload.legalName,
        taxId: payload.taxId,
        address: payload.address
      }
    });
  })
);

app.get(
  "/users/clinics",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const clinicIds = await getClinicIdsForUser(user.id);
    const canSeeAllClinics = user.roles.includes("ADMIN") || user.roles.includes("OWNER");

    const clinics = await many<ClinicRow & { staff_count: string }>(
      pool,
      `
        SELECT c.*, COUNT(cs.id)::text AS staff_count
        FROM clinics c
        LEFT JOIN clinic_staff cs ON cs.clinic_id = c.id
        ${canSeeAllClinics ? "" : "WHERE c.id = ANY($1::uuid[])"}
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `,
      canSeeAllClinics ? [] : [clinicIds.length ? clinicIds : ["00000000-0000-0000-0000-000000000000"]]
    );

    res.json({
      clinics: clinics.map((clinic) => ({
        id: clinic.id,
        legalName: clinic.legal_name,
        taxId: clinic.tax_id,
        address: clinic.address,
        geo: clinic.geo,
        scheduleJson: clinic.schedule_json,
        staffCount: Number(clinic.staff_count)
      }))
    });
  })
);

app.post(
  "/users/clinics/:clinicId/staff",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const payload = staffSchema.parse(req.body);
    const clinicId = String(req.params.clinicId);

    if (user.roles.includes("ADMIN")) {
      // allowed
    } else if (user.roles.includes("CLINIC_ADMIN")) {
      const allowed = await isClinicAdmin(user.id, clinicId);
      if (!allowed) {
        res.status(403).json({ error: "Only clinic admins of this clinic can assign staff" });
        return;
      }
    } else {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const targetRoles = await getRolesForUser(payload.userId);
    if (!targetRoles.includes(payload.staffRole)) {
      res.status(400).json({ error: "Target user does not have the requested elevated role" });
      return;
    }

    await pool.query(
      `
        INSERT INTO clinic_staff (id, clinic_id, user_id, staff_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `,
      [randomUUID(), clinicId, payload.userId, payload.staffRole]
    );

    res.status(201).json({
      clinicId,
      userId: payload.userId,
      staffRole: payload.staffRole
    });
  })
);

app.get(
  "/users/clinics/:clinicId/staff",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const clinicId = String(req.params.clinicId);

    if (!user.roles.includes("ADMIN")) {
      const clinicIds = await getClinicIdsForUser(user.id);
      if (!clinicIds.includes(clinicId)) {
        res.status(403).json({ error: "Clinic access denied" });
        return;
      }
    }

    const staff = await many<
      UserRow & {
        staff_role: string;
      }
    >(
      pool,
      `
        SELECT u.*, cs.staff_role
        FROM clinic_staff cs
        INNER JOIN users u ON u.id = cs.user_id
        WHERE cs.clinic_id = $1
        ORDER BY u.full_name
      `,
      [clinicId]
    );

    res.json({
      staff: staff.map((member) => ({
        id: member.id,
        email: member.email,
        fullName: member.full_name,
        phone: member.phone,
        staffRole: member.staff_role
      }))
    });
  })
);

app.get(
  "/internal/users/:userId/context",
  asyncHandler(async (req, res) => {
    const user = await one<UserRow>(pool, "SELECT * FROM users WHERE id = $1", [req.params.userId]);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      roles: await getRolesForUser(user.id),
      clinicIds: await getClinicIdsForUser(user.id)
    });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`user-service listening on ${port}`);
  });
});

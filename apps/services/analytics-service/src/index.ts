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
  runStatements,
  type DomainEvent,
  type Role
} from "../../../../packages/shared/src/index.js";

type UserContext = {
  userId: string;
  roles: Role[];
  clinicIds: string[];
};

const app = createBaseApp("analytics-service");
const port = getNumberEnv("ANALYTICS_SERVICE_PORT", 8088);
const pool = createPool(requireEnv("ANALYTICS_DB_URL"));
const bus = new RedisBus(requireEnv("REDIS_URL"));
const userServiceUrl = requireEnv("USER_SERVICE_URL");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS event_log (
        id BIGSERIAL PRIMARY KEY,
        event_name TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        clinic_id UUID,
        occurred_at TIMESTAMPTZ NOT NULL,
        payload_json JSONB NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS kpi_global_daily (
        date DATE PRIMARY KEY,
        active_clinics INTEGER NOT NULL DEFAULT 0,
        registered_pets INTEGER NOT NULL DEFAULT 0,
        total_appointments INTEGER NOT NULL DEFAULT 0,
        telemed_count INTEGER NOT NULL DEFAULT 0,
        revenue NUMERIC(12, 2) NOT NULL DEFAULT 0
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS kpi_clinic_daily (
        date DATE NOT NULL,
        clinic_id UUID NOT NULL,
        occupancy INTEGER NOT NULL DEFAULT 0,
        revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
        appointments INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, clinic_id)
      )
    `
  ]);

  await bus.subscribe({
    "pet.created": async (event) => {
      await recordEvent(event);
      await pool.query(
        `
          INSERT INTO kpi_global_daily (date, registered_pets)
          VALUES (CURRENT_DATE, 1)
          ON CONFLICT (date) DO UPDATE
          SET registered_pets = kpi_global_daily.registered_pets + 1
        `
      );
    },
    "appointment.created": async (event) => {
      await recordEvent(event);
      await pool.query(
        `
          INSERT INTO kpi_global_daily (date, total_appointments, telemed_count)
          VALUES (CURRENT_DATE, 1, $1)
          ON CONFLICT (date) DO UPDATE
          SET total_appointments = kpi_global_daily.total_appointments + 1,
              telemed_count = kpi_global_daily.telemed_count + EXCLUDED.telemed_count
        `,
        [event.payload.type === "TELEMED" ? 1 : 0]
      );

      await pool.query(
        `
          INSERT INTO kpi_clinic_daily (date, clinic_id, occupancy, revenue, appointments)
          VALUES (CURRENT_DATE, $1, 0, 0, 1)
          ON CONFLICT (date, clinic_id) DO UPDATE
          SET appointments = kpi_clinic_daily.appointments + 1
        `,
        [event.payload.clinicId]
      );
    },
    "payment.succeeded": async (event) => {
      await recordEvent(event);
      await pool.query(
        `
          INSERT INTO kpi_global_daily (date, revenue)
          VALUES (CURRENT_DATE, $1)
          ON CONFLICT (date) DO UPDATE
          SET revenue = kpi_global_daily.revenue + EXCLUDED.revenue
        `,
        [event.payload.total]
      );

      await pool.query(
        `
          INSERT INTO kpi_clinic_daily (date, clinic_id, occupancy, revenue, appointments)
          VALUES (CURRENT_DATE, $1, 0, $2, 0)
          ON CONFLICT (date, clinic_id) DO UPDATE
          SET revenue = kpi_clinic_daily.revenue + EXCLUDED.revenue
        `,
        [event.payload.clinicId, event.payload.total]
      );
    },
    "appointment.confirmed": async (event) => {
      await recordEvent(event);
      await pool.query(
        `
          INSERT INTO kpi_clinic_daily (date, clinic_id, occupancy, revenue, appointments)
          VALUES (CURRENT_DATE, $1, 1, 0, 0)
          ON CONFLICT (date, clinic_id) DO UPDATE
          SET occupancy = kpi_clinic_daily.occupancy + 1
        `,
        [event.payload.clinicId]
      );
    },
    "appointment.completed": async (event) => {
      await recordEvent(event);
      await pool.query(
        `
          INSERT INTO kpi_clinic_daily (date, clinic_id, occupancy, revenue, appointments)
          VALUES (CURRENT_DATE, $1, 1, 0, 0)
          ON CONFLICT (date, clinic_id) DO UPDATE
          SET occupancy = kpi_clinic_daily.occupancy + 1
        `,
        [event.payload.clinicId]
      );
    },
    "telemed.room.ready": recordEvent,
    "ehr.record.updated": recordEvent
  });
}

async function recordEvent(event: DomainEvent) {
  const clinicId =
    "clinicId" in event.payload && typeof event.payload.clinicId === "string"
      ? event.payload.clinicId
      : null;

  await pool.query(
    `
      INSERT INTO event_log (event_name, correlation_id, clinic_id, occurred_at, payload_json)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [event.name, event.correlationId, clinicId, event.occurredAt, JSON.stringify(event.payload)]
  );

  if (clinicId) {
    await pool.query(
      `
        INSERT INTO kpi_global_daily (date, active_clinics)
        VALUES (
          CURRENT_DATE,
          (SELECT COUNT(DISTINCT clinic_id) FROM event_log WHERE DATE(occurred_at) = CURRENT_DATE AND clinic_id IS NOT NULL)
        )
        ON CONFLICT (date) DO UPDATE
        SET active_clinics = EXCLUDED.active_clinics
      `
    );
  }
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

app.get(
  "/analytics/summary",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);

    if (!context.roles.includes("ADMIN") && !context.clinicIds.length) {
      res.status(403).json({ error: "Analytics access denied" });
      return;
    }

    const global = await one<{
      date: string;
      active_clinics: number;
      registered_pets: number;
      total_appointments: number;
      telemed_count: number;
      revenue: number;
    }>(
      pool,
      `
        SELECT *
        FROM kpi_global_daily
        ORDER BY date DESC
        LIMIT 1
      `
    );

    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    const clinicFilter =
      context.roles.includes("ADMIN")
        ? clinicId
          ? [clinicId]
          : []
        : clinicId
          ? [clinicId]
          : context.clinicIds;

    if (!context.roles.includes("ADMIN") && clinicId && !context.clinicIds.includes(clinicId)) {
      res.status(403).json({ error: "Clinic analytics access denied" });
      return;
    }

    const clinics = clinicFilter.length
      ? await many<{
          date: string;
          clinic_id: string;
          occupancy: number;
          revenue: number;
          appointments: number;
        }>(
          pool,
          `
            SELECT *
            FROM kpi_clinic_daily
            WHERE clinic_id = ANY($1::uuid[])
            ORDER BY date DESC
          `,
          [clinicFilter]
        )
      : await many<{
          date: string;
          clinic_id: string;
          occupancy: number;
          revenue: number;
          appointments: number;
        }>(
          pool,
          `
            SELECT *
            FROM kpi_clinic_daily
            ORDER BY date DESC
          `
        );

    res.json({
      global: global
        ? {
            date: global.date,
            activeClinics: global.active_clinics,
            registeredPets: global.registered_pets,
            totalAppointments: global.total_appointments,
            telemedCount: global.telemed_count,
            revenue: Number(global.revenue)
          }
        : null,
      clinics: clinics.map((clinic) => ({
        date: clinic.date,
        clinicId: clinic.clinic_id,
        occupancy: clinic.occupancy,
        revenue: Number(clinic.revenue),
        appointments: clinic.appointments
      }))
    });
  })
);

app.get(
  "/analytics/events",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    if (!context.roles.includes("ADMIN") && !context.clinicIds.length) {
      res.status(403).json({ error: "Analytics access denied" });
      return;
    }

    const events = context.roles.includes("ADMIN")
      ? await many<{
          event_name: string;
          correlation_id: string;
          clinic_id: string | null;
          occurred_at: string;
          payload_json: unknown;
        }>(
          pool,
          `
            SELECT event_name, correlation_id, clinic_id, occurred_at, payload_json
            FROM event_log
            ORDER BY occurred_at DESC
            LIMIT 200
          `
        )
      : await many<{
          event_name: string;
          correlation_id: string;
          clinic_id: string | null;
          occurred_at: string;
          payload_json: unknown;
        }>(
          pool,
          `
            SELECT event_name, correlation_id, clinic_id, occurred_at, payload_json
            FROM event_log
            WHERE clinic_id = ANY($1::uuid[])
            ORDER BY occurred_at DESC
            LIMIT 200
          `,
          [context.clinicIds]
        );

    res.json({
      events: events.map((event) => ({
        name: event.event_name,
        correlationId: event.correlation_id,
        clinicId: event.clinic_id,
        occurredAt: event.occurred_at,
        payload: event.payload_json
      }))
    });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`analytics-service listening on ${port}`);
  });
});

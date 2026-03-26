import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  appointmentStatuses,
  appointmentTypes,
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
  runStatements,
  type AppointmentStatus,
  type AppointmentType,
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

type ScheduleRow = {
  id: string;
  clinic_id: string;
  vet_user_id: string;
  day_of_week: number;
  start: string;
  end: string;
  slot_minutes: number;
};

type AppointmentRow = {
  id: string;
  pet_id: string;
  owner_user_id: string;
  clinic_id: string;
  vet_user_id: string;
  type: AppointmentType;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_at: string;
};

const app = createBaseApp("appointment-service");
const port = getNumberEnv("APPOINTMENT_SERVICE_PORT", 8084);
const pool = createPool(requireServiceDbUrl("APPOINTMENT"), "appointment-service");
const bus = new RedisBus(requireEnv("REDIS_URL"));
const userServiceUrl = requireEnv("USER_SERVICE_URL");
const petServiceUrl = requireEnv("PET_SERVICE_URL");

const scheduleSchema = z.object({
  clinicId: z.string().uuid(),
  vetUserId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.coerce.number().int().min(10).max(240)
});

const appointmentSchema = z.object({
  petId: z.string().uuid(),
  clinicId: z.string().uuid(),
  vetUserId: z.string().uuid(),
  type: z.enum(appointmentTypes),
  startTime: z.string().datetime(),
  endTime: z.string().datetime()
});

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY,
        clinic_id UUID NOT NULL,
        vet_user_id UUID NOT NULL,
        day_of_week INTEGER NOT NULL,
        start TIME NOT NULL,
        "end" TIME NOT NULL,
        slot_minutes INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY,
        pet_id UUID NOT NULL,
        owner_user_id UUID NOT NULL,
        clinic_id UUID NOT NULL,
        vet_user_id UUID NOT NULL,
        type TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  ]);

  await bus.subscribe({
    "payment.succeeded": async (event) => {
      const appointment = await one<AppointmentRow>(
        pool,
        "SELECT * FROM appointments WHERE id = $1",
        [event.payload.appointmentId]
      );

      if (!appointment || appointment.status !== "PENDING_PAYMENT") {
        return;
      }

      await pool.query("UPDATE appointments SET status = 'CONFIRMED' WHERE id = $1", [appointment.id]);
      await bus.publish(
        "appointment.confirmed",
        {
          appointmentId: appointment.id,
          petId: appointment.pet_id,
          ownerUserId: appointment.owner_user_id,
          clinicId: appointment.clinic_id,
          vetUserId: appointment.vet_user_id,
          type: appointment.type,
          status: "CONFIRMED",
          startTime: appointment.start_time,
          endTime: appointment.end_time
        },
        event.correlationId
      );
    }
  });
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

async function getPet(petId: string, correlationId: string): Promise<PetDto> {
  const response = await fetchJson<{ pet: PetDto }>(`${petServiceUrl}/internal/pets/${petId}`, {
    correlationId
  });
  return response.pet;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function appointmentFitsSchedule(schedule: ScheduleRow, startTime: string, endTime: string): boolean {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dayOfWeek = start.getUTCDay();
  const minutesStart = start.getUTCHours() * 60 + start.getUTCMinutes();
  const minutesEnd = end.getUTCHours() * 60 + end.getUTCMinutes();
  const scheduleStart = timeToMinutes(schedule.start.slice(0, 5));
  const scheduleEnd = timeToMinutes(schedule.end.slice(0, 5));

  return (
    dayOfWeek === schedule.day_of_week &&
    minutesStart >= scheduleStart &&
    minutesEnd <= scheduleEnd &&
    (minutesEnd - minutesStart) % schedule.slot_minutes === 0
  );
}

async function hasClinicAccess(userId: string, clinicId: string, correlationId: string): Promise<boolean> {
  const context = await getUserContext(userId, correlationId);
  if (context.roles.includes("ADMIN")) {
    return true;
  }
  return context.clinicIds.includes(clinicId);
}

async function canReadAppointment(userId: string, appointment: AppointmentRow, correlationId: string) {
  if (appointment.owner_user_id === userId) {
    return true;
  }
  return hasClinicAccess(userId, appointment.clinic_id, correlationId);
}

function toDto(appointment: AppointmentRow) {
  return {
    id: appointment.id,
    petId: appointment.pet_id,
    ownerUserId: appointment.owner_user_id,
    clinicId: appointment.clinic_id,
    vetUserId: appointment.vet_user_id,
    type: appointment.type,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    status: appointment.status
  };
}

app.post(
  "/appointments/schedules",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    const payload = scheduleSchema.parse(req.body);

    if (
      !context.roles.includes("ADMIN") &&
      !context.roles.includes("CLINIC_ADMIN") &&
      !context.roles.includes("RECEPTIONIST") &&
      !context.roles.includes("VET")
    ) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    if (!(await hasClinicAccess(user.id, payload.clinicId, req.correlationId))) {
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    const scheduleId = randomUUID();
    await pool.query(
      `
        INSERT INTO schedules (id, clinic_id, vet_user_id, day_of_week, start, "end", slot_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        scheduleId,
        payload.clinicId,
        payload.vetUserId,
        payload.dayOfWeek,
        payload.start,
        payload.end,
        payload.slotMinutes
      ]
    );

    res.status(201).json({
      schedule: {
        id: scheduleId,
        ...payload
      }
    });
  })
);

app.get(
  "/appointments/schedules",
  asyncHandler(async (req, res) => {
    requireAuth(req);
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    const vetUserId = typeof req.query.vetUserId === "string" ? req.query.vetUserId : undefined;
    const values: unknown[] = [];
    let query = "SELECT * FROM schedules WHERE 1=1";

    if (clinicId) {
      values.push(clinicId);
      query += ` AND clinic_id = $${values.length}`;
    }

    if (vetUserId) {
      values.push(vetUserId);
      query += ` AND vet_user_id = $${values.length}`;
    }

    query += " ORDER BY clinic_id, day_of_week, start";
    const schedules = await many<ScheduleRow>(pool, query, values);

    res.json({
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        clinicId: schedule.clinic_id,
        vetUserId: schedule.vet_user_id,
        dayOfWeek: schedule.day_of_week,
        start: schedule.start,
        end: schedule.end,
        slotMinutes: schedule.slot_minutes
      }))
    });
  })
);

app.post(
  "/appointments",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    const payload = appointmentSchema.parse(req.body);
    const pet = await getPet(payload.petId, req.correlationId);

    if (context.roles.includes("OWNER")) {
      if (!pet.ownerIds.includes(user.id)) {
        res.status(403).json({ error: "Pet ownership required" });
        return;
      }
    } else if (!(await hasClinicAccess(user.id, payload.clinicId, req.correlationId))) {
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    const schedule = await one<ScheduleRow>(
      pool,
      `
        SELECT * FROM schedules
        WHERE clinic_id = $1
          AND vet_user_id = $2
          AND day_of_week = $3
        LIMIT 1
      `,
      [payload.clinicId, payload.vetUserId, new Date(payload.startTime).getUTCDay()]
    );

    if (!schedule || !appointmentFitsSchedule(schedule, payload.startTime, payload.endTime)) {
      res.status(400).json({ error: "Requested slot is outside the registered availability" });
      return;
    }

    const overlap = await one(
      pool,
      `
        SELECT 1
        FROM appointments
        WHERE vet_user_id = $1
          AND status <> 'CANCELLED'
          AND start_time < $3
          AND end_time > $2
      `,
      [payload.vetUserId, payload.startTime, payload.endTime]
    );

    if (overlap) {
      res.status(409).json({ error: "Selected time slot is no longer available" });
      return;
    }

    const appointmentId = randomUUID();
    const ownerUserId = pet.ownerIds[0];

    await pool.query(
      `
        INSERT INTO appointments (
          id, pet_id, owner_user_id, clinic_id, vet_user_id, type, start_time, end_time, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_PAYMENT')
      `,
      [
        appointmentId,
        payload.petId,
        ownerUserId,
        payload.clinicId,
        payload.vetUserId,
        payload.type,
        payload.startTime,
        payload.endTime
      ]
    );

    await bus.publish(
      "appointment.created",
      {
        appointmentId,
        petId: payload.petId,
        ownerUserId,
        clinicId: payload.clinicId,
        vetUserId: payload.vetUserId,
        type: payload.type,
        status: "PENDING_PAYMENT",
        startTime: payload.startTime,
        endTime: payload.endTime
      },
      req.correlationId
    );

    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      appointmentId
    ]);
    res.status(201).json({ appointment: toDto(appointment as AppointmentRow) });
  })
);

app.post(
  "/appointments/:id/confirm",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      req.params.id
    ]);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    if (!(await hasClinicAccess(user.id, appointment.clinic_id, req.correlationId))) {
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    await pool.query("UPDATE appointments SET status = 'CONFIRMED' WHERE id = $1", [appointment.id]);
    await bus.publish(
      "appointment.confirmed",
      {
        appointmentId: appointment.id,
        petId: appointment.pet_id,
        ownerUserId: appointment.owner_user_id,
        clinicId: appointment.clinic_id,
        vetUserId: appointment.vet_user_id,
        type: appointment.type,
        status: "CONFIRMED",
        startTime: appointment.start_time,
        endTime: appointment.end_time
      },
      req.correlationId
    );

    res.json({ appointmentId: appointment.id, status: "CONFIRMED" });
  })
);

app.post(
  "/appointments/:id/cancel",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      req.params.id
    ]);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const canCancel =
      appointment.owner_user_id === user.id ||
      (await hasClinicAccess(user.id, appointment.clinic_id, req.correlationId));

    if (!canCancel) {
      res.status(403).json({ error: "Appointment access denied" });
      return;
    }

    await pool.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = $1", [appointment.id]);
    res.json({ appointmentId: appointment.id, status: "CANCELLED" });
  })
);

app.post(
  "/appointments/:id/complete",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      req.params.id
    ]);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const context = await getUserContext(user.id, req.correlationId);
    if (
      !context.roles.includes("ADMIN") &&
      !context.roles.includes("CLINIC_ADMIN") &&
      !context.roles.includes("VET")
    ) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    if (!(await hasClinicAccess(user.id, appointment.clinic_id, req.correlationId))) {
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    await pool.query("UPDATE appointments SET status = 'COMPLETED' WHERE id = $1", [appointment.id]);
    await bus.publish(
      "appointment.completed",
      {
        appointmentId: appointment.id,
        petId: appointment.pet_id,
        ownerUserId: appointment.owner_user_id,
        clinicId: appointment.clinic_id,
        vetUserId: appointment.vet_user_id,
        type: appointment.type,
        status: "COMPLETED",
        startTime: appointment.start_time,
        endTime: appointment.end_time
      },
      req.correlationId
    );

    res.json({ appointmentId: appointment.id, status: "COMPLETED" });
  })
);

app.get(
  "/appointments",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    let appointments: AppointmentRow[] = [];

    if (context.roles.includes("ADMIN")) {
      appointments = await many<AppointmentRow>(pool, "SELECT * FROM appointments ORDER BY start_time DESC");
    } else if (context.roles.includes("OWNER")) {
      appointments = await many<AppointmentRow>(
        pool,
        "SELECT * FROM appointments WHERE owner_user_id = $1 ORDER BY start_time DESC",
        [user.id]
      );
    } else {
      appointments = await many<AppointmentRow>(
        pool,
        `
          SELECT *
          FROM appointments
          WHERE clinic_id = ANY($1::uuid[])
          ORDER BY start_time DESC
        `,
        [context.clinicIds.length ? context.clinicIds : ["00000000-0000-0000-0000-000000000000"]]
      );
    }

    res.json({ appointments: appointments.map(toDto) });
  })
);

app.get(
  "/appointments/:id",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      req.params.id
    ]);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    if (!(await canReadAppointment(user.id, appointment, req.correlationId))) {
      res.status(403).json({ error: "Appointment access denied" });
      return;
    }

    res.json({ appointment: toDto(appointment) });
  })
);

app.get(
  "/internal/appointments/:id",
  asyncHandler(async (req, res) => {
    const appointment = await one<AppointmentRow>(pool, "SELECT * FROM appointments WHERE id = $1", [
      req.params.id
    ]);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json({ appointment: toDto(appointment) });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`appointment-service listening on ${port}`);
  });
});

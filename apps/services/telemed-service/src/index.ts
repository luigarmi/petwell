import { randomUUID } from "node:crypto";
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
  runStatements,
  type Role
} from "../../../../packages/shared/src/index.js";

type UserContext = {
  userId: string;
  roles: Role[];
  clinicIds: string[];
};

type AppointmentDto = {
  id: string;
  ownerUserId: string;
  clinicId: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
};

type RoomRow = {
  id: string;
  appointment_id: string;
  room_url: string;
  room_code: string;
  created_at: string;
};

const app = createBaseApp("telemed-service");
const port = getNumberEnv("TELEMED_SERVICE_PORT", 8086);
const pool = createPool(requireServiceDbUrl("TELEMED"), "telemed-service");
const bus = new RedisBus(requireEnv("REDIS_URL"));
const appointmentServiceUrl = requireEnv("APPOINTMENT_SERVICE_URL");
const userServiceUrl = requireEnv("USER_SERVICE_URL");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY,
        appointment_id UUID UNIQUE NOT NULL,
        room_url TEXT NOT NULL,
        room_code TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  ]);

  await bus.subscribe({
    "appointment.created": async (event) => {
      if (event.payload.type !== "TELEMED") {
        return;
      }

      const existing = await one<RoomRow>(pool, "SELECT * FROM rooms WHERE appointment_id = $1", [
        event.payload.appointmentId
      ]);

      if (existing) {
        return;
      }

      const roomCode = `PW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await pool.query(
        `
          INSERT INTO rooms (id, appointment_id, room_url, room_code)
          VALUES ($1, $2, $3, $4)
        `,
        [
          randomUUID(),
          event.payload.appointmentId,
          `https://telemed.petwell.local/room/${event.payload.appointmentId}`,
          roomCode
        ]
      );

      await bus.publish(
        "telemed.room.ready",
        {
          appointmentId: event.payload.appointmentId,
          roomUrl: `https://telemed.petwell.local/room/${event.payload.appointmentId}`,
          roomCode,
          clinicId: event.payload.clinicId,
          ownerUserId: event.payload.ownerUserId
        },
        event.correlationId
      );
    }
  });
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

async function getAppointment(appointmentId: string, correlationId: string): Promise<AppointmentDto> {
  const response = await fetchJson<{ appointment: AppointmentDto }>(
    `${appointmentServiceUrl}/internal/appointments/${appointmentId}`,
    { correlationId }
  );
  return response.appointment;
}

async function canAccessRoom(userId: string, appointment: AppointmentDto, correlationId: string) {
  if (appointment.ownerUserId === userId) {
    return true;
  }
  const context = await getUserContext(userId, correlationId);
  return context.roles.includes("ADMIN") || context.clinicIds.includes(appointment.clinicId);
}

function toDto(room: RoomRow) {
  return {
    appointmentId: room.appointment_id,
    roomUrl: room.room_url,
    roomCode: room.room_code,
    createdAt: room.created_at
  };
}

app.get(
  "/telemed/rooms",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    const rooms = await many<RoomRow>(pool, "SELECT * FROM rooms ORDER BY created_at DESC");
    const visible = [];

    for (const room of rooms) {
      const appointment = await getAppointment(room.appointment_id, req.correlationId);
      if (
        appointment.ownerUserId === user.id ||
        context.roles.includes("ADMIN") ||
        context.clinicIds.includes(appointment.clinicId)
      ) {
        visible.push(toDto(room));
      }
    }

    res.json({ rooms: visible });
  })
);

app.get(
  "/telemed/rooms/:appointmentId",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointmentId = String(req.params.appointmentId);
    const appointment = await getAppointment(appointmentId, req.correlationId);
    if (!(await canAccessRoom(user.id, appointment, req.correlationId))) {
      res.status(403).json({ error: "Telemed room access denied" });
      return;
    }

    const room = await one<RoomRow>(pool, "SELECT * FROM rooms WHERE appointment_id = $1", [appointmentId]);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json({ room: toDto(room) });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`telemed-service listening on ${port}`);
  });
});

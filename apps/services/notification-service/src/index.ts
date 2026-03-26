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
  RedisBus,
  requireAuth,
  requireEnv,
  runStatements,
  type Role
} from "../../../../packages/shared/src/index.js";

type UserContext = {
  userId: string;
  roles: Role[];
  clinicIds: string[];
};

type NotificationRow = {
  id: string;
  user_id: string | null;
  clinic_id: string | null;
  category: string;
  title: string;
  message: string;
  related_resource: string | null;
  created_at: string;
  read_at: string | null;
};

const manualNotificationSchema = z.object({
  userId: z.string().uuid().optional(),
  clinicId: z.string().uuid().optional(),
  category: z.string().default("MANUAL"),
  title: z.string().min(3),
  message: z.string().min(6),
  relatedResource: z.string().optional()
});

const app = createBaseApp("notification-service");
const port = getNumberEnv("NOTIFICATION_SERVICE_PORT", 8087);
const pool = createPool(requireEnv("NOTIFICATION_DB_URL"));
const bus = new RedisBus(requireEnv("REDIS_URL"));
const userServiceUrl = requireEnv("USER_SERVICE_URL");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID,
        clinic_id UUID,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_resource TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ
      )
    `
  ]);

  await bus.subscribe({
    "appointment.created": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "APPOINTMENT",
        title: "Cita creada",
        message: "La cita fue registrada y está pendiente de pago.",
        relatedResource: event.payload.appointmentId
      });
    },
    "payment.succeeded": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "PAYMENT",
        title: "Pago confirmado",
        message: `Se registró el pago de ${event.payload.total} y la cita avanza a confirmación.`,
        relatedResource: event.payload.invoiceId
      });
    },
    "appointment.confirmed": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "APPOINTMENT",
        title: "Cita confirmada",
        message: "La cita ya quedó confirmada y visible en tu agenda.",
        relatedResource: event.payload.appointmentId
      });
    },
    "appointment.completed": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "APPOINTMENT",
        title: "Atención finalizada",
        message: "La cita fue marcada como completada.",
        relatedResource: event.payload.appointmentId
      });
    },
    "telemed.room.ready": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "TELEMED",
        title: "Sala virtual disponible",
        message: `La sala ${event.payload.roomCode} ya está lista para la consulta remota.`,
        relatedResource: event.payload.appointmentId
      });
    },
    "ehr.record.updated": async (event) => {
      await createNotification({
        userId: event.payload.ownerUserId,
        clinicId: event.payload.clinicId,
        category: "EHR",
        title: "Historia clínica actualizada",
        message: `Se registró una actualización clínica de tipo ${event.payload.kind}.`,
        relatedResource: event.payload.petId
      });
    }
  });
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

async function createNotification(input: {
  userId?: string | null;
  clinicId?: string | null;
  category: string;
  title: string;
  message: string;
  relatedResource?: string | null;
}) {
  await pool.query(
    `
      INSERT INTO notifications (id, user_id, clinic_id, category, title, message, related_resource)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      randomUUID(),
      input.userId ?? null,
      input.clinicId ?? null,
      input.category,
      input.title,
      input.message,
      input.relatedResource ?? null
    ]
  );
}

function toDto(notification: NotificationRow) {
  return {
    id: notification.id,
    userId: notification.user_id,
    clinicId: notification.clinic_id,
    category: notification.category,
    title: notification.title,
    message: notification.message,
    relatedResource: notification.related_resource,
    createdAt: notification.created_at,
    readAt: notification.read_at
  };
}

app.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    let notifications: NotificationRow[] = [];

    if (context.roles.includes("ADMIN")) {
      notifications = await many<NotificationRow>(
        pool,
        "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200"
      );
    } else if (context.roles.includes("OWNER")) {
      notifications = await many<NotificationRow>(
        pool,
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200",
        [user.id]
      );
    } else {
      notifications = await many<NotificationRow>(
        pool,
        `
          SELECT *
          FROM notifications
          WHERE user_id = $1
             OR clinic_id = ANY($2::uuid[])
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [user.id, context.clinicIds.length ? context.clinicIds : ["00000000-0000-0000-0000-000000000000"]]
      );
    }

    res.json({ notifications: notifications.map(toDto) });
  })
);

app.post(
  "/notifications/send",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    const payload = manualNotificationSchema.parse(req.body);

    if (
      !context.roles.includes("ADMIN") &&
      !context.roles.includes("CLINIC_ADMIN") &&
      !context.roles.includes("RECEPTIONIST")
    ) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    if (
      payload.clinicId &&
      !context.roles.includes("ADMIN") &&
      !context.clinicIds.includes(payload.clinicId)
    ) {
      res.status(403).json({ error: "Clinic access denied" });
      return;
    }

    await createNotification(payload);
    res.status(201).json({ status: "sent" });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`notification-service listening on ${port}`);
  });
});

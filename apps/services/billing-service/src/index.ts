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
  petId: string;
  ownerUserId: string;
  clinicId: string;
  vetUserId: string;
  type: string;
  startTime: string;
  endTime: string;
  status: string;
};

type InvoiceRow = {
  id: string;
  appointment_id: string;
  clinic_id: string;
  owner_user_id: string;
  pet_id: string;
  total: number;
  status: string;
  issued_at: string;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  provider: string;
  provider_ref: string;
  amount: number;
  status: string;
  created_at: string;
};

const paymentSchema = z.object({
  appointmentId: z.string().uuid(),
  provider: z.string().default("SIMULATED"),
  amount: z.coerce.number().positive()
});

const app = createBaseApp("billing-service");
const port = getNumberEnv("BILLING_SERVICE_PORT", 8085);
const pool = createPool(requireServiceDbUrl("BILLING"), "billing-service");
const bus = new RedisBus(requireEnv("REDIS_URL"));
const appointmentServiceUrl = requireEnv("APPOINTMENT_SERVICE_URL");
const userServiceUrl = requireEnv("USER_SERVICE_URL");

async function setupDatabase() {
  await runStatements(pool, [
    `
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY,
        appointment_id UUID UNIQUE NOT NULL,
        clinic_id UUID NOT NULL,
        owner_user_id UUID NOT NULL,
        pet_id UUID NOT NULL,
        total NUMERIC(12, 2) NOT NULL,
        status TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY,
        invoice_id UUID NOT NULL,
        provider TEXT NOT NULL,
        provider_ref TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  ]);
}

async function getAppointment(appointmentId: string, correlationId: string): Promise<AppointmentDto> {
  const response = await fetchJson<{ appointment: AppointmentDto }>(
    `${appointmentServiceUrl}/internal/appointments/${appointmentId}`,
    { correlationId }
  );
  return response.appointment;
}

async function getUserContext(userId: string, correlationId: string): Promise<UserContext> {
  return fetchJson<UserContext>(`${userServiceUrl}/internal/users/${userId}/context`, { correlationId });
}

function toDto(invoice: InvoiceRow, payment: PaymentRow | null) {
  return {
    appointmentId: invoice.appointment_id,
    invoice: {
      id: invoice.id,
      clinicId: invoice.clinic_id,
      ownerUserId: invoice.owner_user_id,
      petId: invoice.pet_id,
      total: Number(invoice.total),
      status: invoice.status,
      issuedAt: invoice.issued_at
    },
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          providerRef: payment.provider_ref,
          amount: Number(payment.amount),
          status: payment.status,
          createdAt: payment.created_at
        }
      : null
  };
}

app.post(
  "/payments",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const payload = paymentSchema.parse(req.body);
    const appointment = await getAppointment(payload.appointmentId, req.correlationId);
    const context = await getUserContext(user.id, req.correlationId);

    const hasAccess =
      appointment.ownerUserId === user.id ||
      context.roles.includes("ADMIN") ||
      context.clinicIds.includes(appointment.clinicId);

    if (!hasAccess) {
      res.status(403).json({ error: "Payment access denied" });
      return;
    }

    const existingInvoice = await one<InvoiceRow>(
      pool,
      "SELECT * FROM invoices WHERE appointment_id = $1",
      [appointment.id]
    );

    if (existingInvoice) {
      const existingPayment = await one<PaymentRow>(
        pool,
        "SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1",
        [existingInvoice.id]
      );
      res.json(toDto(existingInvoice, existingPayment));
      return;
    }

    const invoiceId = randomUUID();
    const paymentId = randomUUID();

    await pool.query(
      `
        INSERT INTO invoices (id, appointment_id, clinic_id, owner_user_id, pet_id, total, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'PAID')
      `,
      [invoiceId, appointment.id, appointment.clinicId, appointment.ownerUserId, appointment.petId, payload.amount]
    );

    await pool.query(
      `
        INSERT INTO payments (id, invoice_id, provider, provider_ref, amount, status)
        VALUES ($1, $2, $3, $4, $5, 'SUCCEEDED')
      `,
      [paymentId, invoiceId, payload.provider, `SIM-${Date.now()}`, payload.amount]
    );

    await bus.publish(
      "payment.succeeded",
      {
        appointmentId: appointment.id,
        invoiceId,
        paymentId,
        clinicId: appointment.clinicId,
        ownerUserId: appointment.ownerUserId,
        petId: appointment.petId,
        total: payload.amount,
        provider: payload.provider
      },
      req.correlationId
    );

    const invoice = await one<InvoiceRow>(pool, "SELECT * FROM invoices WHERE id = $1", [invoiceId]);
    const payment = await one<PaymentRow>(pool, "SELECT * FROM payments WHERE id = $1", [paymentId]);

    res.status(201).json(toDto(invoice as InvoiceRow, payment as PaymentRow));
  })
);

app.get(
  "/payments/:appointmentId",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const appointmentId = String(req.params.appointmentId);
    const appointment = await getAppointment(appointmentId, req.correlationId);
    const context = await getUserContext(user.id, req.correlationId);
    const hasAccess =
      appointment.ownerUserId === user.id ||
      context.roles.includes("ADMIN") ||
      context.clinicIds.includes(appointment.clinicId);

    if (!hasAccess) {
      res.status(403).json({ error: "Billing access denied" });
      return;
    }

    const invoice = await one<InvoiceRow>(pool, "SELECT * FROM invoices WHERE appointment_id = $1", [appointmentId]);

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const payment = await one<PaymentRow>(
      pool,
      "SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1",
      [invoice.id]
    );

    res.json(toDto(invoice, payment));
  })
);

app.get(
  "/payments/invoices",
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const context = await getUserContext(user.id, req.correlationId);
    let invoices: InvoiceRow[] = [];

    if (context.roles.includes("ADMIN")) {
      invoices = await many<InvoiceRow>(pool, "SELECT * FROM invoices ORDER BY issued_at DESC");
    } else if (context.roles.includes("OWNER")) {
      invoices = await many<InvoiceRow>(
        pool,
        "SELECT * FROM invoices WHERE owner_user_id = $1 ORDER BY issued_at DESC",
        [user.id]
      );
    } else {
      invoices = await many<InvoiceRow>(
        pool,
        "SELECT * FROM invoices WHERE clinic_id = ANY($1::uuid[]) ORDER BY issued_at DESC",
        [context.clinicIds.length ? context.clinicIds : ["00000000-0000-0000-0000-000000000000"]]
      );
    }

    const results = await Promise.all(
      invoices.map(async (invoice) => {
        const payment = await one<PaymentRow>(
          pool,
          "SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1",
          [invoice.id]
        );
        return toDto(invoice, payment);
      })
    );

    res.json({ invoices: results });
  })
);

void setupDatabase().then(() => {
  attachErrorHandler(app);
  app.listen(port, () => {
    console.log(`billing-service listening on ${port}`);
  });
});

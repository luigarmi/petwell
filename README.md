# PetWell

PetWell is a local-first veterinary health and wellness platform built as a `pnpm` monorepo with microservices, `database-per-service`, two `Next.js` frontends, and local infrastructure through `Docker Compose`.

## Scope closed in FASE 0

The requirements and operating assumptions were fixed with the user:

- local email/password auth
- roles: `superadmin`, `clinic_admin`, `veterinarian`, `receptionist`, `pet_owner`
- appointment pricing defined by each clinic
- full payment in `COP`
- `PetWell` is the collector
- no platform commissions
- public-web checkout redirects to the payment provider
- preferred real payment provider: `Wompi`
- local `mock` telemedicine provider
- preferred real telemedicine provider: `Daily`
- local email delivery with `Mailpit`
- internal receipt PDF, not fiscal invoicing
- Spanish-only v1

## Architecture

### Applications

- `apps/api-gateway`
- `apps/user-service`
- `apps/pet-service`
- `apps/ehr-service`
- `apps/appointment-service`
- `apps/telemed-service`
- `apps/notification-service`
- `apps/billing-service`
- `apps/analytics-service`
- `apps/frontend-public-web`
- `apps/frontend-admin-web`

### Shared packages

- `packages/shared-types`
- `packages/shared-utils`
- `packages/shared-auth`
- `packages/shared-events`
- `packages/shared-config`

### Infrastructure

- PostgreSQL per service
- Redis
- RabbitMQ
- MinIO
- Mailpit
- Nginx
- Prometheus
- Grafana
- Loki + Promtail

## Functional modules

### API gateway

- single entry point
- JWT validation
- Redis-backed rate limiting
- correlation id
- centralized proxy error handling
- Swagger at `/api/docs`

### User service

- register, login, refresh, logout
- password reset flow
- clinics, staff, profiles, roles
- public clinic discovery by city, specialty and service type
- demo users and clinics

### Pet service

- pet CRUD
- pet-owner ownership checks
- shared pet access for families and co-owners
- allergies, microchip, photos, main clinic

### EHR service

- clinical records
- structured medical sections for visit reason, anamnesis, physical exam, treatments and imaging
- clinical file attachments per record with download for staff and pet owners
- consent between clinics
- pet-owner access to their own pet records, consents and audit trail
- access audit
- encryption of sensitive fields

### Appointment service

- schedules
- operational schedule blocks
- availability
- reservations
- cancellations and rescheduling
- waitlist
- anti double-booking

### Telemed service

- secure room creation
- appointment binding
- expiration and duration
- mock provider active
- `Daily` prepared as the preferred real provider
- `Twilio` prepared as the alternate provider

### Notification service

- transactional emails
- reminder scheduler
- pet birthday reminders
- retries and persistence
- Mailpit integration for local testing

### Billing service

- adapter architecture
- `MockPaymentProvider` fully functional for local use
- `WompiProvider` prepared as the preferred real provider
- `MercadoPagoProvider` prepared
- webhooks
- idempotency
- payment history
- receipt PDF stored in MinIO

### Analytics service

- revenue KPIs
- payment success/failure metrics
- appointments by clinic
- occupancy and activity summaries

## Event contracts

RabbitMQ topics implemented:

- `appointment.created`
- `appointment.cancelled`
- `appointment.completed`
- `payment.created`
- `payment.succeeded`
- `payment.failed`
- `telemed.room.created`
- `notification.requested`
- `ehr.record.accessed`

## Monorepo bootstrap

### Requirements

- `Node.js 22+`
- `Corepack`
- `Docker Desktop` with Linux engine healthy

### Install

```powershell
.\scripts\install.ps1
```

This runs:

- `corepack pnpm install`
- `corepack pnpm prisma:generate`

## Local execution with Docker Compose

### 1. Copy environment variables

Create a local `.env` from `.env.example` if you want to customize secrets or providers.

### 2. Start the stack

```powershell
.\scripts\up.ps1
```

### 3. Apply migrations

```powershell
.\scripts\migrate.ps1
```

### 4. Load demo data

```powershell
.\scripts\seed.ps1
```

### 5. Run validation

```powershell
.\scripts\test.ps1
```

The stack doctor and health scripts now verify:

- Docker engine availability
- gateway readiness and liveness
- backend dependency readiness through the gateway report
- public and admin frontend reachability

## Local URLs

- public web: `http://localhost/`
- admin web: `http://localhost/admin/login`
- admin EHR view: `http://localhost/admin/ehr`
- pet owner history view: `http://localhost/pets`
- gateway Swagger: `http://localhost/api/docs`
- gateway readiness: `http://localhost/api/health/ready`
- gateway liveness: `http://localhost/api/health/live`
- RabbitMQ: `http://localhost:15672`
- Mailpit: `http://localhost:8025`
- MinIO console: `http://localhost:9001`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3009`

## Demo users

All demo users share the password:

- `Petwell123!`

Primary demo accounts:

- `superadmin@petwell.local`
- `admin.north@petwell.local`
- `admin.south@petwell.local`
- `vet1@petwell.local`
- `vet2@petwell.local`
- `vet3@petwell.local`
- `recep1@petwell.local`
- `recep2@petwell.local`
- `ana@petwell.local`
- `bruno@petwell.local`
- `carla@petwell.local`
- `diego@petwell.local`
- `elena@petwell.local`

## Clinical history and files

- veterinarians and clinic admins can create and review clinical records from `/admin/ehr`
- clinical files can be attached when creating a record from the admin EHR view
- pet owners can open `/pets`, choose a mascota and review or download the clinical history by pet
- attached files are stored for the EHR service on `EHR_STORAGE_PATH` and persisted in Docker through the `ehr_storage_data` volume

## Mock payment flow

Local billing uses `PAYMENT_PROVIDER=mock`.

Expected flow:

1. create an appointment from the public web
2. billing creates the payment attempt asynchronously
3. retrieve the latest payment for the appointment
4. approve it with the mock endpoint
5. appointment changes from `pending_payment` to `confirmed`
6. notification service emits the confirmation email
7. telemed room is created automatically for `telemed` appointments

Relevant endpoints:

- `GET /api/billing/payments/appointment/:appointmentId/latest`
- `POST /api/billing/payments/:id/mock/approve`
- `POST /api/billing/payments/:id/mock/decline`
- `GET /api/billing/payments/:id/receipt`

## Real payment activation

### Wompi preferred setup

Fill these variables:

- `WOMPI_SANDBOX_PUBLIC_KEY`
- `WOMPI_SANDBOX_PRIVATE_KEY`
- `WOMPI_SANDBOX_INTEGRITY_SECRET`
- `WOMPI_SANDBOX_EVENTS_SECRET`
- `WOMPI_PRODUCTION_PUBLIC_KEY`
- `WOMPI_PRODUCTION_PRIVATE_KEY`
- `WOMPI_PRODUCTION_INTEGRITY_SECRET`
- `WOMPI_PRODUCTION_EVENTS_SECRET`

Then set:

- `PAYMENT_PROVIDER=wompi`

### Mercado Pago

Fill these variables:

- `MERCADOPAGO_SANDBOX_ACCESS_TOKEN`
- `MERCADOPAGO_SANDBOX_WEBHOOK_SECRET`
- `MERCADOPAGO_PRODUCTION_ACCESS_TOKEN`
- `MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET`

Then set:

- `PAYMENT_PROVIDER=mercadopago`

### Public webhooks required for real providers

- `POST /api/billing/webhooks/wompi`
- `POST /api/billing/webhooks/mercadopago`

## Telemedicine activation

### Mock mode

- `TELEMED_PROVIDER=mock`

### Daily preferred setup

- fill `DAILY_API_KEY`
- set `TELEMED_PROVIDER=daily`

### Twilio

- fill `TWILIO_ACCOUNT_SID`
- fill `TWILIO_API_KEY`
- fill `TWILIO_API_SECRET`
- set `TELEMED_PROVIDER=twilio`

## Observability

Every backend service exposes:

- JSON logs
- `/metrics` for Prometheus
- `/health` as readiness
- `/health/ready` as explicit readiness
- `/health/live` as liveness
- correlation id propagation

Docker Compose healthchecks use `/health/ready`, so a container is marked healthy only after its critical dependencies are reachable.

Provisioned dashboards and collectors live under:

- `infra/prometheus`
- `infra/grafana`
- `infra/loki`

Grafana dashboards included:

- `PetWell Overview`
- `PetWell Runtime Health`

## Scripts

- install: `.\scripts\install.ps1`
- docker doctor: `.\scripts\docker-doctor.ps1`
- stack health: `.\scripts\check-stack-health.ps1`
- up: `.\scripts\up.ps1`
- migrate: `.\scripts\migrate.ps1`
- seed: `.\scripts\seed.ps1`
- tests: `.\scripts\test.ps1`
- critical E2E only: `corepack pnpm test:e2e:critical`
- ops validation: `corepack pnpm validate:ops`

## Validation status

Verified in the current workspace:

- `corepack pnpm lint`
- `corepack pnpm build`
- `corepack pnpm test`
- `corepack pnpm test:e2e`

The compose runtime validation depends on a healthy local Docker engine. If Docker Desktop is down or its Linux engine is not responding, application code does not need changes; the host Docker environment must be fixed first.

## Docker troubleshooting

If `docker version` fails or returns an engine error, run:

```powershell
.\scripts\docker-doctor.ps1
```

If the doctor script reports an unhealthy engine, the usual host recovery sequence is:

1. close Docker Desktop
2. run `wsl --shutdown`
3. open Docker Desktop again
4. rerun `.\scripts\docker-doctor.ps1`
5. then continue with `.\scripts\up.ps1`

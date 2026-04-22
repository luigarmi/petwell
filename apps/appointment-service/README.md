# Appointment Service

Scheduling, availability, booking and waitlist service.

## Default port

- `3004`

## Responsibilities

- schedule templates
- public availability
- appointment creation
- cancel and reschedule flows
- waitlist
- appointment confirmation after payment events
- summary and internal lookup endpoints

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /schedules`
- `POST /schedules`
- `GET /availability`
- `POST /appointments`
- `GET /appointments`
- `GET /appointments/:id`
- `PATCH /appointments/:id/cancel`
- `PATCH /appointments/:id/reschedule`
- `PATCH /appointments/:id/complete`
- `POST /waitlist`

## Scripts

- `pnpm --filter @petwell/appointment-service dev`
- `pnpm --filter @petwell/appointment-service prisma:generate`
- `pnpm --filter @petwell/appointment-service prisma:migrate:dev`
- `pnpm --filter @petwell/appointment-service prisma:migrate:deploy`
- `pnpm --filter @petwell/appointment-service seed`
- `pnpm --filter @petwell/appointment-service lint`
- `pnpm --filter @petwell/appointment-service test`
- `pnpm --filter @petwell/appointment-service test:e2e`

## Key env

- `DATABASE_URL`
- `USER_SERVICE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `RABBITMQ_URL`
- `REDIS_URL`

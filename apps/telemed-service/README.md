# Telemed Service

Virtual rooms for telemedicine appointments.

## Default port

- `3006`

## Responsibilities

- create secure virtual rooms
- bind rooms to appointments
- expire rooms
- support mock provider in local mode
- keep `Daily` as the preferred real provider
- keep `Twilio` prepared as the alternate provider

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /telemed/rooms`
- `GET /telemed/rooms/appointment/:appointmentId`
- `GET /telemed/rooms/:roomId/access`

## Scripts

- `pnpm --filter @petwell/telemed-service dev`
- `pnpm --filter @petwell/telemed-service prisma:generate`
- `pnpm --filter @petwell/telemed-service prisma:migrate:dev`
- `pnpm --filter @petwell/telemed-service prisma:migrate:deploy`
- `pnpm --filter @petwell/telemed-service seed`
- `pnpm --filter @petwell/telemed-service lint`
- `pnpm --filter @petwell/telemed-service test`

## Key env

- `DATABASE_URL`
- `TELEMED_PROVIDER`
- `PUBLIC_APP_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`
- `DAILY_API_KEY`

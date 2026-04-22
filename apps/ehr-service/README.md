# EHR Service

Electronic health record service with consent and audit.

## Default port

- `3003`

## Responsibilities

- create clinical records
- list and read records by pet
- manage inter-clinic consent
- audit clinical access
- encrypt sensitive clinical fields

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /ehr/records`
- `GET /ehr/records/pet/:petId`
- `GET /ehr/records/:id`
- `POST /ehr/consents`
- `DELETE /ehr/consents/:id`
- `GET /ehr/consents/pet/:petId`
- `GET /ehr/audit/pet/:petId`

## Scripts

- `pnpm --filter @petwell/ehr-service dev`
- `pnpm --filter @petwell/ehr-service prisma:generate`
- `pnpm --filter @petwell/ehr-service prisma:migrate:dev`
- `pnpm --filter @petwell/ehr-service prisma:migrate:deploy`
- `pnpm --filter @petwell/ehr-service seed`
- `pnpm --filter @petwell/ehr-service lint`
- `pnpm --filter @petwell/ehr-service test`
- `pnpm --filter @petwell/ehr-service test:e2e`

## Key env

- `DATABASE_URL`
- `FIELD_ENCRYPTION_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `RABBITMQ_URL`
- `REDIS_URL`

# Pet Service

Pet records and pet-owner relationships.

## Default port

- `3002`

## Responsibilities

- pet CRUD
- ownership checks
- pet access profile for clinical modules
- summary metrics for analytics
- allergy, microchip, photo and main clinic metadata

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /pets`
- `GET /pets`
- `GET /pets/:id`
- `PATCH /pets/:id`
- `DELETE /pets/:id`
- `GET /pets/:id/access-profile`
- `GET /pets/summary`

## Scripts

- `pnpm --filter @petwell/pet-service dev`
- `pnpm --filter @petwell/pet-service prisma:generate`
- `pnpm --filter @petwell/pet-service prisma:migrate:dev`
- `pnpm --filter @petwell/pet-service prisma:migrate:deploy`
- `pnpm --filter @petwell/pet-service seed`
- `pnpm --filter @petwell/pet-service lint`
- `pnpm --filter @petwell/pet-service test`
- `pnpm --filter @petwell/pet-service test:e2e`

## Key env

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `RABBITMQ_URL`
- `REDIS_URL`

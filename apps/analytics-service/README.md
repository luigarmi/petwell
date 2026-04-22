# Analytics Service

KPI aggregation and reporting service.

## Default port

- `3008`

## Responsibilities

- ingest domain events
- expose payment and appointment KPIs
- summarize revenue and operational activity
- aggregate service-level metrics for dashboards

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /analytics/kpis`
- `GET /analytics/revenue`
- `GET /analytics/activity`

## Scripts

- `pnpm --filter @petwell/analytics-service dev`
- `pnpm --filter @petwell/analytics-service prisma:generate`
- `pnpm --filter @petwell/analytics-service prisma:migrate:dev`
- `pnpm --filter @petwell/analytics-service prisma:migrate:deploy`
- `pnpm --filter @petwell/analytics-service seed`
- `pnpm --filter @petwell/analytics-service lint`
- `pnpm --filter @petwell/analytics-service test`

## Key env

- `DATABASE_URL`
- `BILLING_SERVICE_URL`
- `APPOINTMENT_SERVICE_URL`
- `PET_SERVICE_URL`
- `RABBITMQ_URL`

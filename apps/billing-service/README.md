# Billing Service

Payment attempts, webhooks, receipts and provider adapters for Colombia.

## Default port

- `3005`

## Responsibilities

- create payment attempts from appointment events
- expose mock approval and decline endpoints for local development
- validate `Wompi` and `Mercado Pago` webhook signatures
- keep `Wompi` as the preferred real payment provider
- keep payment history and idempotency records
- generate internal receipt PDFs in MinIO
- publish payment success and failure events

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /billing/payments/summary`
- `GET /billing/payments/appointment/:appointmentId/latest`
- `GET /billing/payments/:id`
- `GET /billing/payments/:id/receipt`
- `POST /billing/payments/:id/retry`
- `POST /billing/payments/:id/refund`
- `POST /billing/payments/:id/mock/approve`
- `POST /billing/payments/:id/mock/decline`
- `POST /billing/webhooks/wompi`
- `POST /billing/webhooks/mercadopago`

## Scripts

- `pnpm --filter @petwell/billing-service dev`
- `pnpm --filter @petwell/billing-service prisma:generate`
- `pnpm --filter @petwell/billing-service prisma:migrate:dev`
- `pnpm --filter @petwell/billing-service prisma:migrate:deploy`
- `pnpm --filter @petwell/billing-service seed`
- `pnpm --filter @petwell/billing-service lint`
- `pnpm --filter @petwell/billing-service test`
- `pnpm --filter @petwell/billing-service test:e2e`

## Key env

- `DATABASE_URL`
- `PAYMENT_PROVIDER`
- `PAYMENT_CURRENCY`
- `PUBLIC_APP_URL`
- `API_PUBLIC_URL`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

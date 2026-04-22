# API Gateway

Single HTTP entry point for PetWell.

## Default port

- `3000`

## Responsibilities

- validate JWT before proxying protected routes
- apply Redis-backed rate limiting
- propagate correlation ids
- expose `/health`, `/health/live`, `/health/ready`, `/metrics` and Swagger
- proxy traffic to backend microservices

## Public routes

- `/`
- `/health`
- `/health/live`
- `/health/ready`
- `/docs`
- `/auth/*`
- `/clinics/public/search`
- `/clinics/:id/services`
- `/availability`
- `/billing/webhooks/wompi`
- `/billing/webhooks/mercadopago`

## Scripts

- `pnpm --filter @petwell/api-gateway dev`
- `pnpm --filter @petwell/api-gateway build`
- `pnpm --filter @petwell/api-gateway start`
- `pnpm --filter @petwell/api-gateway lint`
- `pnpm --filter @petwell/api-gateway test`

## Key env

- `PORT`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `USER_SERVICE_URL`
- `PET_SERVICE_URL`
- `EHR_SERVICE_URL`
- `APPOINTMENT_SERVICE_URL`
- `BILLING_SERVICE_URL`
- `TELEMED_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `ANALYTICS_SERVICE_URL`

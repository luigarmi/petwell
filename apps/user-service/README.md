# User Service

Identity, authentication, user, clinic and staff management.

## Default port

- `3001`

## Responsibilities

- owner registration and login
- refresh token rotation
- logout
- forgot/reset password
- user profile management
- clinic CRUD
- clinic staff management
- clinic service catalog
- demo users and demo clinics

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/demo-users`
- `GET /users/me`
- `GET /clinics/public/search`
- `POST /clinics/:id/staff`
- `POST /clinics/:id/services`

## Scripts

- `pnpm --filter @petwell/user-service dev`
- `pnpm --filter @petwell/user-service prisma:generate`
- `pnpm --filter @petwell/user-service prisma:migrate:dev`
- `pnpm --filter @petwell/user-service prisma:migrate:deploy`
- `pnpm --filter @petwell/user-service seed`
- `pnpm --filter @petwell/user-service lint`
- `pnpm --filter @petwell/user-service test`
- `pnpm --filter @petwell/user-service test:e2e`

## Key env

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `PUBLIC_APP_URL`
- `MAIL_FROM`
- `RABBITMQ_URL`
- `REDIS_URL`

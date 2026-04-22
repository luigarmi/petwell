# Notification Service

Email notifications, reminders and delivery history.

## Default port

- `3007`

## Responsibilities

- transactional emails
- appointment reminders
- cancellation and confirmation notifications
- template rendering
- retry-friendly persistence
- Mailpit integration for local development

## Main routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /notifications/me`
- `GET /notifications/summary`

## Scripts

- `pnpm --filter @petwell/notification-service dev`
- `pnpm --filter @petwell/notification-service prisma:generate`
- `pnpm --filter @petwell/notification-service prisma:migrate:dev`
- `pnpm --filter @petwell/notification-service prisma:migrate:deploy`
- `pnpm --filter @petwell/notification-service seed`
- `pnpm --filter @petwell/notification-service lint`
- `pnpm --filter @petwell/notification-service test`

## Key env

- `DATABASE_URL`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_FROM`
- `USER_SERVICE_URL`
- `APPOINTMENT_SERVICE_URL`
- `RABBITMQ_URL`

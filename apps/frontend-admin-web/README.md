# Frontend Admin Web

Administrative and clinic operations web application.

## Default port

- `3002`

## Base path

- `/admin`

## Main pages

- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/pets`
- `/admin/appointments`
- `/admin/ehr`
- `/admin/billing`
- `/admin/analytics`

## Responsibilities

- superadmin dashboard
- clinic operations dashboard
- user and staff management
- appointment operations
- controlled EHR access
- payment monitoring
- analytics and CSV export

## Scripts

- `pnpm --filter @petwell/frontend-admin-web dev`
- `pnpm --filter @petwell/frontend-admin-web build`
- `pnpm --filter @petwell/frontend-admin-web start`
- `pnpm --filter @petwell/frontend-admin-web lint`

## Key env

- `NEXT_PUBLIC_API_URL` default: `/api`

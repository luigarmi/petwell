# Frontend Public Web

Public owner-facing web application.

## Default port

- `3001`

## Main pages

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/profile`
- `/pets`
- `/clinics`
- `/book`
- `/appointments`
- `/payments/[id]`
- `/telemed/[roomId]`
- `/notifications`

## Responsibilities

- owner sign-up and sign-in
- clinic discovery
- pet registration
- appointment booking
- payment redirection and payment status
- telemedicine room access
- owner notification history

## Scripts

- `pnpm --filter @petwell/frontend-public-web dev`
- `pnpm --filter @petwell/frontend-public-web build`
- `pnpm --filter @petwell/frontend-public-web start`
- `pnpm --filter @petwell/frontend-public-web lint`

## Key env

- `NEXT_PUBLIC_API_URL` default: `/api`

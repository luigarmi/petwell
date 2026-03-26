# PetWell

PetWell es una plataforma veterinaria basada en microservicios para propietarios, clinicas y administracion del ecosistema.

## Arquitectura

La solucion incluye:

- Frontend React con separacion por rol.
- API Gateway con JWT RS256, rate limiting, CORS y correlation ID.
- Microservicios por dominio: usuarios, mascotas, EHR, agenda, pagos, telemedicina, notificaciones y analitica.
- PostgreSQL por dominio y Redis como bus de eventos.

Servicios expuestos por el gateway:

- `POST /users/register`
- `POST /users/login`
- `GET /users/me`
- `GET /users/admin/users`
- `PUT /users/admin/users/:userId/roles`
- `POST /users/clinics`
- `GET /users/clinics`
- `POST /users/clinics/:clinicId/staff`
- `POST /pets`
- `GET /pets`
- `GET /pets/:id`
- `POST /ehr/consents`
- `GET /ehr/consents`
- `POST /ehr/records`
- `GET /ehr/pets/:petId/records`
- `POST /ehr/vaccinations`
- `GET /ehr/pets/:petId/vaccinations`
- `POST /ehr/prescriptions`
- `GET /ehr/pets/:petId/prescriptions`
- `GET /ehr/access-logs`
- `POST /appointments/schedules`
- `GET /appointments/schedules`
- `POST /appointments`
- `POST /appointments/:id/confirm`
- `POST /appointments/:id/cancel`
- `POST /appointments/:id/complete`
- `GET /appointments`
- `POST /payments`
- `GET /payments/:appointmentId`
- `GET /payments/invoices`
- `GET /telemed/rooms`
- `GET /telemed/rooms/:appointmentId`
- `GET /notifications`
- `POST /notifications/send`
- `GET /analytics/summary`
- `GET /analytics/events`

Los eventos y contratos estan en [docs/event-contracts.md](/c:/Users/luisa/Downloads/PetWell/docs/event-contracts.md).

## UX

El frontend presenta:

- Landing limpia con alternancia entre ingreso y registro.
- Centro operativo por rol sin mezclar modulos no autorizados.
- Portal OWNER orientado a mascotas, consentimientos, citas, pagos y telemedicina.
- Portal clinico orientado a agenda, EHR, staff, notificaciones y analitica.
- Portal ADMIN para asignar roles y supervisar usuarios.

## Variables de entorno

Parte de `.env.example` y ajusta segun el entorno:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `EHR_ENCRYPTION_KEY`
- `REDIS_URL`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_PHONE`
- `CORS_ALLOWED_ORIGINS`
- `PETWELL_API_BASE`
- `PETWELL_GATEWAY_URL`

## Ejecucion local

```powershell
Copy-Item .env.example .env
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

Validaciones rapidas:

- Gateway: `http://localhost:8080/health`
- Frontend: `http://localhost:3000`

## Despliegue

### Frontend en Vercel

En produccion el frontend usa `/api` por defecto y delega las llamadas al proxy en [api/[...path].js](/c:/Users/luisa/Downloads/PetWell/api/[...path].js). Eso evita que el navegador apunte a `localhost`.

Configura esta variable en Vercel:

- `PETWELL_GATEWAY_URL=https://tu-gateway-publico`

Con eso, la app desplegada queda funcional sin depender de CORS del navegador.

### Llamada directa al gateway

Si prefieres que el navegador llame directo al gateway, configura:

- `PETWELL_API_BASE=https://tu-gateway-publico`
- `CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app`

## Scripts utiles

```powershell
npm install
npm run typecheck
npm run build:web
npm run smoke
```

## Seguridad

- JWT firmado con RS256.
- Control de acceso por rol propagado desde el gateway.
- Consentimiento obligatorio para acceso clinico al EHR.
- Cifrado de notas clinicas y prescripciones sensibles.
- Correlation ID transversal.
- Auditoria de acceso EHR.

## CI/CD

Se incluye workflow de GitHub Actions con:

- instalacion de dependencias
- typecheck
- build del frontend
- validacion de `docker compose`

## Alcance del MVP implementado

Esta base cubre el flujo operacional critico y deja el proyecto preparado para profundizar en:

- observabilidad avanzada
- proveedores reales de pago y videollamada
- migraciones versionadas
- suites de pruebas unitarias e integracion mas amplias

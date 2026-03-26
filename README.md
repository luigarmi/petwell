# PetWell

PetWell es una plataforma veterinaria basada en microservicios para propietarios, clínicas y administración del ecosistema. La solución incluye:

- Frontend React con separación por rol.
- API Gateway con JWT RS256, rate limiting, CORS y correlation ID.
- Microservicios por dominio: usuarios, mascotas, EHR, agenda, pagos, telemedicina, notificaciones y analítica.
- PostgreSQL por dominio y Redis como bus de eventos.
- Flujo funcional de registro, asignación de roles, clínica, mascota, consentimiento, cita, pago, telemedicina, EHR y métricas.

## Arquitectura

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

Los eventos y contratos principales están en [docs/event-contracts.md](/c:/Users/luisa/Downloads/PetWell/docs/event-contracts.md).

## UX

El frontend presenta:

- Landing limpia con alternancia entre ingreso y registro.
- Centro operativo por rol sin mezclar módulos no autorizados.
- Portal OWNER orientado a mascotas, consentimientos, citas, pagos y telemedicina.
- Portal clínico orientado a agenda, EHR, staff, notificaciones y analítica.
- Portal ADMIN para asignar roles y supervisar usuarios.

## Variables de entorno

Parte de `.env.example` y ajusta según el entorno:

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

## Ejecución local

```powershell
Copy-Item .env.example .env
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

Validaciones rápidas:

- Gateway: `http://localhost:8080/health`
- Frontend: `http://localhost:3000`

## Scripts útiles

```powershell
npm install
npm run typecheck
npm run build:web
npm run smoke
```

## Seguridad

- JWT firmado con RS256.
- Control de acceso por rol propagado desde el gateway.
- Consentimiento obligatorio para acceso clínico al EHR.
- Cifrado de notas clínicas y prescripciones sensibles.
- Correlation ID transversal.
- Auditoría de acceso EHR.

## CI/CD

Se incluye workflow de GitHub Actions con:

- instalación de dependencias
- typecheck
- build del frontend
- validación de `docker compose`

## Alcance del MVP implementado

Esta base cubre el flujo operacional crítico y deja el proyecto preparado para profundizar en:

- observabilidad avanzada
- proveedores reales de pago y videollamada
- migraciones versionadas
- suites de pruebas unitarias e integración más amplias

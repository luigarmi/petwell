# Event Contracts

Canal Redis: `petwell.events`

## `pet.created`

```json
{
  "name": "pet.created",
  "payload": {
    "petId": "uuid",
    "ownerUserId": "uuid",
    "clinicId": "uuid",
    "species": "string"
  }
}
```

## `appointment.created`

```json
{
  "name": "appointment.created",
  "payload": {
    "appointmentId": "uuid",
    "petId": "uuid",
    "ownerUserId": "uuid",
    "clinicId": "uuid",
    "vetUserId": "uuid",
    "type": "IN_PERSON | TELEMED",
    "status": "PENDING_PAYMENT",
    "startTime": "ISO-8601",
    "endTime": "ISO-8601"
  }
}
```

## `payment.succeeded`

```json
{
  "name": "payment.succeeded",
  "payload": {
    "appointmentId": "uuid",
    "invoiceId": "uuid",
    "paymentId": "uuid",
    "clinicId": "uuid",
    "ownerUserId": "uuid",
    "petId": "uuid",
    "total": 95000,
    "provider": "SIMULATED"
  }
}
```

## `appointment.confirmed`

Confirma la cita después del pago.

## `appointment.completed`

Cierra la atención y alimenta la operación clínica.

## `telemed.room.ready`

```json
{
  "name": "telemed.room.ready",
  "payload": {
    "appointmentId": "uuid",
    "roomUrl": "https://telemed.petwell.local/room/<appointmentId>",
    "roomCode": "PW-XXXXXX",
    "clinicId": "uuid",
    "ownerUserId": "uuid"
  }
}
```

## `ehr.record.updated`

```json
{
  "name": "ehr.record.updated",
  "payload": {
    "petId": "uuid",
    "clinicId": "uuid",
    "ownerUserId": "uuid",
    "actorUserId": "uuid",
    "kind": "RECORD | VACCINATION | PRESCRIPTION"
  }
}
```

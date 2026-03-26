export const roles = [
  "OWNER",
  "CLINIC_ADMIN",
  "VET",
  "RECEPTIONIST",
  "ADMIN"
] as const;

export type Role = (typeof roles)[number];

export const appointmentTypes = ["IN_PERSON", "TELEMED"] as const;
export type AppointmentType = (typeof appointmentTypes)[number];

export const appointmentStatuses = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED"
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export interface AuthContext {
  id: string;
  email: string;
  roles: Role[];
}

export interface AppointmentEventPayload {
  appointmentId: string;
  petId: string;
  ownerUserId: string;
  clinicId: string;
  vetUserId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
}

export interface PaymentSucceededPayload {
  appointmentId: string;
  invoiceId: string;
  paymentId: string;
  clinicId: string;
  ownerUserId: string;
  petId: string;
  total: number;
  provider: string;
}

export interface TelemedRoomReadyPayload {
  appointmentId: string;
  roomUrl: string;
  roomCode: string;
  clinicId: string;
  ownerUserId: string;
}

export interface EhrUpdatedPayload {
  petId: string;
  clinicId: string;
  ownerUserId: string;
  actorUserId: string;
  kind: "RECORD" | "VACCINATION" | "PRESCRIPTION";
}

export interface PetCreatedPayload {
  petId: string;
  ownerUserId: string;
  clinicId: string;
  species: string;
}

export interface EventPayloadMap {
  "pet.created": PetCreatedPayload;
  "appointment.created": AppointmentEventPayload;
  "appointment.confirmed": AppointmentEventPayload;
  "appointment.completed": AppointmentEventPayload;
  "payment.succeeded": PaymentSucceededPayload;
  "telemed.room.ready": TelemedRoomReadyPayload;
  "ehr.record.updated": EhrUpdatedPayload;
}

export type EventName = keyof EventPayloadMap;

export interface DomainEvent<T extends EventName = EventName> {
  name: T;
  occurredAt: string;
  correlationId: string;
  payload: EventPayloadMap[T];
}

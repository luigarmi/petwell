export enum UserRole {
  SUPERADMIN = 'superadmin',
  CLINIC_ADMIN = 'clinic_admin',
  VETERINARIAN = 'veterinarian',
  RECEPTIONIST = 'receptionist',
  PET_OWNER = 'pet_owner'
}

export enum Permission {
  USERS_READ = 'users.read',
  USERS_WRITE = 'users.write',
  CLINICS_READ = 'clinics.read',
  CLINICS_WRITE = 'clinics.write',
  PETS_READ = 'pets.read',
  PETS_WRITE = 'pets.write',
  EHR_READ = 'ehr.read',
  EHR_WRITE = 'ehr.write',
  APPOINTMENTS_READ = 'appointments.read',
  APPOINTMENTS_WRITE = 'appointments.write',
  TELEMED_READ = 'telemed.read',
  TELEMED_WRITE = 'telemed.write',
  BILLING_READ = 'billing.read',
  BILLING_WRITE = 'billing.write',
  ANALYTICS_READ = 'analytics.read',
  NOTIFICATIONS_READ = 'notifications.read',
  NOTIFICATIONS_WRITE = 'notifications.write'
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPERADMIN]: Object.values(Permission),
  [UserRole.CLINIC_ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.CLINICS_READ,
    Permission.CLINICS_WRITE,
    Permission.PETS_READ,
    Permission.PETS_WRITE,
    Permission.EHR_READ,
    Permission.EHR_WRITE,
    Permission.APPOINTMENTS_READ,
    Permission.APPOINTMENTS_WRITE,
    Permission.TELEMED_READ,
    Permission.TELEMED_WRITE,
    Permission.BILLING_READ,
    Permission.ANALYTICS_READ,
    Permission.NOTIFICATIONS_READ
  ],
  [UserRole.VETERINARIAN]: [
    Permission.CLINICS_READ,
    Permission.PETS_READ,
    Permission.PETS_WRITE,
    Permission.EHR_READ,
    Permission.EHR_WRITE,
    Permission.APPOINTMENTS_READ,
    Permission.APPOINTMENTS_WRITE,
    Permission.TELEMED_READ,
    Permission.TELEMED_WRITE,
    Permission.BILLING_READ,
    Permission.NOTIFICATIONS_READ
  ],
  [UserRole.RECEPTIONIST]: [
    Permission.CLINICS_READ,
    Permission.PETS_READ,
    Permission.PETS_WRITE,
    Permission.EHR_READ,
    Permission.APPOINTMENTS_READ,
    Permission.APPOINTMENTS_WRITE,
    Permission.BILLING_READ,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_WRITE
  ],
  [UserRole.PET_OWNER]: [
    Permission.PETS_READ,
    Permission.PETS_WRITE,
    Permission.APPOINTMENTS_READ,
    Permission.APPOINTMENTS_WRITE,
    Permission.BILLING_READ,
    Permission.TELEMED_READ,
    Permission.NOTIFICATIONS_READ
  ]
};

export enum AppointmentType {
  IN_PERSON = 'in_person',
  TELEMED = 'telemed',
  CHECKUP = 'checkup',
  VACCINATION = 'vaccination',
  EMERGENCY = 'emergency'
}

export enum AppointmentStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show'
}

export enum PaymentStatus {
  CREATED = 'created',
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum PaymentProviderName {
  MOCK = 'mock',
  WOMPI = 'wompi',
  MERCADOPAGO = 'mercadopago'
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

export enum TelemedProviderName {
  MOCK = 'mock',
  TWILIO = 'twilio',
  DAILY = 'daily'
}

export enum PetSex {
  MALE = 'male',
  FEMALE = 'female',
  UNKNOWN = 'unknown'
}

export enum PetSpecies {
  DOG = 'dog',
  CAT = 'cat',
  BIRD = 'bird',
  RABBIT = 'rabbit',
  OTHER = 'other'
}

export interface JwtUserClaims {
  sub: string;
  email: string;
  role: UserRole;
  clinicIds: string[];
  permissions: Permission[];
}

export interface ApiResponse<T> {
  data: T;
  correlationId?: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ClinicServiceCatalogItem {
  id: string;
  clinicId: string;
  appointmentType: AppointmentType;
  name: string;
  durationMinutes: number;
  priceCop: number;
  isTelemedAvailable: boolean;
}

export interface AppointmentCreatedEvent {
  eventId: string;
  appointmentId: string;
  ownerId: string;
  petId: string;
  clinicId: string;
  veterinarianId: string;
  appointmentType: AppointmentType;
  startsAt: string;
  amountCop: number;
  status: AppointmentStatus;
}

export interface AppointmentLifecycleEvent {
  eventId: string;
  appointmentId: string;
  clinicId: string;
  ownerId: string;
  petId: string;
  status: AppointmentStatus;
  reason?: string;
}

export interface PaymentCreatedEvent {
  eventId: string;
  paymentId: string;
  appointmentId: string;
  ownerId: string;
  clinicId: string;
  provider: PaymentProviderName;
  amountCop: number;
  appointmentType?: AppointmentType;
  veterinarianId?: string;
  startsAt?: string;
  status: PaymentStatus;
}

export interface PaymentSettledEvent {
  eventId: string;
  paymentId: string;
  appointmentId: string;
  ownerId: string;
  clinicId: string;
  provider: PaymentProviderName;
  amountCop: number;
  appointmentType?: AppointmentType;
  veterinarianId?: string;
  startsAt?: string;
  status: PaymentStatus;
  externalReference?: string;
}

export interface TelemedRoomCreatedEvent {
  eventId: string;
  roomId: string;
  appointmentId: string;
  clinicId: string;
  ownerId: string;
  veterinarianId: string;
  roomUrl: string;
  expiresAt: string;
}

export interface NotificationRequestedEvent {
  eventId: string;
  channel: NotificationChannel;
  userId?: string;
  clinicId?: string;
  recipient: string;
  subject: string;
  template: string;
  variables: Record<string, string | number>;
}

export interface EhrRecordAccessedEvent {
  eventId: string;
  recordId: string;
  petId: string;
  actorUserId: string;
  actorRole: UserRole;
  clinicId?: string;
  reason?: string;
  accessedAt: string;
}

export interface EventEnvelope<TPayload> {
  eventName: string;
  occurredAt: string;
  payload: TPayload;
}

export const EVENT_NAMES = {
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_COMPLETED: 'appointment.completed',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  TELEMED_ROOM_CREATED: 'telemed.room.created',
  NOTIFICATION_REQUESTED: 'notification.requested',
  EHR_RECORD_ACCESSED: 'ehr.record.accessed'
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export const DEMO_IDS = {
  users: {
    superadmin: 'user_superadmin',
    clinicAdminNorth: 'user_clinic_admin_north',
    clinicAdminSouth: 'user_clinic_admin_south',
    veterinarianNorthPrimary: 'user_vet_north_primary',
    veterinarianNorthSecondary: 'user_vet_north_secondary',
    veterinarianSouthPrimary: 'user_vet_south_primary',
    receptionistNorth: 'user_receptionist_north',
    receptionistSouth: 'user_receptionist_south',
    ownerAna: 'user_owner_ana',
    ownerBruno: 'user_owner_bruno',
    ownerCarla: 'user_owner_carla',
    ownerDiego: 'user_owner_diego',
    ownerElena: 'user_owner_elena'
  },
  clinics: {
    north: 'clinic_north',
    south: 'clinic_south'
  },
  pets: {
    luna: 'pet_luna',
    max: 'pet_max',
    nina: 'pet_nina',
    rocky: 'pet_rocky',
    coco: 'pet_coco',
    mia: 'pet_mia',
    simba: 'pet_simba',
    kiara: 'pet_kiara'
  },
  appointments: {
    inPersonNorth: 'appointment_in_person_north',
    telemedNorth: 'appointment_telemed_north',
    vaccineSouth: 'appointment_vaccine_south',
    checkupSouth: 'appointment_checkup_south',
    reminder24hNorth: 'appointment_reminder_24h_north',
    reminder2hNorth: 'appointment_reminder_2h_north',
    completedNorth: 'appointment_completed_north',
    telemedCompletedNorth: 'appointment_telemed_completed_north',
    noShowNorth: 'appointment_no_show_north',
    emergencySouthCompleted: 'appointment_emergency_completed_south'
  },
  payments: {
    northApproved: 'payment_north_approved',
    northPending: 'payment_north_pending',
    southApproved: 'payment_south_approved',
    southFailed: 'payment_south_failed',
    reminder24hApproved: 'payment_reminder_24h_approved',
    reminder2hApproved: 'payment_reminder_2h_approved',
    northCompletedApproved: 'payment_north_completed_approved',
    northTelemedApproved: 'payment_north_telemed_approved',
    northNoShowApproved: 'payment_north_no_show_approved',
    southRefunded: 'payment_south_refunded'
  },
  ehr: {
    lunaConsultation: 'ehr_luna_consultation',
    maxConsultation: 'ehr_max_consultation',
    ninaConsultation: 'ehr_nina_consultation',
    rockyConsultation: 'ehr_rocky_consultation',
    lunaFollowUp: 'ehr_luna_follow_up',
    maxFollowUp: 'ehr_max_follow_up'
  }
} as const;

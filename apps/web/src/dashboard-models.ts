export type Role = "OWNER" | "CLINIC_ADMIN" | "VET" | "RECEPTIONIST" | "ADMIN";
export type Portal = "owner" | "clinic" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  roles: Role[];
  clinicIds?: string[];
  fullName?: string;
};

export type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  primaryClinicId: string;
  ownerIds: string[];
};

export type Clinic = {
  id: string;
  legalName: string;
  taxId: string;
  address: string;
  staffCount?: number;
};

export type Schedule = {
  id: string;
  clinicId: string;
  vetUserId: string;
  dayOfWeek: number;
  start: string;
  end: string;
  slotMinutes: number;
};

export type Appointment = {
  id: string;
  petId: string;
  ownerUserId: string;
  clinicId: string;
  vetUserId: string;
  type: string;
  startTime: string;
  endTime: string;
  status: string;
};

export type Notification = {
  id: string;
  category: string;
  title: string;
  message: string;
  createdAt: string;
};

export type InvoiceItem = {
  appointmentId: string;
  invoice: {
    id: string;
    total: number;
    status: string;
    issuedAt: string;
  };
  payment: {
    id: string;
    amount: number;
    provider: string;
    status: string;
  } | null;
};

export type TelemedRoom = {
  appointmentId: string;
  roomUrl: string;
  roomCode: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  status: string;
  roles: Role[];
};

export type SimpleItem = {
  id: string;
  reason?: string;
  notes?: string;
  vaccineCode?: string;
  date?: string;
  drug?: string;
  dose?: string;
};

export type AnalyticsSummary = {
  global: {
    date: string;
    activeClinics: number;
    registeredPets: number;
    totalAppointments: number;
    telemedCount: number;
    revenue: number;
  } | null;
  clinics: Array<{
    date: string;
    clinicId: string;
    occupancy: number;
    revenue: number;
    appointments: number;
  }>;
};

export type Metric = {
  label: string;
  value: string;
  detail: string;
};

export const ROLE_OPTIONS: Role[] = ["OWNER", "CLINIC_ADMIN", "VET", "RECEPTIONIST", "ADMIN"];

export function hasRole(user: SessionUser | null, role: Role) {
  return Boolean(user?.roles.includes(role));
}

export function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function getAvailablePortals(user: SessionUser | null): Portal[] {
  if (!user) {
    return [];
  }

  const portals: Portal[] = [];
  if (user.roles.includes("OWNER")) {
    portals.push("owner");
  }
  if (user.roles.some((role) => ["CLINIC_ADMIN", "VET", "RECEPTIONIST"].includes(role))) {
    portals.push("clinic");
  }
  if (user.roles.includes("ADMIN")) {
    portals.push("admin");
  }

  return portals;
}

export function getDefaultPortal(user: SessionUser | null): Portal | null {
  if (!user) {
    return null;
  }
  if (user.roles.includes("ADMIN")) {
    return "admin";
  }
  if (user.roles.some((role) => ["CLINIC_ADMIN", "VET", "RECEPTIONIST"].includes(role))) {
    return "clinic";
  }
  if (user.roles.includes("OWNER")) {
    return "owner";
  }
  return null;
}

export function portalTitle(portal: Portal) {
  switch (portal) {
    case "owner":
      return "Inicio";
    case "clinic":
      return "Atencion";
    case "admin":
      return "Gestion";
  }
}

export function portalDescription(portal: Portal) {
  switch (portal) {
    case "owner":
      return "Tus mascotas, citas y pagos organizados en un solo lugar.";
    case "clinic":
      return "Pacientes, agenda y mensajes claros para el trabajo del dia.";
    case "admin":
      return "Personas, sedes y movimiento general con una vista simple.";
  }
}

export function roleLabel(role: Role) {
  switch (role) {
    case "OWNER":
      return "Propietario";
    case "CLINIC_ADMIN":
      return "Administrador de clinica";
    case "VET":
      return "Veterinario";
    case "RECEPTIONIST":
      return "Recepcion";
    case "ADMIN":
      return "Gestion central";
  }
}

export function appointmentTypeLabel(type: string) {
  return type === "TELEMED" ? "Video consulta" : "Consulta presencial";
}

export function appointmentStatusLabel(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Pendiente de pago";
    case "CONFIRMED":
      return "Confirmada";
    case "COMPLETED":
      return "Finalizada";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

export function userStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Cuenta activa";
    default:
      return status;
  }
}

export function notificationCategoryLabel(category: string) {
  switch (category) {
    case "SYSTEM":
      return "Novedad";
    case "ACCOUNT":
      return "Cuenta";
    case "CLINIC":
      return "Clinica";
    case "PET":
      return "Mascota";
    case "APPOINTMENT":
      return "Cita";
    case "BILLING":
      return "Pago";
    case "TELEMED":
      return "Video consulta";
    case "CLINICAL":
      return "Atencion";
    case "EHR":
      return "Atencion";
    case "MANUAL":
      return "Mensaje";
    case "SCHEDULE":
      return "Horario";
    case "GOVERNANCE":
      return "Permisos";
    default:
      return "Actualizacion";
  }
}

export function canManageStaff(user: SessionUser | null) {
  return hasRole(user, "CLINIC_ADMIN") || hasRole(user, "ADMIN");
}

export function canWriteEhr(user: SessionUser | null) {
  return hasRole(user, "CLINIC_ADMIN") || hasRole(user, "VET");
}

export function canSendNotifications(user: SessionUser | null) {
  return hasRole(user, "CLINIC_ADMIN") || hasRole(user, "RECEPTIONIST") || hasRole(user, "ADMIN");
}

export function canCompleteAppointments(user: SessionUser | null) {
  return hasRole(user, "CLINIC_ADMIN") || hasRole(user, "VET");
}

export function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

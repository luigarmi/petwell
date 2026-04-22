const roleLabels: Record<string, string> = {
  clinic_admin: 'Administrador de clinica',
  pet_owner: 'Tutor',
  receptionist: 'Recepcion',
  superadmin: 'Superadmin',
  veterinarian: 'Veterinario'
};

const statusLabels: Record<string, string> = {
  approved: 'Aprobado',
  cancelled: 'Cancelada',
  completed: 'Completada',
  confirmed: 'Confirmada',
  created: 'Creado',
  declined: 'Rechazado',
  failed: 'Con novedad',
  no_show: 'No asistio',
  partially_refunded: 'Reembolso parcial',
  pending_payment: 'Pendiente de pago'
};

const appointmentTypeLabels: Record<string, string> = {
  grooming: 'Bano y arreglo',
  in_person: 'Consulta presencial',
  surgery: 'Procedimiento',
  telemed: 'Teleconsulta',
  vaccination: 'Vacunacion'
};

const clinicLabels: Record<string, string> = {
  clinic_north: 'Sede Norte',
  clinic_south: 'Sede Sur'
};

const eventLabels: Record<string, string> = {
  'appointment.cancelled': 'Citas canceladas',
  'appointment.completed': 'Citas completadas',
  'appointment.created': 'Citas creadas',
  'ehr.record.accessed': 'Consultas a historia clinica',
  'notification.requested': 'Notificaciones solicitadas',
  'payment.created': 'Pagos iniciados',
  'payment.failed': 'Pagos con novedad',
  'payment.succeeded': 'Pagos aprobados',
  'telemed.room.created': 'Salas de teleconsulta'
};

function startCase(value?: string | null) {
  if (!value) {
    return 'Sin dato';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function statusTone(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'confirmed':
    case 'completed':
      return 'bg-mint/12 text-mint ring-1 ring-mint/15';
    case 'pending_payment':
    case 'created':
      return 'bg-paper text-navy ring-1 ring-navy/10';
    case 'cancelled':
    case 'declined':
    case 'failed':
    case 'no_show':
      return 'bg-ember/10 text-ember ring-1 ring-ember/15';
    case 'partially_refunded':
      return 'bg-black/5 text-black/70 ring-1 ring-black/5';
    default:
      return 'bg-mist text-navy ring-1 ring-navy/8';
  }
}

function roleTone(role?: string | null) {
  switch (role) {
    case 'superadmin':
      return 'bg-navy text-white';
    case 'clinic_admin':
      return 'bg-mint text-white';
    case 'veterinarian':
      return 'bg-paper text-navy ring-1 ring-navy/10';
    case 'receptionist':
      return 'bg-mist text-navy';
    default:
      return 'bg-black/5 text-black/70';
  }
}

export function formatRole(value?: string | null) {
  return roleLabels[value ?? ''] ?? startCase(value);
}

export function formatStatus(value?: string | null) {
  return statusLabels[value ?? ''] ?? startCase(value);
}

export function formatAppointmentType(value?: string | null) {
  return appointmentTypeLabels[value ?? ''] ?? startCase(value);
}

export function formatClinic(value?: string | null) {
  return clinicLabels[value ?? ''] ?? startCase(value);
}

export function formatEvent(value?: string | null) {
  return eventLabels[value ?? ''] ?? startCase(value);
}

export function formatCurrency(amount?: number | null, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount ?? 0);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function statusBadgeClassName(status?: string | null) {
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(status)}`;
}

export function roleBadgeClassName(role?: string | null) {
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleTone(role)}`;
}

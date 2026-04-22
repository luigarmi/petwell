import { AppointmentType, PetSex, PetSpecies } from '@petwell/shared-types';

const appointmentTypeLabels: Record<string, string> = {
  [AppointmentType.CHECKUP]: 'Chequeo',
  [AppointmentType.EMERGENCY]: 'Urgencia',
  [AppointmentType.IN_PERSON]: 'Consulta presencial',
  [AppointmentType.TELEMED]: 'Teleconsulta',
  [AppointmentType.VACCINATION]: 'Vacunacion'
};

const statusLabels: Record<string, string> = {
  approved: 'Aprobado',
  cancelled: 'Cancelada',
  completed: 'Completada',
  confirmed: 'Confirmada',
  created: 'Creado',
  declined: 'Rechazado',
  expired: 'Vencido',
  failed: 'Con novedad',
  no_show: 'No asistio',
  partially_refunded: 'Reembolso parcial',
  pending: 'En proceso',
  pending_payment: 'Pendiente de pago',
  queued: 'Pendiente de envio',
  refunded: 'Reembolsado',
  sent: 'Enviada'
};

const speciesLabels: Record<string, string> = {
  [PetSpecies.CAT]: 'Gato',
  [PetSpecies.DOG]: 'Perro',
  [PetSpecies.BIRD]: 'Ave',
  [PetSpecies.OTHER]: 'Otra especie'
};

const sexLabels: Record<string, string> = {
  [PetSex.FEMALE]: 'Hembra',
  [PetSex.MALE]: 'Macho',
  [PetSex.UNKNOWN]: 'Sin dato'
};

const channelLabels: Record<string, string> = {
  email: 'Correo',
  push: 'Push',
  sms: 'SMS',
  whatsapp: 'WhatsApp'
};

const notificationTemplateLabels: Record<string, string> = {
  'appointment-confirmed': 'Cita confirmada',
  'reminder-2h': 'Recordatorio cercano',
  'reminder-24h': 'Recordatorio anticipado',
  'telemed-room': 'Acceso a teleconsulta'
};

const paymentProviderLabels: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  mock: 'Pago de prueba',
  wompi: 'Wompi'
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
    case 'sent':
      return 'bg-leaf/10 text-leaf ring-1 ring-leaf/15';
    case 'pending':
    case 'pending_payment':
    case 'created':
    case 'queued':
      return 'bg-sand text-ink ring-1 ring-black/5';
    case 'cancelled':
    case 'declined':
    case 'failed':
    case 'expired':
      return 'bg-clay/12 text-clay ring-1 ring-clay/15';
    case 'partially_refunded':
    case 'refunded':
      return 'bg-black/5 text-black/70 ring-1 ring-black/5';
    default:
      return 'bg-white text-black/70 ring-1 ring-black/5';
  }
}

export function formatAppointmentType(value?: string | null) {
  return appointmentTypeLabels[value ?? ''] ?? startCase(value);
}

export function formatStatus(value?: string | null) {
  return statusLabels[value ?? ''] ?? startCase(value);
}

export function formatSpecies(value?: string | null) {
  return speciesLabels[value ?? ''] ?? startCase(value);
}

export function formatSex(value?: string | null) {
  return sexLabels[value ?? ''] ?? startCase(value);
}

export function formatNotificationChannel(value?: string | null) {
  return channelLabels[value ?? ''] ?? startCase(value);
}

export function formatNotificationLabel(subject?: string | null, template?: string | null) {
  if (subject) {
    return subject;
  }

  return notificationTemplateLabels[template ?? ''] ?? 'Actualizacion de tu cuenta';
}

export function formatPaymentProvider(value?: string | null) {
  return paymentProviderLabels[value ?? ''] ?? startCase(value);
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

export function formatDate(value?: string | null) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function formatCurrency(amount?: number | null, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount ?? 0);
}

export function formatPetAge(birthDate?: string | null) {
  if (!birthDate) {
    return 'Edad sin registrar';
  }

  const today = new Date();
  const birth = new Date(birthDate);
  const months = Math.max(0, (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth());

  if (months < 12) {
    return `${months || 1} mes${months === 1 ? '' : 'es'}`;
  }

  const years = Math.floor(months / 12);
  return `${years} ano${years === 1 ? '' : 's'}`;
}

export function formatShortReference(value?: string | null) {
  if (!value) {
    return 'Sin referencia';
  }

  return value.length <= 8 ? value.toUpperCase() : value.slice(-8).toUpperCase();
}

export function statusBadgeClassName(status?: string | null) {
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(status)}`;
}

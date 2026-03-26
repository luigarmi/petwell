import {
  type AdminUser,
  type AnalyticsSummary,
  type Appointment,
  type Clinic,
  type InvoiceItem,
  type Metric,
  type Notification,
  type Pet,
  type Portal,
  type SimpleItem,
  type TelemedRoom
} from "./dashboard-models.js";

export function buildMetrics(
  portal: Portal | null,
  data: {
    pets: Pet[];
    clinics: Clinic[];
    appointments: Appointment[];
    notifications: Notification[];
    invoices: InvoiceItem[];
    telemedRooms: TelemedRoom[];
    adminUsers: AdminUser[];
    analytics: AnalyticsSummary | null;
  }
): Metric[] {
  const pets = Array.isArray(data.pets) ? data.pets : [];
  const clinics = Array.isArray(data.clinics) ? data.clinics : [];
  const appointments = Array.isArray(data.appointments) ? data.appointments : [];
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const telemedRooms = Array.isArray(data.telemedRooms) ? data.telemedRooms : [];
  const adminUsers = Array.isArray(data.adminUsers) ? data.adminUsers : [];

  if (portal === "clinic") {
    return [
      {
        label: "Pacientes",
        value: String(pets.length),
        detail: "Mascotas atendidas por tu equipo"
      },
      {
        label: "Citas",
        value: String(appointments.length),
        detail: "Consultas programadas"
      },
      {
        label: "Mensajes",
        value: String(notifications.length),
        detail: "Novedades recientes"
      },
      {
        label: "Ingresos",
        value: `$${Math.round(data.analytics?.global?.revenue ?? 0).toLocaleString("es-CO")}`,
        detail: "Resumen del periodo"
      }
    ];
  }

  if (portal === "admin") {
    return [
      {
        label: "Usuarios",
        value: String(adminUsers.length),
        detail: "Personas registradas"
      },
      {
        label: "Sedes",
        value: String(clinics.length),
        detail: "Clinicas activas"
      },
      {
        label: "Actividad",
        value: String(notifications.length),
        detail: "Movimientos recientes"
      },
      {
        label: "Ingresos",
        value: `$${Math.round(data.analytics?.global?.revenue ?? 0).toLocaleString("es-CO")}`,
        detail: "Total acumulado"
      }
    ];
  }

  return [
    {
      label: "Mascotas",
      value: String(pets.length),
      detail: "Perfiles creados"
    },
    {
      label: "Citas",
      value: String(appointments.length),
      detail: "Consultas programadas"
    },
    {
      label: "Pagos",
      value: String(invoices.length),
      detail: "Comprobantes disponibles"
    },
    {
      label: "Video llamadas",
      value: String(telemedRooms.length),
      detail: "Consultas virtuales listas"
    }
  ];
}

export function HistoryColumns(props: {
  records: SimpleItem[];
  vaccinations: SimpleItem[];
  prescriptions: SimpleItem[];
}) {
  return (
    <div className="history-grid">
      <article className="history-card">
        <strong>Consultas</strong>
        {props.records.length ? (
          props.records.map((item) => (
            <span key={item.id}>
              {item.reason}: {item.notes}
            </span>
          ))
        ) : (
          <span className="muted">Todavia no hay notas de consulta para mostrar.</span>
        )}
      </article>

      <article className="history-card">
        <strong>Vacunas</strong>
        {props.vaccinations.length ? (
          props.vaccinations.map((item) => (
            <span key={item.id}>
              {item.vaccineCode} / {item.date}
            </span>
          ))
        ) : (
          <span className="muted">Todavia no hay vacunas registradas.</span>
        )}
      </article>

      <article className="history-card">
        <strong>Tratamientos</strong>
        {props.prescriptions.length ? (
          props.prescriptions.map((item) => (
            <span key={item.id}>
              {item.drug} / {item.dose}
            </span>
          ))
        ) : (
          <span className="muted">Todavia no hay tratamientos registrados.</span>
        )}
      </article>
    </div>
  );
}

export function EmptyState(props: { text: string }) {
  return <p className="empty-state">{props.text}</p>;
}

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
  if (portal === "clinic") {
    return [
      {
        label: "Pacientes",
        value: String(data.pets.length),
        detail: "Mascotas atendidas por tu equipo"
      },
      {
        label: "Citas",
        value: String(data.appointments.length),
        detail: "Consultas programadas"
      },
      {
        label: "Mensajes",
        value: String(data.notifications.length),
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
        value: String(data.adminUsers.length),
        detail: "Personas registradas"
      },
      {
        label: "Sedes",
        value: String(data.clinics.length),
        detail: "Clinicas activas"
      },
      {
        label: "Actividad",
        value: String(data.notifications.length),
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
      value: String(data.pets.length),
      detail: "Perfiles creados"
    },
    {
      label: "Citas",
      value: String(data.appointments.length),
      detail: "Consultas programadas"
    },
    {
      label: "Pagos",
      value: String(data.invoices.length),
      detail: "Comprobantes disponibles"
    },
    {
      label: "Video llamadas",
      value: String(data.telemedRooms.length),
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

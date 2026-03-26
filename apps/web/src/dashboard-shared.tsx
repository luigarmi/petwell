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
        detail: "Mascotas visibles para la sede"
      },
      {
        label: "Citas",
        value: String(data.appointments.length),
        detail: "Agenda cargada en el portal clinico"
      },
      {
        label: "Avisos",
        value: String(data.notifications.length),
        detail: "Notificaciones operativas"
      },
      {
        label: "Revenue",
        value: `$${Math.round(data.analytics?.global?.revenue ?? 0).toLocaleString("es-CO")}`,
        detail: "Resumen segun eventos procesados"
      }
    ];
  }

  if (portal === "admin") {
    return [
      {
        label: "Usuarios",
        value: String(data.adminUsers.length),
        detail: "Usuarios cargados para asignacion de roles"
      },
      {
        label: "Sedes",
        value: String(data.clinics.length),
        detail: "Clinicas registradas en la plataforma"
      },
      {
        label: "Eventos",
        value: String(data.notifications.length),
        detail: "Actividad reciente del ecosistema"
      },
      {
        label: "Revenue",
        value: `$${Math.round(data.analytics?.global?.revenue ?? 0).toLocaleString("es-CO")}`,
        detail: "Ingreso agregado disponible"
      }
    ];
  }

  return [
    {
      label: "Mascotas",
      value: String(data.pets.length),
      detail: "Perfiles registrados"
    },
    {
      label: "Citas",
      value: String(data.appointments.length),
      detail: "Agenda activa del propietario"
    },
    {
      label: "Facturas",
      value: String(data.invoices.length),
      detail: "Pagos e invoices asociados"
    },
    {
      label: "Salas",
      value: String(data.telemedRooms.length),
      detail: "Telemedicina lista para usar"
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
        <strong>Records</strong>
        {props.records.length ? (
          props.records.map((item) => (
            <span key={item.id}>
              {item.reason}: {item.notes}
            </span>
          ))
        ) : (
          <span className="muted">Sin registros clinicos visibles.</span>
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
          <span className="muted">Sin vacunaciones visibles.</span>
        )}
      </article>

      <article className="history-card">
        <strong>Prescripciones</strong>
        {props.prescriptions.length ? (
          props.prescriptions.map((item) => (
            <span key={item.id}>
              {item.drug} / {item.dose}
            </span>
          ))
        ) : (
          <span className="muted">Sin prescripciones visibles.</span>
        )}
      </article>
    </div>
  );
}

export function EmptyState(props: { text: string }) {
  return <p className="empty-state">{props.text}</p>;
}

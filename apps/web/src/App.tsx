import { FormEvent, useEffect, useState } from "react";
import { api } from "./api.js";
import { ActivityRail, AdminPortal, ClinicPortal, OwnerPortal } from "./portal-sections.js";
import {
  getAvailablePortals,
  getDefaultPortal,
  portalDescription,
  portalTitle,
  settledValue,
  type AdminUser,
  type AnalyticsSummary,
  type Appointment,
  type Clinic,
  type InvoiceItem,
  type Notification,
  type Pet,
  type Portal,
  type Schedule,
  type SessionUser,
  type SimpleItem,
  type TelemedRoom,
  type Role
} from "./dashboard-models.js";
import { buildMetrics } from "./dashboard-shared.js";

function readStoredUser() {
  const raw = localStorage.getItem("petwell_user");
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

function summarizeSyncFailures(failures: string[]) {
  if (!failures.length) {
    return "Portal sincronizado y listo para operar.";
  }

  return `Vista cargada. Falta sincronizar: ${failures.join(", ")}.`;
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("petwell_token"));
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser());
  const [activePortal, setActivePortal] = useState<Portal | null>(() => getDefaultPortal(readStoredUser()));
  const [status, setStatus] = useState("Conecta la plataforma y entra con tu rol.");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [pets, setPets] = useState<Pet[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [telemedRooms, setTelemedRooms] = useState<TelemedRoom[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [records, setRecords] = useState<SimpleItem[]>([]);
  const [vaccinations, setVaccinations] = useState<SimpleItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<SimpleItem[]>([]);

  const availablePortals = getAvailablePortals(user);
  const currentPortal = activePortal && availablePortals.includes(activePortal) ? activePortal : getDefaultPortal(user);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const metrics = buildMetrics(currentPortal, {
    pets,
    clinics,
    appointments,
    notifications,
    invoices,
    telemedRooms,
    adminUsers,
    analytics
  });

  async function persistAndLoad(nextToken: string, nextUser: SessionUser) {
    localStorage.setItem("petwell_token", nextToken);
    localStorage.setItem("petwell_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setActivePortal(getDefaultPortal(nextUser));
    await loadDashboard(nextToken);
  }

  async function loadDashboard(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setLoading(true);
    try {
      const me = await api<{ user: SessionUser }>("/users/me", currentToken);
      setUser(me.user);

      const canSeeTelemed = me.user.roles.includes("OWNER") || me.user.roles.includes("ADMIN");
      const canSeeAnalytics =
        me.user.roles.includes("ADMIN") ||
        me.user.roles.includes("CLINIC_ADMIN") ||
        me.user.roles.includes("VET") ||
        me.user.roles.includes("RECEPTIONIST");
      const canSeeUsers = me.user.roles.includes("ADMIN");

      const [
        clinicsResult,
        schedulesResult,
        appointmentsResult,
        notificationsResult,
        petsResult,
        invoicesResult,
        telemedResult,
        analyticsResult,
        usersResult
      ] = await Promise.allSettled([
        api<{ clinics: Clinic[] }>("/users/clinics", currentToken),
        api<{ schedules: Schedule[] }>("/appointments/schedules", currentToken),
        api<{ appointments: Appointment[] }>("/appointments", currentToken),
        api<{ notifications: Notification[] }>("/notifications", currentToken),
        api<{ pets: Pet[] }>("/pets", currentToken),
        api<{ invoices: InvoiceItem[] }>("/payments/invoices", currentToken),
        canSeeTelemed ? api<{ rooms: TelemedRoom[] }>("/telemed/rooms", currentToken) : Promise.resolve({ rooms: [] }),
        canSeeAnalytics ? api<AnalyticsSummary>("/analytics/summary", currentToken) : Promise.resolve(null),
        canSeeUsers ? api<{ users: AdminUser[] }>("/users/admin/users", currentToken) : Promise.resolve({ users: [] })
      ]);

      setClinics(settledValue(clinicsResult, { clinics: [] }).clinics);
      setSchedules(settledValue(schedulesResult, { schedules: [] }).schedules);
      setAppointments(settledValue(appointmentsResult, { appointments: [] }).appointments);
      setNotifications(settledValue(notificationsResult, { notifications: [] }).notifications);
      setInvoices(settledValue(invoicesResult, { invoices: [] }).invoices);
      setTelemedRooms(settledValue(telemedResult, { rooms: [] }).rooms);
      setAnalytics(canSeeAnalytics ? settledValue(analyticsResult, null) : null);
      setAdminUsers(settledValue(usersResult, { users: [] }).users);

      const nextPets = settledValue(petsResult, { pets: [] }).pets;
      setPets(nextPets);
      setSelectedPetId((current) => {
        if (nextPets.some((pet) => pet.id === current)) {
          return current;
        }
        return nextPets[0]?.id ?? "";
      });

      const failedModules = [
        clinicsResult.status === "rejected" ? "sedes" : null,
        schedulesResult.status === "rejected" ? "horarios" : null,
        appointmentsResult.status === "rejected" ? "agenda" : null,
        notificationsResult.status === "rejected" ? "avisos" : null,
        petsResult.status === "rejected" ? "mascotas" : null,
        invoicesResult.status === "rejected" ? "facturacion" : null,
        telemedResult.status === "rejected" ? "telemedicina" : null,
        analyticsResult.status === "rejected" ? "analitica" : null,
        usersResult.status === "rejected" ? "usuarios" : null
      ].filter(Boolean) as string[];

      setStatus(summarizeSyncFailures(failedModules));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible sincronizar el portal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClinicalData(petId: string, currentToken = token) {
    if (!currentToken || !petId) {
      setRecords([]);
      setVaccinations([]);
      setPrescriptions([]);
      return;
    }

    const [recordsResult, vaccinationsResult, prescriptionsResult] = await Promise.allSettled([
      api<{ records: SimpleItem[] }>(`/ehr/pets/${petId}/records`, currentToken),
      api<{ vaccinations: SimpleItem[] }>(`/ehr/pets/${petId}/vaccinations`, currentToken),
      api<{ prescriptions: SimpleItem[] }>(`/ehr/pets/${petId}/prescriptions`, currentToken)
    ]);

    setRecords(settledValue(recordsResult, { records: [] }).records);
    setVaccinations(settledValue(vaccinationsResult, { vaccinations: [] }).vaccinations);
    setPrescriptions(settledValue(prescriptionsResult, { prescriptions: [] }).prescriptions);
  }

  useEffect(() => {
    if (token) {
      void loadDashboard(token);
    }
  }, [token]);

  useEffect(() => {
    const nextDefault = getDefaultPortal(user);
    if (!currentPortal && nextDefault) {
      setActivePortal(nextDefault);
      return;
    }
    if (currentPortal && !availablePortals.includes(currentPortal)) {
      setActivePortal(nextDefault);
    }
  }, [availablePortals, currentPortal, user]);

  useEffect(() => {
    if (token && selectedPetId && currentPortal !== "admin") {
      void loadClinicalData(selectedPetId, token);
      return;
    }

    if (!selectedPetId || currentPortal === "admin") {
      setRecords([]);
      setVaccinations([]);
      setPrescriptions([]);
    }
  }, [currentPortal, selectedPetId, token]);

  function logout() {
    localStorage.removeItem("petwell_token");
    localStorage.removeItem("petwell_user");
    setToken(null);
    setUser(null);
    setActivePortal(null);
    setStatus("Sesion cerrada.");
  }

  async function submitJson(path: string, body: Record<string, unknown>, method = "POST") {
    if (!token) {
      return;
    }

    try {
      await api(path, token, {
        method,
        body: JSON.stringify(body)
      });
      setStatus("Operacion completada correctamente.");
      await loadDashboard(token);
      if (selectedPetId && currentPortal !== "admin") {
        await loadClinicalData(selectedPetId, token);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible completar la accion.");
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (authMode === "register") {
        const response = await api<{ token: string; user: SessionUser }>("/users/register", undefined, {
          method: "POST",
          body: JSON.stringify({
            email,
            phone: String(formData.get("phone") ?? ""),
            password,
            fullName: String(formData.get("fullName") ?? "")
          })
        });
        await persistAndLoad(response.token, response.user);
        setStatus("Cuenta OWNER creada y lista para usar.");
      } else {
        const response = await api<{ token: string; user: SessionUser }>("/users/login", undefined, {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        await persistAndLoad(response.token, response.user);
        setStatus("Sesion iniciada.");
      }

      event.currentTarget.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible autenticar la sesion.");
    }
  }

  async function updateRoles(userId: string, roles: Role[]) {
    await submitJson(`/users/admin/users/${userId}/roles`, { roles }, "PUT");
  }

  async function payAppointment(appointmentId: string) {
    await submitJson("/payments", {
      appointmentId,
      provider: "SIMULATED",
      amount: 95000
    });
  }

  if (!token || !user || !currentPortal) {
    return (
      <main className="app-shell landing-shell theme-owner">
        <section className="landing-hero">
          <div className="brand-lockup">
            <span className="brand-badge">PetWell</span>
            <span className="hero-note">Veterinaria digital para propietarios, sedes y administracion</span>
          </div>
          <h1>Una experiencia clara para cuidar mascotas sin mezclar operacion, clinica y gobierno.</h1>
          <p>
            La plataforma centraliza agenda, EHR, pagos, telemedicina y analitica. Cada rol entra a su propio
            portal para evitar ruido visual y errores de operacion.
          </p>

          <div className="hero-highlights">
            <article>
              <strong>Portal propietario</strong>
              <span>Mascotas, consentimientos, citas, pagos y seguimiento.</span>
            </article>
            <article>
              <strong>Portal clinico</strong>
              <span>Agenda, pacientes, registros, staff y mensajeria operativa.</span>
            </article>
            <article>
              <strong>Portal admin</strong>
              <span>Usuarios, roles, sedes y supervision global del ecosistema.</span>
            </article>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-toggle">
            <button
              type="button"
              className={authMode === "login" ? "is-active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Ingresar
            </button>
            <button
              type="button"
              className={authMode === "register" ? "is-active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Crear cuenta
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuth}>
            {authMode === "register" ? <input name="fullName" placeholder="Nombre completo" required /> : null}
            <input name="email" type="email" placeholder="Correo" required />
            {authMode === "register" ? <input name="phone" placeholder="Telefono" required /> : null}
            <input name="password" type="password" placeholder="Contrasena" required />
            <button type="submit">{authMode === "register" ? "Crear cuenta OWNER" : "Entrar a PetWell"}</button>
          </form>

          <div className="status-card">
            <span className="mini-label">Estado</span>
            <strong>{status}</strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell workspace-shell theme-${currentPortal}`}>
      <header className="workspace-topbar">
        <div>
          <div className="brand-lockup compact">
            <span className="brand-badge">PetWell</span>
            <span className="hero-note">{portalTitle(currentPortal)}</span>
          </div>
          <h1>{user.fullName ?? user.email}</h1>
          <p>{portalDescription(currentPortal)}</p>
        </div>

        <div className="topbar-actions">
          <div className="chip-row">
            {user.roles.map((role) => (
              <span key={role} className="soft-chip">
                {role}
              </span>
            ))}
          </div>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={() => void loadDashboard(token)}>
              {loading ? "Sincronizando..." : "Actualizar"}
            </button>
            <button type="button" className="secondary-button" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="hero-note">Experiencia activa</span>
          <h2>{portalTitle(currentPortal)}</h2>
          <p>{portalDescription(currentPortal)}</p>
        </div>

        <div className="dashboard-hero-glance">
          <article className="hero-stat-card">
            <span>Estado del portal</span>
            <strong>{loading ? "Sincronizando" : "Operativo"}</strong>
            <small>{status}</small>
          </article>

          <article className="hero-stat-card">
            <span>Foco actual</span>
            <strong>
              {currentPortal === "admin"
                ? "Supervision global"
                : selectedPet?.name ?? (currentPortal === "clinic" ? "Paciente por seleccionar" : "Mascota por seleccionar")}
            </strong>
            <small>
              {currentPortal === "admin"
                ? "Usuarios, sedes y metricas del ecosistema."
                : "Usa esta seleccion para seguir historia, agenda y operacion."}
            </small>
          </article>
        </div>
      </section>

      <section className="portal-switcher">
        {availablePortals.map((portal) => (
          <button
            key={portal}
            type="button"
            className={portal === currentPortal ? "is-active" : ""}
            onClick={() => setActivePortal(portal)}
          >
            <span>{portalTitle(portal)}</span>
            <small>{portalDescription(portal)}</small>
          </button>
        ))}
      </section>

      <section className="metrics-row">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-tile">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <div className="workspace-main">
          {currentPortal === "owner" ? (
            <OwnerPortal
              clinics={clinics}
              pets={pets}
              schedules={schedules}
              appointments={appointments}
              invoices={invoices}
              telemedRooms={telemedRooms}
              selectedPetId={selectedPetId}
              setSelectedPetId={setSelectedPetId}
              records={records}
              vaccinations={vaccinations}
              prescriptions={prescriptions}
              submitJson={submitJson}
              payAppointment={payAppointment}
            />
          ) : null}

          {currentPortal === "clinic" ? (
            <ClinicPortal
              user={user}
              clinics={clinics}
              pets={pets}
              appointments={appointments}
              analytics={analytics}
              notifications={notifications}
              selectedPetId={selectedPetId}
              setSelectedPetId={setSelectedPetId}
              records={records}
              vaccinations={vaccinations}
              prescriptions={prescriptions}
              submitJson={submitJson}
            />
          ) : null}

          {currentPortal === "admin" ? (
            <AdminPortal
              clinics={clinics}
              users={adminUsers}
              analytics={analytics}
              updateRoles={updateRoles}
              submitJson={submitJson}
            />
          ) : null}
        </div>

        <aside className="workspace-rail">
          <ActivityRail
            status={status}
            loading={loading}
            notifications={notifications}
            selectedPetName={selectedPet?.name}
            portalTitle={portalTitle(currentPortal)}
          />
        </aside>
      </section>
    </main>
  );
}

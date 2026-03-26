import { FormEvent, useEffect, useRef, useState } from "react";
import { api, isUsingDemoBackend } from "./api.js";
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
import { getDemoCredentials } from "./demo-backend.js";

const LANDING_STATUS = "Ingresa o crea tu cuenta para empezar.";

function readStoredUser() {
  const raw = localStorage.getItem("petwell_user");
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

function scheduleScrollToTop() {
  if (typeof window === "undefined") {
    return;
  }

  scrollToTop();
  window.requestAnimationFrame(() => {
    scrollToTop();
    window.setTimeout(scrollToTop, 0);
  });
}

function summarizeSyncFailures(failures: string[]) {
  if (!failures.length) {
    return "Todo esta listo para ti.";
  }

  return "Algunas secciones se estan actualizando. Puedes seguir usando el resto de la plataforma.";
}

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("petwell_token"));
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser());
  const [activePortal, setActivePortal] = useState<Portal | null>(() => getDefaultPortal(readStoredUser()));
  const [status, setStatus] = useState(LANDING_STATUS);
  const [demoMode, setDemoMode] = useState(() => isUsingDemoBackend());
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
  const activeTokenRef = useRef<string | null>(token);

  const availablePortals = getAvailablePortals(user);
  const currentPortal = activePortal && availablePortals.includes(activePortal) ? activePortal : getDefaultPortal(user);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const showLandingStatus = status !== LANDING_STATUS;
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
  const demoCredentials = getDemoCredentials();

  function decorateStatus(message: string) {
    return message;
  }

  function isCurrentRequest(requestToken: string | null) {
    return activeTokenRef.current === requestToken;
  }

  function resetWorkspaceData() {
    setPets([]);
    setClinics([]);
    setSchedules([]);
    setAppointments([]);
    setNotifications([]);
    setInvoices([]);
    setTelemedRooms([]);
    setAdminUsers([]);
    setAnalytics(null);
    setSelectedPetId("");
    setRecords([]);
    setVaccinations([]);
    setPrescriptions([]);
    setLoading(false);
  }

  async function persistAndLoad(nextToken: string, nextUser: SessionUser) {
    localStorage.setItem("petwell_token", nextToken);
    localStorage.setItem("petwell_user", JSON.stringify(nextUser));
    activeTokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    setActivePortal(getDefaultPortal(nextUser));
    scheduleScrollToTop();
    await loadDashboard(nextToken);
  }

  async function loadDashboard(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setLoading(true);
    try {
      const me = await api<{ user: SessionUser }>("/users/me", currentToken);
      if (!isCurrentRequest(currentToken)) {
        return;
      }
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

      if (!isCurrentRequest(currentToken)) {
        return;
      }

      setClinics(asArray(settledValue(clinicsResult, { clinics: [] }).clinics));
      setSchedules(asArray(settledValue(schedulesResult, { schedules: [] }).schedules));
      setAppointments(asArray(settledValue(appointmentsResult, { appointments: [] }).appointments));
      setNotifications(asArray(settledValue(notificationsResult, { notifications: [] }).notifications));
      setInvoices(asArray(settledValue(invoicesResult, { invoices: [] }).invoices));
      setTelemedRooms(asArray(settledValue(telemedResult, { rooms: [] }).rooms));
      setAnalytics(canSeeAnalytics ? settledValue(analyticsResult, null) : null);
      setAdminUsers(asArray(settledValue(usersResult, { users: [] }).users));

      const nextPets = asArray(settledValue(petsResult, { pets: [] }).pets);
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

      setStatus(decorateStatus(summarizeSyncFailures(failedModules)));
    } catch (error) {
      if (!isCurrentRequest(currentToken)) {
        return;
      }
      setStatus(decorateStatus(error instanceof Error ? error.message : "No pudimos cargar tu informacion ahora mismo."));
    } finally {
      if (isCurrentRequest(currentToken)) {
        setLoading(false);
      }
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

    setRecords(asArray(settledValue(recordsResult, { records: [] }).records));
    setVaccinations(asArray(settledValue(vaccinationsResult, { vaccinations: [] }).vaccinations));
    setPrescriptions(asArray(settledValue(prescriptionsResult, { prescriptions: [] }).prescriptions));
  }

  useEffect(() => {
    activeTokenRef.current = token;

    if (token) {
      void loadDashboard(token);
      return;
    }

    resetWorkspaceData();
  }, [token]);

  useEffect(() => {
    scheduleScrollToTop();
  }, [currentPortal, token, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleRuntimeChange = (event: Event) => {
      const nextMode = (event as CustomEvent<"remote" | "demo">).detail;
      setDemoMode(nextMode === "demo");
    };

    window.addEventListener("petwell-runtime-mode", handleRuntimeChange as EventListener);
    return () => window.removeEventListener("petwell-runtime-mode", handleRuntimeChange as EventListener);
  }, []);

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
    activeTokenRef.current = null;
    setToken(null);
    setUser(null);
    setActivePortal(null);
    setAuthMode("login");
    resetWorkspaceData();
    setStatus("Tu sesion se cerro correctamente.");
    scheduleScrollToTop();
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
      setStatus(decorateStatus("Listo. Ya guardamos tu informacion."));
      await loadDashboard(token);
      if (selectedPetId && currentPortal !== "admin") {
        await loadClinicalData(selectedPetId, token);
      }
    } catch (error) {
      setStatus(decorateStatus(error instanceof Error ? error.message : "No pudimos completar este paso."));
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
        setStatus(decorateStatus("Tu cuenta ya esta lista."));
      } else {
        const response = await api<{ token: string; user: SessionUser }>("/users/login", undefined, {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        await persistAndLoad(response.token, response.user);
        setStatus(decorateStatus("Bienvenido de nuevo."));
      }

      event.currentTarget.reset();
    } catch (error) {
      setStatus(decorateStatus(error instanceof Error ? error.message : "No pudimos iniciar tu sesion."));
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

  async function openQuickAccess() {
    try {
      const response = await api<{ token: string; user: SessionUser }>("/users/login", undefined, {
        method: "POST",
        body: JSON.stringify({
          email: demoCredentials.email,
          password: demoCredentials.password
        })
      });
      await persistAndLoad(response.token, response.user);
      setStatus("Listo. Ya puedes recorrer cada espacio con calma.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible abrir el recorrido.");
    }
  }

  if (!token || !user || !currentPortal) {
    return (
      <main className="app-shell landing-shell theme-owner">
        <section className="landing-hero">
          <div className="brand-lockup">
            <span className="brand-badge">PetWell</span>
            <span className="hero-note">Cuidado veterinario simple y cercano</span>
          </div>
          <h1>Todo lo importante para tu mascota, en un solo lugar.</h1>
          <p>
            Agenda citas, revisa recomendaciones, consulta el historial y manten tu informacion al dia sin vueltas ni
            pantallas confusas.
          </p>

          <div className="hero-highlights">
            <article>
              <strong>Citas sin enredos</strong>
              <span>Reserva, reprograma y sigue cada consulta desde el mismo espacio.</span>
            </article>
            <article>
              <strong>Historia siempre a mano</strong>
              <span>Vacunas, formulas y recomendaciones organizadas para cada mascota.</span>
            </article>
            <article>
              <strong>Atencion continua</strong>
              <span>Pagos, recordatorios y video consulta listos cuando los necesites.</span>
            </article>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-copy">
            <span className="mini-label">Acceso</span>
            <h2>{authMode === "register" ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
            <p>
              {authMode === "register"
                ? "Empieza en menos de un minuto y deja lista la informacion de tus mascotas."
                : "Entra para revisar citas, pagos, novedades y el cuidado de cada mascota."}
            </p>
          </div>

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
            {authMode === "register" ? <input name="fullName" placeholder="Tu nombre completo" required /> : null}
            <input name="email" type="email" placeholder="Correo electronico" required />
            {authMode === "register" ? <input name="phone" placeholder="Celular" required /> : null}
            <input name="password" type="password" placeholder="Contrasena" required />
            <button type="submit">{authMode === "register" ? "Crear mi cuenta" : "Entrar"}</button>
          </form>

          {showLandingStatus ? (
            <div className="status-card">
              <span className="mini-label">Mensaje</span>
              <strong>{status}</strong>
            </div>
          ) : null}

          {demoMode ? (
            <div className="status-card quick-access-card">
              <span className="mini-label">Recorrido guiado</span>
              <strong>Explora la plataforma sin empezar desde cero.</strong>
              <p>
                Si quieres conocer cada espacio antes de cargar tus propios datos, entra con un recorrido ya listo.
              </p>
              <button type="button" className="secondary-button quick-access-button" onClick={() => void openQuickAccess()}>
                Explorar ahora
              </button>
            </div>
          ) : null}
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
            <span className="soft-chip">Cuenta activa</span>
            {availablePortals.length > 1 ? (
              <span className="soft-chip">{availablePortals.length} espacios disponibles</span>
            ) : null}
          </div>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={() => void loadDashboard(token)}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
            <button type="button" className="secondary-button" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="hero-note">Resumen del dia</span>
          <h2>{portalTitle(currentPortal)}</h2>
          <p>{portalDescription(currentPortal)}</p>
        </div>

        <div className="dashboard-hero-glance">
          <article className="hero-stat-card">
            <span>Estado</span>
            <strong>{loading ? "Actualizando" : "Todo en orden"}</strong>
            <small>{status}</small>
          </article>

          <article className="hero-stat-card">
            <span>Ahora mismo</span>
            <strong>
              {currentPortal === "admin" ? "Vista general" : selectedPet?.name ?? "Elige una mascota para continuar"}
            </strong>
            <small>
              {currentPortal === "admin"
                ? "Revisa personas, sedes y movimiento reciente."
                : "Al seleccionar una mascota veras su historia, citas y novedades."}
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
            onClick={() => {
              setActivePortal(portal);
              scheduleScrollToTop();
            }}
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

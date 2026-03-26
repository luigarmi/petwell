import { FormEvent, useEffect, useState } from "react";
import { api, API_BASE, dayName, formatDate } from "./api.js";
import { InlineForm, Panel } from "./components.js";

type Role = "OWNER" | "CLINIC_ADMIN" | "VET" | "RECEPTIONIST" | "ADMIN";

type SessionUser = {
  id: string;
  email: string;
  roles: Role[];
  clinicIds?: string[];
  fullName?: string;
};

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  primaryClinicId: string;
  ownerIds: string[];
};

type Clinic = {
  id: string;
  legalName: string;
  taxId: string;
  address: string;
  staffCount?: number;
};

type Schedule = {
  id: string;
  clinicId: string;
  vetUserId: string;
  dayOfWeek: number;
  start: string;
  end: string;
  slotMinutes: number;
};

type Appointment = {
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

type Notification = {
  id: string;
  category: string;
  title: string;
  message: string;
  createdAt: string;
};

type InvoiceItem = {
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

type TelemedRoom = {
  appointmentId: string;
  roomUrl: string;
  roomCode: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  status: string;
  roles: Role[];
};

type SimpleItem = {
  id: string;
  reason?: string;
  notes?: string;
  vaccineCode?: string;
  date?: string;
  drug?: string;
  dose?: string;
};

type AnalyticsSummary = {
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

function hasRole(user: SessionUser | null, role: Role) {
  return Boolean(user?.roles.includes(role));
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("petwell_token"));
  const [user, setUser] = useState<SessionUser | null>(() => {
    const raw = localStorage.getItem("petwell_user");
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  });
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

  async function persistAndLoad(nextToken: string, nextUser: SessionUser) {
    localStorage.setItem("petwell_token", nextToken);
    localStorage.setItem("petwell_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
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

      const tasks: Array<Promise<unknown>> = [
        api<{ clinics: Clinic[] }>("/users/clinics", currentToken).then((response) => setClinics(response.clinics)),
        api<{ schedules: Schedule[] }>("/appointments/schedules", currentToken).then((response) =>
          setSchedules(response.schedules)
        ),
        api<{ appointments: Appointment[] }>("/appointments", currentToken).then((response) =>
          setAppointments(response.appointments)
        ),
        api<{ notifications: Notification[] }>("/notifications", currentToken).then((response) =>
          setNotifications(response.notifications)
        ),
        api<{ pets: Pet[] }>("/pets", currentToken).then((response) => {
          setPets(response.pets);
          if (!selectedPetId && response.pets[0]) {
            setSelectedPetId(response.pets[0].id);
          }
        }),
        api<{ invoices: InvoiceItem[] }>("/payments/invoices", currentToken).then((response) =>
          setInvoices(response.invoices)
        )
      ];

      if (me.user.roles.includes("OWNER") || me.user.roles.includes("ADMIN")) {
        tasks.push(
          api<{ rooms: TelemedRoom[] }>("/telemed/rooms", currentToken).then((response) =>
            setTelemedRooms(response.rooms)
          )
        );
      } else {
        setTelemedRooms([]);
      }

      if (
        me.user.roles.includes("ADMIN") ||
        me.user.roles.includes("CLINIC_ADMIN") ||
        me.user.roles.includes("VET") ||
        me.user.roles.includes("RECEPTIONIST")
      ) {
        tasks.push(api<AnalyticsSummary>("/analytics/summary", currentToken).then(setAnalytics));
      } else {
        setAnalytics(null);
      }

      if (me.user.roles.includes("ADMIN")) {
        tasks.push(api<{ users: AdminUser[] }>("/users/admin/users", currentToken).then((response) => setAdminUsers(response.users)));
      } else {
        setAdminUsers([]);
      }

      await Promise.all(tasks);
      setStatus("Datos sincronizados.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClinicalData(petId: string, currentToken = token) {
    if (!currentToken || !petId) {
      return;
    }

    try {
      const [recordsResponse, vaccinationsResponse, prescriptionsResponse] = await Promise.all([
        api<{ records: SimpleItem[] }>(`/ehr/pets/${petId}/records`, currentToken),
        api<{ vaccinations: SimpleItem[] }>(`/ehr/pets/${petId}/vaccinations`, currentToken),
        api<{ prescriptions: SimpleItem[] }>(`/ehr/pets/${petId}/prescriptions`, currentToken)
      ]);

      setRecords(recordsResponse.records);
      setVaccinations(vaccinationsResponse.vaccinations);
      setPrescriptions(prescriptionsResponse.prescriptions);
    } catch {
      setRecords([]);
      setVaccinations([]);
      setPrescriptions([]);
    }
  }

  useEffect(() => {
    if (token) {
      void loadDashboard(token);
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedPetId) {
      void loadClinicalData(selectedPetId, token);
    }
  }, [selectedPetId, token]);

  function logout() {
    localStorage.removeItem("petwell_token");
    localStorage.removeItem("petwell_user");
    setToken(null);
    setUser(null);
    setStatus("Sesión cerrada.");
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
      setStatus("Operación completada.");
      await loadDashboard(token);
      if (selectedPetId) {
        await loadClinicalData(selectedPetId, token);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "La operación falló.");
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
        setStatus("Cuenta OWNER creada.");
      } else {
        const response = await api<{ token: string; user: SessionUser }>("/users/login", undefined, {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        await persistAndLoad(response.token, response.user);
        setStatus("Sesión iniciada.");
      }

      event.currentTarget.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No fue posible autenticar.");
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

  if (!token || !user) {
    return (
      <main className="shell landing-shell">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">PetWell Ecosystem</span>
            <h1>Salud veterinaria, operación clínica y administración en una sola superficie.</h1>
            <p>
              El portal centraliza mascotas, EHR, agenda, pagos, telemedicina, notificaciones y trazabilidad
              por rol sin exponer ruido técnico al usuario final.
            </p>
            <div className="hero-grid">
              <article>
                <strong>Propietario</strong>
                <span>Agenda y sigue cada consulta desde el registro hasta la factura.</span>
              </article>
              <article>
                <strong>Clínica</strong>
                <span>Orquesta staff, disponibilidad, atención y comunicación operativa.</span>
              </article>
              <article>
                <strong>Admin</strong>
                <span>Asigna roles, controla sedes y revisa métricas globales del ecosistema.</span>
              </article>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-switch">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Ingresar
            </button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
              Crear cuenta
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuth}>
            {authMode === "register" ? <input name="fullName" placeholder="Nombre completo" required /> : null}
            <input name="email" type="email" placeholder="Correo" required />
            {authMode === "register" ? <input name="phone" placeholder="Teléfono" required /> : null}
            <input name="password" type="password" placeholder="Contraseña" required />
            <button type="submit">{authMode === "register" ? "Crear cuenta OWNER" : "Entrar a PetWell"}</button>
          </form>

          <div className="status-box">
            <strong>Estado</strong>
            <span>{status}</span>
          </div>

          <div className="support-drawer">
            <details>
              <summary>Panel técnico</summary>
              <p>API base: {API_BASE}</p>
              <p>Usa el administrador bootstrap desde `.env` para habilitar roles elevados.</p>
            </details>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Centro operativo PetWell</span>
          <h1>{user.fullName ?? user.email}</h1>
          <p>{user.email}</p>
        </div>
        <div className="topbar-actions">
          <div className="role-strip">
            {user.roles.map((role) => (
              <span key={role} className="role-pill">
                {role}
              </span>
            ))}
          </div>
          <button className="ghost-button" onClick={() => void loadDashboard(token)}>
            {loading ? "Sincronizando..." : "Actualizar"}
          </button>
          <button className="ghost-button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="overview-grid">
        <article className="metric-card"><span>Mascotas</span><strong>{pets.length}</strong></article>
        <article className="metric-card"><span>Citas</span><strong>{appointments.length}</strong></article>
        <article className="metric-card"><span>Clínicas</span><strong>{clinics.length}</strong></article>
        <article className="metric-card"><span>Notificaciones</span><strong>{notifications.length}</strong></article>
      </section>

      <section className="workspace-grid">
        {hasRole(user, "OWNER") ? (
          <OwnerColumn
            pets={pets}
            clinics={clinics}
            schedules={schedules}
            appointments={appointments}
            invoices={invoices}
            telemedRooms={telemedRooms}
            selectedPetId={selectedPetId}
            setSelectedPetId={setSelectedPetId}
            submitJson={submitJson}
            payAppointment={payAppointment}
          />
        ) : null}

        {hasRole(user, "CLINIC_ADMIN") || hasRole(user, "VET") || hasRole(user, "RECEPTIONIST") || hasRole(user, "ADMIN") ? (
          <ClinicColumn
            pets={pets}
            clinics={clinics}
            appointments={appointments}
            analytics={analytics}
            submitJson={submitJson}
          />
        ) : null}

        {hasRole(user, "ADMIN") ? (
          <AdminColumn users={adminUsers} updateRoles={updateRoles} />
        ) : null}
      </section>

      <section className="workspace-grid single">
        <Panel title="Historial clínico visible">
          <div className="list-grid three">
            <article className="compact-card">
              <strong>Records</strong>
              {records.length ? records.map((item) => <span key={item.id}>{item.reason}: {item.notes}</span>) : <span>Sin datos</span>}
            </article>
            <article className="compact-card">
              <strong>Vacunas</strong>
              {vaccinations.length ? vaccinations.map((item) => <span key={item.id}>{item.vaccineCode} · {item.date}</span>) : <span>Sin datos</span>}
            </article>
            <article className="compact-card">
              <strong>Prescripciones</strong>
              {prescriptions.length ? prescriptions.map((item) => <span key={item.id}>{item.drug} · {item.dose}</span>) : <span>Sin datos</span>}
            </article>
          </div>
        </Panel>

        <Panel title="Pulso del sistema">
          <div className="list-grid">
            {notifications.slice(0, 6).map((notification) => (
              <article key={notification.id} className="compact-card">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{formatDate(notification.createdAt)}</small>
              </article>
            ))}
          </div>
          <div className="status-box">
            <strong>Estado operativo</strong>
            <span>{status}</span>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function OwnerColumn(props: {
  pets: Pet[];
  clinics: Clinic[];
  schedules: Schedule[];
  appointments: Appointment[];
  invoices: InvoiceItem[];
  telemedRooms: TelemedRoom[];
  selectedPetId: string;
  setSelectedPetId: (value: string) => void;
  submitJson: (path: string, body: Record<string, unknown>, method?: string) => Promise<void>;
  payAppointment: (appointmentId: string) => Promise<void>;
}) {
  return (
    <section className="workspace-column">
      <Panel title="Mascotas y consentimientos">
        <InlineForm
          title="Registrar mascota"
          fields={[
            { name: "name", placeholder: "Nombre" },
            { name: "species", placeholder: "Especie" },
            { name: "breed", placeholder: "Raza" }
          ]}
          extraField={
            <select name="primaryClinicId" required>
              <option value="">Clínica principal</option>
              {props.clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>
              ))}
            </select>
          }
          onSubmit={(data) => props.submitJson("/pets", data)}
        />

        <InlineForm
          title="Consentimiento EHR"
          fields={[{ name: "scope", placeholder: "Alcance" }]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
            </>
          }
          onSubmit={(data) => props.submitJson("/ehr/consents", data)}
        />

        <div className="list-grid">
          {props.pets.map((pet) => (
            <button key={pet.id} className={`pet-card ${props.selectedPetId === pet.id ? "selected" : ""}`} onClick={() => props.setSelectedPetId(pet.id)}>
              <strong>{pet.name}</strong>
              <span>{pet.species} · {pet.breed}</span>
              <small>{pet.id}</small>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Agenda, pagos y telemedicina">
        <InlineForm
          title="Reservar cita"
          fields={[
            { name: "startTime", type: "datetime-local", placeholder: "Inicio" },
            { name: "endTime", type: "datetime-local", placeholder: "Fin" }
          ]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
              <select name="vetUserId" required>
                <option value="">Veterinario</option>
                {props.schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.vetUserId}>
                    {schedule.vetUserId} · {dayName(schedule.dayOfWeek)} {schedule.start}-{schedule.end}
                  </option>
                ))}
              </select>
              <select name="type" required>
                <option value="IN_PERSON">Presencial</option>
                <option value="TELEMED">Telemedicina</option>
              </select>
            </>
          }
          onSubmit={(data) =>
            props.submitJson("/appointments", {
              ...data,
              startTime: new Date(String(data.startTime)).toISOString(),
              endTime: new Date(String(data.endTime)).toISOString()
            })
          }
        />

        <div className="list-grid">
          {props.appointments.map((appointment) => (
            <article key={appointment.id} className="compact-card">
              <strong>{appointment.type}</strong>
              <span>{formatDate(appointment.startTime)}</span>
              <small>{appointment.status}</small>
              {appointment.status === "PENDING_PAYMENT" ? (
                <button onClick={() => void props.payAppointment(appointment.id)}>Pagar 95.000</button>
              ) : null}
            </article>
          ))}
        </div>

        <div className="list-grid">
          {props.invoices.map((item) => (
            <article key={item.invoice.id} className="compact-card">
              <strong>Factura {item.invoice.id.slice(0, 8)}</strong>
              <span>{item.invoice.status}</span>
              <small>${item.invoice.total.toLocaleString("es-CO")}</small>
            </article>
          ))}
        </div>

        <div className="list-grid">
          {props.telemedRooms.map((room) => (
            <article key={room.appointmentId} className="compact-card">
              <strong>{room.roomCode}</strong>
              <span>{room.roomUrl}</span>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ClinicColumn(props: {
  pets: Pet[];
  clinics: Clinic[];
  appointments: Appointment[];
  analytics: AnalyticsSummary | null;
  submitJson: (path: string, body: Record<string, unknown>, method?: string) => Promise<void>;
}) {
  return (
    <section className="workspace-column">
      <Panel title="Operación clínica">
        <InlineForm
          title="Crear clínica"
          fields={[
            { name: "legalName", placeholder: "Razón social" },
            { name: "taxId", placeholder: "NIT" },
            { name: "address", placeholder: "Dirección" }
          ]}
          onSubmit={(data) => props.submitJson("/users/clinics", data)}
        />

        <InlineForm
          title="Vincular staff"
          fields={[{ name: "userId", placeholder: "ID del usuario" }]}
          extraField={
            <>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
              <select name="staffRole" required>
                <option value="CLINIC_ADMIN">CLINIC_ADMIN</option>
                <option value="VET">VET</option>
                <option value="RECEPTIONIST">RECEPTIONIST</option>
              </select>
            </>
          }
          onSubmit={(data) =>
            props.submitJson(`/users/clinics/${String(data.clinicId)}/staff`, {
              userId: data.userId,
              staffRole: data.staffRole
            })
          }
        />

        <InlineForm
          title="Crear horario"
          fields={[
            { name: "vetUserId", placeholder: "ID del veterinario" },
            { name: "dayOfWeek", type: "number", placeholder: "0-6" },
            { name: "start", type: "time", placeholder: "Inicio" },
            { name: "end", type: "time", placeholder: "Fin" },
            { name: "slotMinutes", type: "number", placeholder: "Minutos por slot" }
          ]}
          extraField={
            <select name="clinicId" required>
              <option value="">Clínica</option>
              {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
            </select>
          }
          onSubmit={(data) => props.submitJson("/appointments/schedules", data)}
        />
      </Panel>

      <Panel title="EHR y comunicación">
        <InlineForm
          title="Nuevo record clínico"
          fields={[
            { name: "reason", placeholder: "Motivo" },
            { name: "notes", placeholder: "Notas clínicas" }
          ]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
            </>
          }
          onSubmit={(data) => props.submitJson("/ehr/records", data)}
        />

        <InlineForm
          title="Vacunación"
          fields={[
            { name: "vaccineCode", placeholder: "Código" },
            { name: "date", type: "date", placeholder: "Fecha" },
            { name: "batch", placeholder: "Lote" }
          ]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
            </>
          }
          onSubmit={(data) => props.submitJson("/ehr/vaccinations", data)}
        />

        <InlineForm
          title="Prescripción"
          fields={[
            { name: "drug", placeholder: "Medicamento" },
            { name: "dose", placeholder: "Dosis" },
            { name: "frequency", placeholder: "Frecuencia" },
            { name: "start", type: "date", placeholder: "Inicio" },
            { name: "end", type: "date", placeholder: "Fin" },
            { name: "notes", placeholder: "Notas" }
          ]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
              <select name="clinicId" required>
                <option value="">Clínica</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
            </>
          }
          onSubmit={(data) => props.submitJson("/ehr/prescriptions", data)}
        />

        <InlineForm
          title="Notificación manual"
          fields={[
            { name: "title", placeholder: "Título" },
            { name: "message", placeholder: "Mensaje" }
          ]}
          extraField={
            <>
              <select name="clinicId">
                <option value="">Clínica opcional</option>
                {props.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.legalName}</option>)}
              </select>
              <input name="userId" placeholder="Usuario opcional" />
            </>
          }
          onSubmit={(data) => props.submitJson("/notifications/send", data)}
        />
      </Panel>

      <Panel title="Analítica y agenda">
        {props.analytics?.global ? (
          <div className="analytics-grid">
            <article className="metric-card"><span>Revenue</span><strong>${props.analytics.global.revenue.toLocaleString("es-CO")}</strong></article>
            <article className="metric-card"><span>Citas</span><strong>{props.analytics.global.totalAppointments}</strong></article>
            <article className="metric-card"><span>Telemed</span><strong>{props.analytics.global.telemedCount}</strong></article>
          </div>
        ) : (
          <p className="muted">La analítica se alimenta cuando el flujo empieza a emitir eventos.</p>
        )}

        <div className="list-grid">
          {props.appointments.map((appointment) => (
            <article key={appointment.id} className="compact-card">
              <strong>{appointment.type}</strong>
              <span>{formatDate(appointment.startTime)}</span>
              <small>{appointment.status}</small>
              {appointment.status === "CONFIRMED" ? (
                <button onClick={() => void props.submitJson(`/appointments/${appointment.id}/complete`, {})}>
                  Completar
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function AdminColumn(props: {
  users: AdminUser[];
  updateRoles: (userId: string, roles: Role[]) => Promise<void>;
}) {
  return (
    <section className="workspace-column">
      <Panel title="Administración central">
        <div className="list-grid">
          {props.users.map((adminUser) => (
            <article key={adminUser.id} className="user-card">
              <div>
                <strong>{adminUser.fullName}</strong>
                <span>{adminUser.email}</span>
                <small>{adminUser.id}</small>
              </div>
              <div className="role-actions">
                <button onClick={() => void props.updateRoles(adminUser.id, ["OWNER"])}>OWNER</button>
                <button onClick={() => void props.updateRoles(adminUser.id, ["CLINIC_ADMIN"])}>CLINIC_ADMIN</button>
                <button onClick={() => void props.updateRoles(adminUser.id, ["VET"])}>VET</button>
                <button onClick={() => void props.updateRoles(adminUser.id, ["RECEPTIONIST"])}>RECEPTIONIST</button>
                <button onClick={() => void props.updateRoles(adminUser.id, ["ADMIN"])}>ADMIN</button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

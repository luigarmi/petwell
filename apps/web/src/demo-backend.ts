import type {
  AdminUser,
  AnalyticsSummary,
  Appointment,
  Clinic,
  InvoiceItem,
  Notification,
  Pet,
  Role,
  Schedule,
  SessionUser,
  SimpleItem,
  TelemedRoom
} from "./dashboard-models.js";

type DemoUserRecord = {
  id: string;
  email: string;
  phone: string;
  password: string;
  status: string;
  roles: Role[];
  clinicIds: string[];
  fullName: string;
};

type DemoClinicStaff = {
  id: string;
  clinicId: string;
  userId: string;
  staffRole: Role;
};

type DemoNotificationRecord = Notification & {
  userId?: string;
  clinicId?: string;
};

type DemoRecord = SimpleItem & {
  petId: string;
  clinicId: string;
  vetUserId: string;
  createdAt: string;
};

type DemoVaccination = SimpleItem & {
  petId: string;
  clinicId: string;
};

type DemoPrescription = SimpleItem & {
  petId: string;
  clinicId: string;
  vetUserId: string;
  frequency?: string;
  start?: string;
  end?: string;
};

type DemoConsent = {
  id: string;
  petId: string;
  ownerUserId: string;
  clinicId: string;
  scope: string;
  createdAt: string;
};

type DemoState = {
  nextSequence: number;
  users: DemoUserRecord[];
  clinics: Clinic[];
  clinicStaff: DemoClinicStaff[];
  pets: Pet[];
  consents: DemoConsent[];
  schedules: Schedule[];
  appointments: Appointment[];
  notifications: DemoNotificationRecord[];
  invoices: InvoiceItem[];
  telemedRooms: TelemedRoom[];
  records: DemoRecord[];
  vaccinations: DemoVaccination[];
  prescriptions: DemoPrescription[];
};

const STORAGE_KEY = "petwell_demo_db_v2";
const DEMO_ADMIN_EMAIL = "admin@petwell.local";
const DEMO_ADMIN_PASSWORD = "Admin123!";
const DEMO_ADMIN_ID = "demo-admin-0001";
const DEMO_CLINIC_ID = "demo-clinic-0001";
const DEMO_SCHEDULE_ID = "demo-schedule-0001";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toSessionUser(user: DemoUserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    roles: [...user.roles],
    clinicIds: [...user.clinicIds],
    fullName: user.fullName
  };
}

function toAdminUser(user: DemoUserRecord): AdminUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    roles: [...user.roles]
  };
}

function buildToken(userId: string) {
  return `demo:${userId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildDemoUrl(path: string) {
  return `https://petwell-psi.vercel.app${path}`;
}

function createNotification(
  id: string,
  category: string,
  title: string,
  message: string,
  options?: { userId?: string; clinicId?: string; createdAt?: string }
): DemoNotificationRecord {
  return {
    id,
    category,
    title,
    message,
    createdAt: options?.createdAt ?? nowIso(),
    userId: options?.userId,
    clinicId: options?.clinicId
  };
}

function createInitialState(): DemoState {
  const createdAt = nowIso();
  const adminUser: DemoUserRecord = {
    id: DEMO_ADMIN_ID,
    email: DEMO_ADMIN_EMAIL,
    phone: "3000000000",
    password: DEMO_ADMIN_PASSWORD,
    status: "ACTIVE",
    roles: ["OWNER", "CLINIC_ADMIN", "VET", "RECEPTIONIST", "ADMIN"],
    clinicIds: [DEMO_CLINIC_ID],
    fullName: "Equipo PetWell"
  };

  return {
    nextSequence: 1,
    users: [adminUser],
    clinics: [
      {
        id: DEMO_CLINIC_ID,
        legalName: "PetWell Central",
        taxId: "900100200-1",
        address: "Bogota, Colombia",
        staffCount: 1
      }
    ],
    clinicStaff: [
      {
        id: "demo-staff-0001",
        clinicId: DEMO_CLINIC_ID,
        userId: DEMO_ADMIN_ID,
        staffRole: "CLINIC_ADMIN"
      }
    ],
    pets: [],
    consents: [],
    schedules: [
      {
        id: DEMO_SCHEDULE_ID,
        clinicId: DEMO_CLINIC_ID,
        vetUserId: DEMO_ADMIN_ID,
        dayOfWeek: 1,
        start: "08:00",
        end: "16:00",
        slotMinutes: 30
      }
    ],
    appointments: [],
    notifications: [
      createNotification(
        "demo-note-0001",
        "SYSTEM",
        "Tu espacio esta listo",
        "Ya puedes recorrer la plataforma y conocer cada seccion con tranquilidad.",
        { userId: DEMO_ADMIN_ID, clinicId: DEMO_CLINIC_ID, createdAt }
      )
    ],
    invoices: [],
    telemedRooms: [],
    records: [],
    vaccinations: [],
    prescriptions: []
  };
}

function readState(): DemoState {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const next = createInitialState();
    writeState(next);
    return next;
  }

  try {
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed.users?.length) {
      throw new Error("invalid-demo-state");
    }
    return parsed;
  } catch {
    const next = createInitialState();
    writeState(next);
    return next;
  }
}

function writeState(state: DemoState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nextId(state: DemoState, prefix: string) {
  state.nextSequence += 1;
  return `${prefix}-${state.nextSequence.toString().padStart(4, "0")}`;
}

function parseBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== "string") {
    return {} as Record<string, string>;
  }

  try {
    return JSON.parse(init.body) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function unauthorized(message = "Authentication required"): never {
  throw new Error(message);
}

function notAllowed(message = "Insufficient permissions"): never {
  throw new Error(message);
}

function notFound(message = "Resource not found"): never {
  throw new Error(message);
}

function requireUser(state: DemoState, token?: string) {
  if (!token?.startsWith("demo:")) {
    unauthorized();
  }

  const userId = token.slice("demo:".length);
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    unauthorized();
  }

  return user;
}

function hasAnyRole(user: DemoUserRecord, roles: Role[]) {
  return roles.some((role) => user.roles.includes(role));
}

function requireRole(user: DemoUserRecord, roles: Role[]) {
  if (!hasAnyRole(user, roles)) {
    notAllowed();
  }
}

function clinicIdsForUser(user: DemoUserRecord, state: DemoState) {
  if (user.roles.includes("ADMIN")) {
    return state.clinics.map((clinic) => clinic.id);
  }

  return user.clinicIds.length ? user.clinicIds : state.clinics.map((clinic) => clinic.id);
}

function visiblePets(user: DemoUserRecord, state: DemoState) {
  const clinicIds = new Set(clinicIdsForUser(user, state));
  return state.pets.filter(
    (pet) => pet.ownerIds.includes(user.id) || user.roles.includes("ADMIN") || clinicIds.has(pet.primaryClinicId)
  );
}

function visibleAppointments(user: DemoUserRecord, state: DemoState) {
  const clinicIds = new Set(clinicIdsForUser(user, state));
  return state.appointments.filter(
    (appointment) =>
      appointment.ownerUserId === user.id || user.roles.includes("ADMIN") || clinicIds.has(appointment.clinicId)
  );
}

function visibleInvoices(user: DemoUserRecord, state: DemoState) {
  const appointmentIds = new Set(visibleAppointments(user, state).map((appointment) => appointment.id));
  return state.invoices.filter((item) => appointmentIds.has(item.appointmentId));
}

function visibleRooms(user: DemoUserRecord, state: DemoState) {
  const appointmentIds = new Set(visibleAppointments(user, state).map((appointment) => appointment.id));
  return state.telemedRooms.filter((room) => appointmentIds.has(room.appointmentId));
}

function visibleNotifications(user: DemoUserRecord, state: DemoState) {
  const clinicIds = new Set(clinicIdsForUser(user, state));
  return state.notifications.filter((notification) => {
    if (user.roles.includes("ADMIN")) {
      return true;
    }

    if (notification.userId && notification.userId === user.id) {
      return true;
    }

    if (notification.clinicId && clinicIds.has(notification.clinicId)) {
      return true;
    }

    return notification.category === "SYSTEM";
  });
}

function ensureClinicStaffCount(state: DemoState) {
  state.clinics = state.clinics.map((clinic) => ({
    ...clinic,
    staffCount: state.clinicStaff.filter((member) => member.clinicId === clinic.id).length
  }));
}

function addNotification(
  state: DemoState,
  category: string,
  title: string,
  message: string,
  options?: { userId?: string; clinicId?: string }
) {
  state.notifications.unshift(
    createNotification(nextId(state, "note"), category, title, message, {
      userId: options?.userId,
      clinicId: options?.clinicId
    })
  );
}

function buildAnalytics(state: DemoState): AnalyticsSummary {
  const totalRevenue = state.invoices.reduce(
    (sum, item) => sum + (item.payment?.status === "SUCCEEDED" ? item.invoice.total : 0),
    0
  );

  return {
    global: {
      date: new Date().toISOString().slice(0, 10),
      activeClinics: state.clinics.length,
      registeredPets: state.pets.length,
      totalAppointments: state.appointments.length,
      telemedCount: state.appointments.filter((appointment) => appointment.type === "TELEMED").length,
      revenue: totalRevenue
    },
    clinics: state.clinics.map((clinic) => {
      const appointments = state.appointments.filter((appointment) => appointment.clinicId === clinic.id);
      const revenue = state.invoices
        .filter((item) => {
          const appointment = state.appointments.find((entry) => entry.id === item.appointmentId);
          return appointment?.clinicId === clinic.id && item.payment?.status === "SUCCEEDED";
        })
        .reduce((sum, item) => sum + item.invoice.total, 0);

      return {
        date: new Date().toISOString().slice(0, 10),
        clinicId: clinic.id,
        occupancy: appointments.length ? Math.min(appointments.length * 20, 100) : 0,
        revenue,
        appointments: appointments.length
      };
    })
  };
}

function sanitizeRoles(roles: string[] | undefined) {
  const allowed = new Set<Role>(["OWNER", "CLINIC_ADMIN", "VET", "RECEPTIONIST", "ADMIN"]);
  const selected = (roles ?? []).filter((role): role is Role => allowed.has(role as Role));
  return selected.length ? Array.from(new Set(selected)) : (["OWNER"] as Role[]);
}

function createDemoResponse<T>(value: T) {
  return clone(value);
}

function matchPath(path: string, pattern: RegExp) {
  return path.match(pattern);
}

export function getDemoCredentials() {
  return {
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_ADMIN_PASSWORD
  };
}

export async function handleDemoApiRequest<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cleanPath = path.replace(/\/+$/, "") || "/";
  const state = readState();

  if (cleanPath === "/users/register" && method === "POST") {
    const body = parseBody(init);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !body.password || !body.fullName || !body.phone) {
      throw new Error("Missing required registration fields");
    }
    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      throw new Error("Email already registered");
    }

    const user: DemoUserRecord = {
      id: nextId(state, "user"),
      email,
      phone: String(body.phone),
      password: String(body.password),
      status: "ACTIVE",
      roles: ["OWNER"],
      clinicIds: [],
      fullName: String(body.fullName)
    };

    state.users.push(user);
    addNotification(
      state,
      "ACCOUNT",
      "Cuenta creada",
      `${user.fullName} ya puede empezar a usar PetWell.`,
      { userId: user.id }
    );
    writeState(state);
    return createDemoResponse({
      token: buildToken(user.id),
      user: toSessionUser(user)
    }) as T;
  }

  if (cleanPath === "/users/login" && method === "POST") {
    const body = parseBody(init);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = state.users.find((item) => item.email.toLowerCase() === email && item.password === password);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    return createDemoResponse({
      token: buildToken(user.id),
      user: toSessionUser(user)
    }) as T;
  }

  const currentUser = requireUser(state, token);

  if (cleanPath === "/users/me" && method === "GET") {
    return createDemoResponse({ user: toSessionUser(currentUser) }) as T;
  }

  if (cleanPath === "/users/clinics" && method === "GET") {
    ensureClinicStaffCount(state);
    writeState(state);
    return createDemoResponse({ clinics: state.clinics }) as T;
  }

  if (cleanPath === "/users/admin/users" && method === "GET") {
    requireRole(currentUser, ["ADMIN"]);
    return createDemoResponse({ users: state.users.map(toAdminUser) }) as T;
  }

  const roleMatch = matchPath(cleanPath, /^\/users\/admin\/users\/([^/]+)\/roles$/);
  if (roleMatch && method === "PUT") {
    requireRole(currentUser, ["ADMIN"]);
    const target = state.users.find((user) => user.id === roleMatch[1]);
    if (!target) {
      notFound("User not found");
    }

    const body = parseBody(init) as { roles?: string[] };
    target.roles = sanitizeRoles(body.roles);
    addNotification(
      state,
      "GOVERNANCE",
      "Permisos actualizados",
      `Se actualizo el acceso de ${target.fullName}.`,
      { userId: target.id }
    );
    writeState(state);
    return createDemoResponse({ user: toAdminUser(target) }) as T;
  }

  if (cleanPath === "/users/clinics" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN"]);
    const body = parseBody(init);
    const clinic: Clinic = {
      id: nextId(state, "clinic"),
      legalName: String(body.legalName ?? "Nueva clinica"),
      taxId: String(body.taxId ?? "No registrado"),
      address: String(body.address ?? "Direccion pendiente"),
      staffCount: 0
    };

    state.clinics.push(clinic);
    if (!currentUser.clinicIds.includes(clinic.id)) {
      currentUser.clinicIds.push(clinic.id);
    }
    state.clinicStaff.push({
      id: nextId(state, "staff"),
      clinicId: clinic.id,
      userId: currentUser.id,
      staffRole: "CLINIC_ADMIN"
    });
    ensureClinicStaffCount(state);
    addNotification(state, "CLINIC", "Sede creada", `${clinic.legalName} ya esta lista para empezar a atender.`, {
      clinicId: clinic.id
    });
    writeState(state);
    return createDemoResponse({ clinic }) as T;
  }

  const staffMatch = matchPath(cleanPath, /^\/users\/clinics\/([^/]+)\/staff$/);
  if (staffMatch && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN"]);
    const clinicId = staffMatch[1];
    const clinic = state.clinics.find((item) => item.id === clinicId);
    if (!clinic) {
      notFound("Clinic not found");
    }

    const body = parseBody(init);
    const targetUser = state.users.find((user) => user.id === body.userId);
    if (!targetUser) {
      notFound("User not found");
    }

    const staffRole = sanitizeRoles([String(body.staffRole ?? "CLINIC_ADMIN")])[0];
    if (!targetUser.roles.includes(staffRole)) {
      targetUser.roles.push(staffRole);
    }
    if (!targetUser.clinicIds.includes(clinicId)) {
      targetUser.clinicIds.push(clinicId);
    }
    if (!state.clinicStaff.some((member) => member.clinicId === clinicId && member.userId === targetUser.id)) {
      state.clinicStaff.push({
        id: nextId(state, "staff"),
        clinicId,
        userId: targetUser.id,
        staffRole
      });
    }

    ensureClinicStaffCount(state);
    addNotification(
      state,
      "CLINIC",
      "Equipo actualizado",
      `${targetUser.fullName} fue asignado a ${clinic.legalName}.`,
      { clinicId }
    );
    writeState(state);
    return createDemoResponse({ ok: true }) as T;
  }

  if (cleanPath === "/pets" && method === "GET") {
    return createDemoResponse({ pets: visiblePets(currentUser, state) }) as T;
  }

  if (cleanPath === "/pets" && method === "POST") {
    requireRole(currentUser, ["OWNER", "ADMIN"]);
    const body = parseBody(init);
    const clinicId = String(body.primaryClinicId ?? "");
    if (!state.clinics.some((clinic) => clinic.id === clinicId)) {
      notFound("Clinic not found");
    }

    const pet: Pet = {
      id: nextId(state, "pet"),
      name: String(body.name ?? "Mascota"),
      species: String(body.species ?? "Canino"),
      breed: String(body.breed ?? "Mestizo"),
      primaryClinicId: clinicId,
      ownerIds: [currentUser.id]
    };
    state.pets.push(pet);
    addNotification(state, "PET", "Mascota registrada", `${pet.name} ya hace parte de PetWell.`, {
      userId: currentUser.id,
      clinicId
    });
    writeState(state);
    return createDemoResponse({ pet }) as T;
  }

  if (cleanPath === "/ehr/consents" && method === "POST") {
    requireRole(currentUser, ["OWNER", "ADMIN"]);
    const body = parseBody(init);
    const petId = String(body.petId ?? "");
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet || !pet.ownerIds.includes(currentUser.id)) {
      throw new Error("Pet ownership required");
    }

    const consent: DemoConsent = {
      id: nextId(state, "consent"),
      petId,
      ownerUserId: currentUser.id,
      clinicId: String(body.clinicId ?? ""),
      scope: String(body.scope ?? "CONSULTA"),
      createdAt: nowIso()
    };
    state.consents.push(consent);
    addNotification(
      state,
      "EHR",
      "Acceso autorizado",
      `La clinica ya puede revisar la informacion de ${pet.name}.`,
      { userId: currentUser.id, clinicId: consent.clinicId }
    );
    writeState(state);
    return createDemoResponse({ consent }) as T;
  }

  if (cleanPath === "/appointments/schedules" && method === "GET") {
    return createDemoResponse({ schedules: state.schedules }) as T;
  }

  if (cleanPath === "/appointments/schedules" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
    const body = parseBody(init);
    const schedule: Schedule = {
      id: nextId(state, "schedule"),
      clinicId: String(body.clinicId ?? ""),
      vetUserId: String(body.vetUserId ?? currentUser.id),
      dayOfWeek: Number(body.dayOfWeek ?? 1),
      start: String(body.start ?? "08:00"),
      end: String(body.end ?? "16:00"),
      slotMinutes: Number(body.slotMinutes ?? 30)
    };
    state.schedules.push(schedule);
    addNotification(
      state,
      "SCHEDULE",
      "Horario listo",
      "La disponibilidad ya quedo organizada.",
      { clinicId: schedule.clinicId }
    );
    writeState(state);
    return createDemoResponse({ schedule }) as T;
  }

  if (cleanPath === "/appointments" && method === "GET") {
    return createDemoResponse({ appointments: visibleAppointments(currentUser, state) }) as T;
  }

  if (cleanPath === "/appointments" && method === "POST") {
    requireRole(currentUser, ["OWNER", "ADMIN"]);
    const body = parseBody(init);
    const petId = String(body.petId ?? "");
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet || !pet.ownerIds.includes(currentUser.id)) {
      throw new Error("Pet ownership required");
    }

    const appointment: Appointment = {
      id: nextId(state, "appt"),
      petId,
      ownerUserId: currentUser.id,
      clinicId: String(body.clinicId ?? pet.primaryClinicId),
      vetUserId: String(body.vetUserId ?? DEMO_ADMIN_ID),
      type: String(body.type ?? "IN_PERSON"),
      startTime: String(body.startTime ?? nowIso()),
      endTime: String(body.endTime ?? nowIso()),
      status: "PENDING_PAYMENT"
    };
    state.appointments.push(appointment);
    addNotification(
      state,
      "APPOINTMENT",
      "Cita creada",
      `La cita de ${pet.name} ya quedo reservada y esta pendiente de pago.`,
      { userId: currentUser.id, clinicId: appointment.clinicId }
    );
    writeState(state);
    return createDemoResponse({ appointment }) as T;
  }

  const appointmentActionMatch = matchPath(cleanPath, /^\/appointments\/([^/]+)\/(confirm|cancel|complete)$/);
  if (appointmentActionMatch && method === "POST") {
    const appointment = state.appointments.find((item) => item.id === appointmentActionMatch[1]);
    if (!appointment) {
      notFound("Appointment not found");
    }

    const action = appointmentActionMatch[2];
    if (action === "complete") {
      requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
      appointment.status = "COMPLETED";
      addNotification(
        state,
        "APPOINTMENT",
        "Consulta finalizada",
        "La atencion ya fue marcada como finalizada.",
        { clinicId: appointment.clinicId, userId: appointment.ownerUserId }
      );
    } else if (action === "confirm") {
      requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "RECEPTIONIST"]);
      appointment.status = "CONFIRMED";
    } else {
      appointment.status = "CANCELLED";
    }

    writeState(state);
    return createDemoResponse({ appointment }) as T;
  }

  if (cleanPath === "/payments" && method === "POST") {
    requireRole(currentUser, ["OWNER", "ADMIN"]);
    const body = parseBody(init);
    const appointment = state.appointments.find((item) => item.id === String(body.appointmentId ?? ""));
    if (!appointment || appointment.ownerUserId !== currentUser.id) {
      notFound("Appointment not found");
    }

    const existing = state.invoices.find((item) => item.appointmentId === appointment.id);
    const invoice =
      existing ??
      ({
        appointmentId: appointment.id,
        invoice: {
          id: nextId(state, "invoice"),
          total: Number(body.amount ?? 95000),
          status: "PAID",
          issuedAt: nowIso()
        },
        payment: {
          id: nextId(state, "payment"),
          amount: Number(body.amount ?? 95000),
          provider: String(body.provider ?? "SIMULATED"),
          status: "SUCCEEDED"
        }
      } satisfies InvoiceItem);

    if (!existing) {
      state.invoices.unshift(invoice);
    } else {
      existing.invoice.status = "PAID";
      existing.payment = {
        id: nextId(state, "payment"),
        amount: Number(body.amount ?? existing.invoice.total),
        provider: String(body.provider ?? "SIMULATED"),
        status: "SUCCEEDED"
      };
    }

    appointment.status = "CONFIRMED";
    addNotification(
      state,
      "BILLING",
      "Pago confirmado",
      `Se registro el pago de ${Math.round(Number(body.amount ?? 95000)).toLocaleString("es-CO")} y la cita quedo confirmada.`,
      { userId: currentUser.id, clinicId: appointment.clinicId }
    );
    addNotification(state, "APPOINTMENT", "Cita confirmada", "La cita ya quedo confirmada y visible en tu agenda.", {
      userId: currentUser.id,
      clinicId: appointment.clinicId
    });

    if (appointment.type === "TELEMED" && !state.telemedRooms.some((room) => room.appointmentId === appointment.id)) {
      const room: TelemedRoom = {
        appointmentId: appointment.id,
        roomCode: `PW-${nextId(state, "room").slice(-4).toUpperCase()}`,
        roomUrl: buildDemoUrl(`/telemed/${appointment.id}`),
        createdAt: nowIso()
      };
      state.telemedRooms.unshift(room);
      addNotification(
        state,
        "TELEMED",
        "Video consulta lista",
        "La sala virtual ya esta lista para entrar.",
        { userId: currentUser.id, clinicId: appointment.clinicId }
      );
    }

    writeState(state);
    return createDemoResponse({ invoice }) as T;
  }

  const paymentMatch = matchPath(cleanPath, /^\/payments\/([^/]+)$/);
  if (paymentMatch && method === "GET") {
    const item = state.invoices.find((invoice) => invoice.appointmentId === paymentMatch[1]);
    return createDemoResponse({ payment: item?.payment ?? null, invoice: item?.invoice ?? null }) as T;
  }

  if (cleanPath === "/payments/invoices" && method === "GET") {
    return createDemoResponse({ invoices: visibleInvoices(currentUser, state) }) as T;
  }

  if (cleanPath === "/telemed/rooms" && method === "GET") {
    return createDemoResponse({ rooms: visibleRooms(currentUser, state) }) as T;
  }

  const roomMatch = matchPath(cleanPath, /^\/telemed\/rooms\/([^/]+)$/);
  if (roomMatch && method === "GET") {
    const room = visibleRooms(currentUser, state).find((item) => item.appointmentId === roomMatch[1]) ?? null;
    return createDemoResponse({ room }) as T;
  }

  if (cleanPath === "/notifications" && method === "GET") {
    return createDemoResponse({ notifications: visibleNotifications(currentUser, state) }) as T;
  }

  if (cleanPath === "/notifications/send" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "RECEPTIONIST"]);
    const body = parseBody(init);
    addNotification(
      state,
      "MANUAL",
      String(body.title ?? "Aviso manual"),
      String(body.message ?? "Mensaje sin detalle"),
      {
        clinicId: String(body.clinicId ?? "") || undefined,
        userId: String(body.userId ?? "") || undefined
      }
    );
    writeState(state);
    return createDemoResponse({ ok: true }) as T;
  }

  if (cleanPath === "/analytics/summary" && method === "GET") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET", "RECEPTIONIST"]);
    return createDemoResponse(buildAnalytics(state)) as T;
  }

  if (cleanPath === "/analytics/events" && method === "GET") {
    return createDemoResponse({ events: state.notifications }) as T;
  }

  if (cleanPath === "/ehr/access-logs" && method === "GET") {
    return createDemoResponse({ accessLogs: [] }) as T;
  }

  if (cleanPath === "/ehr/records" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
    const body = parseBody(init);
    const petId = String(body.petId ?? "");
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet) {
      notFound("Pet not found");
    }

    const record: DemoRecord = {
      id: nextId(state, "record"),
      petId,
      clinicId: String(body.clinicId ?? pet.primaryClinicId),
      vetUserId: currentUser.id,
      reason: String(body.reason ?? "Consulta general"),
      notes: String(body.notes ?? ""),
      createdAt: nowIso()
    };
    state.records.unshift(record);
    addNotification(
      state,
      "CLINICAL",
      "Consulta guardada",
      "Se guardo una nueva nota de consulta.",
      { clinicId: record.clinicId, userId: pet.ownerIds[0] }
    );
    writeState(state);
    return createDemoResponse({ record }) as T;
  }

  if (cleanPath === "/ehr/vaccinations" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
    const body = parseBody(init);
    const petId = String(body.petId ?? "");
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet) {
      notFound("Pet not found");
    }

    const vaccination: DemoVaccination = {
      id: nextId(state, "vaccine"),
      petId,
      clinicId: String(body.clinicId ?? pet.primaryClinicId),
      vaccineCode: String(body.vaccineCode ?? "VAC"),
      date: String(body.date ?? new Date().toISOString().slice(0, 10))
    };
    state.vaccinations.unshift(vaccination);
    addNotification(
      state,
      "CLINICAL",
      "Vacunacion registrada",
      `Se registro la vacuna ${vaccination.vaccineCode}.`,
      { clinicId: vaccination.clinicId, userId: pet.ownerIds[0] }
    );
    writeState(state);
    return createDemoResponse({ vaccination }) as T;
  }

  if (cleanPath === "/ehr/prescriptions" && method === "POST") {
    requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
    const body = parseBody(init);
    const petId = String(body.petId ?? "");
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet) {
      notFound("Pet not found");
    }

    const prescription: DemoPrescription = {
      id: nextId(state, "rx"),
      petId,
      clinicId: String(body.clinicId ?? pet.primaryClinicId),
      vetUserId: currentUser.id,
      drug: String(body.drug ?? "Medicamento"),
      dose: String(body.dose ?? ""),
      frequency: String(body.frequency ?? ""),
      start: String(body.start ?? ""),
      end: String(body.end ?? ""),
      notes: String(body.notes ?? "")
    };
    state.prescriptions.unshift(prescription);
    addNotification(
      state,
      "CLINICAL",
      "Tratamiento guardado",
      `Se guardo la indicacion de ${prescription.drug}.`,
      { clinicId: prescription.clinicId, userId: pet.ownerIds[0] }
    );
    writeState(state);
    return createDemoResponse({ prescription }) as T;
  }

  const recordsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/records$/);
  if (recordsMatch && method === "GET") {
    const petId = recordsMatch[1];
    const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
    if (!allowed) {
      throw new Error("Record access denied");
    }

    return createDemoResponse({
      records: state.records
        .filter((item) => item.petId === petId)
        .map(({ petId: _petId, clinicId: _clinicId, vetUserId: _vetUserId, createdAt: _createdAt, ...item }) => item)
    }) as T;
  }

  const vaccinationsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/vaccinations$/);
  if (vaccinationsMatch && method === "GET") {
    const petId = vaccinationsMatch[1];
    const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
    if (!allowed) {
      throw new Error("Vaccination access denied");
    }

    return createDemoResponse({
      vaccinations: state.vaccinations
        .filter((item) => item.petId === petId)
        .map(({ petId: _petId, clinicId: _clinicId, ...item }) => item)
    }) as T;
  }

  const prescriptionsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/prescriptions$/);
  if (prescriptionsMatch && method === "GET") {
    const petId = prescriptionsMatch[1];
    const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
    if (!allowed) {
      throw new Error("Record access denied");
    }

    return createDemoResponse({
      prescriptions: state.prescriptions
        .filter((item) => item.petId === petId)
        .map(({ petId: _petId, clinicId: _clinicId, vetUserId: _vetUserId, frequency: _frequency, start: _start, end: _end, ...item }) => item)
    }) as T;
  }

  throw new Error(`Route not implemented: ${method} ${cleanPath}`);
}

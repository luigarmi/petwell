import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const STATE_ROW_ID = "petwell_fullstack_state";
const DEMO_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@petwell.local";
const DEMO_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || "Admin123!";
const DEMO_ADMIN_PHONE = process.env.BOOTSTRAP_ADMIN_PHONE?.trim() || "3000000000";
const DEMO_ADMIN_ID = "app-admin-0001";
const DEMO_CLINIC_ID = "app-clinic-0001";
const DEMO_SCHEDULE_ID = "app-schedule-0001";

let pool;
const requestContext = new AsyncLocalStorage();

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

function resolveDbUrl() {
    const direct = process.env.PETWELL_APP_DB_URL?.trim() || process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (direct) {
        return direct;
    }
    const base = process.env.PETWELL_POSTGRES_BASE_URL?.trim() || process.env.USER_DB_URL?.trim() || "";
    if (!base) {
        return null;
    }
    const preferredDbName = process.env.PETWELL_APP_DB_NAME?.trim();
    if (!preferredDbName) {
        return base;
    }
    try {
        const url = new URL(base);
        url.pathname = `/${preferredDbName}`;
        return url.toString();
    }
    catch {
        return base;
    }
}

function resolveSslConfig(connectionString) {
    const sslModeFromEnv = (process.env.POSTGRES_SSL_MODE ?? "").trim().toLowerCase();
    const rejectUnauthorized = ((process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED ?? (sslModeFromEnv.startsWith("verify") ? "true" : "false")) === "true");
    try {
        const url = new URL(connectionString);
        const sslModeFromUrl = url.searchParams.get("sslmode")?.trim().toLowerCase() ?? "";
        const sslMode = sslModeFromUrl || sslModeFromEnv;
        const shouldUseSsl = ["require", "verify-ca", "verify-full"].includes(sslMode);
        if (!shouldUseSsl) {
            return undefined;
        }
        return { rejectUnauthorized };
    }
    catch {
        return sslModeFromEnv ? { rejectUnauthorized } : undefined;
    }
}

export function canUseIntegratedApi() {
    return Boolean(resolveDbUrl());
}

function getPool() {
    const connectionString = resolveDbUrl();
    if (!connectionString) {
        return null;
    }
    if (!pool) {
        pool = new Pool({
            connectionString,
            ssl: resolveSslConfig(connectionString),
            application_name: "petwell-integrated-api"
        });
    }
    return pool;
}

async function ensureStateTable(client) {
    await client.query(`
    CREATE TABLE IF NOT EXISTS petwell_app_state (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function toSessionUser(user) {
    return {
        id: user.id,
        email: user.email,
        roles: [...user.roles],
        clinicIds: [...user.clinicIds],
        fullName: user.fullName
    };
}
function toAdminUser(user) {
    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        status: user.status,
        roles: [...user.roles]
    };
}
function buildToken(state, userId) {
    if (typeof state === "string" && userId === undefined) {
        userId = state;
        state = undefined;
    }
    const currentState = state ?? requestContext.getStore()?.state;
    if (!currentState) {
        return `pw_${crypto.randomBytes(24).toString("hex")}`;
    }
    const token = `pw_${crypto.randomBytes(24).toString("hex")}`;
    currentState.sessions = [
        {
            id: nextId(currentState, "session"),
            userId,
            token,
            createdAt: nowIso()
        },
        ...currentState.sessions.filter((session) => session.userId !== userId)
    ].slice(0, 200);
    return token;
}
function nowIso() {
    return new Date().toISOString();
}
function buildRoomUrl(baseUrl, appointmentId) {
    return `${baseUrl.replace(/\/+$/, "")}/telemed/${appointmentId}`;
}
function buildDemoUrl(path) {
    const store = requestContext.getStore();
    const baseUrl = store?.baseUrl ?? "https://petwell.local";
    return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
function createNotification(id, category, title, message, options) {
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
async function createInitialState() {
    const createdAt = nowIso();
    const adminUser = {
        id: DEMO_ADMIN_ID,
        email: DEMO_ADMIN_EMAIL,
        phone: DEMO_ADMIN_PHONE,
        passwordHash: await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10),
        status: "ACTIVE",
        roles: ["OWNER", "CLINIC_ADMIN", "VET", "RECEPTIONIST", "ADMIN"],
        clinicIds: [DEMO_CLINIC_ID],
        fullName: "Equipo PetWell"
    };
    return {
        nextSequence: 1,
        sessions: [],
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
            createNotification("demo-note-0001", "SYSTEM", "Tu espacio esta listo", "Ya puedes recorrer la plataforma y conocer cada seccion con tranquilidad.", { userId: DEMO_ADMIN_ID, clinicId: DEMO_CLINIC_ID, createdAt })
        ],
        invoices: [],
        telemedRooms: [],
        records: [],
        vaccinations: [],
        prescriptions: []
    };
}
function normalizeState(state) {
    if (!state || typeof state !== "object") {
        return null;
    }
    return {
        nextSequence: Number.isFinite(state.nextSequence) ? state.nextSequence : 1,
        sessions: Array.isArray(state.sessions) ? state.sessions : [],
        users: Array.isArray(state.users) ? state.users : [],
        clinics: Array.isArray(state.clinics) ? state.clinics : [],
        clinicStaff: Array.isArray(state.clinicStaff) ? state.clinicStaff : [],
        pets: Array.isArray(state.pets) ? state.pets : [],
        consents: Array.isArray(state.consents) ? state.consents : [],
        schedules: Array.isArray(state.schedules) ? state.schedules : [],
        appointments: Array.isArray(state.appointments) ? state.appointments : [],
        notifications: Array.isArray(state.notifications) ? state.notifications : [],
        invoices: Array.isArray(state.invoices) ? state.invoices : [],
        telemedRooms: Array.isArray(state.telemedRooms) ? state.telemedRooms : [],
        records: Array.isArray(state.records) ? state.records : [],
        vaccinations: Array.isArray(state.vaccinations) ? state.vaccinations : [],
        prescriptions: Array.isArray(state.prescriptions) ? state.prescriptions : []
    };
}
async function loadStateForUpdate(client) {
    await ensureStateTable(client);
    const existing = await client.query("SELECT state FROM petwell_app_state WHERE id = $1 FOR UPDATE", [STATE_ROW_ID]);
    if (!existing.rowCount) {
        const state = await createInitialState();
        await client.query("INSERT INTO petwell_app_state (id, state, updated_at) VALUES ($1, $2::jsonb, NOW())", [
            STATE_ROW_ID,
            JSON.stringify(state)
        ]);
        return state;
    }
    const normalized = normalizeState(existing.rows[0].state);
    if (normalized?.users.length) {
        return normalized;
    }
    const resetState = await createInitialState();
    await client.query("UPDATE petwell_app_state SET state = $2::jsonb, updated_at = NOW() WHERE id = $1", [
        STATE_ROW_ID,
        JSON.stringify(resetState)
    ]);
    return resetState;
}
async function persistState(client, state) {
    await client.query("UPDATE petwell_app_state SET state = $2::jsonb, updated_at = NOW() WHERE id = $1", [
        STATE_ROW_ID,
        JSON.stringify(state)
    ]);
}
async function readState() {
    const store = requestContext.getStore();
    if (!store) {
        return createInitialState();
    }
    if (!store.state) {
        store.state = await loadStateForUpdate(store.client);
    }
    return store.state;
}
function writeState(_state) {
    const store = requestContext.getStore();
    if (store) {
        store.dirty = true;
    }
}
function nextId(state, prefix) {
    state.nextSequence += 1;
    return `${prefix}-${state.nextSequence.toString().padStart(4, "0")}`;
}
function parseBody(init) {
    if (!init?.body || typeof init.body !== "string") {
        return {};
    }
    try {
        return JSON.parse(init.body);
    }
    catch {
        return {};
    }
}
function unauthorized(message = "Authentication required") {
    throw new HttpError(401, message);
}
function notAllowed(message = "Insufficient permissions") {
    throw new HttpError(403, message);
}
function notFound(message = "Resource not found") {
    throw new HttpError(404, message);
}
function requireUser(state, token) {
    if (!token) {
        unauthorized();
    }
    const session = state.sessions.find((item) => item.token === token);
    if (!session) {
        unauthorized();
    }
    const user = state.users.find((item) => item.id === session.userId);
    if (!user) {
        unauthorized();
    }
    return user;
}
function hasAnyRole(user, roles) {
    return roles.some((role) => user.roles.includes(role));
}
function requireRole(user, roles) {
    if (!hasAnyRole(user, roles)) {
        notAllowed();
    }
}
function clinicIdsForUser(user, state) {
    if (user.roles.includes("ADMIN")) {
        return state.clinics.map((clinic) => clinic.id);
    }
    return user.clinicIds.length ? user.clinicIds : state.clinics.map((clinic) => clinic.id);
}
function visiblePets(user, state) {
    const clinicIds = new Set(clinicIdsForUser(user, state));
    return state.pets.filter((pet) => pet.ownerIds.includes(user.id) || user.roles.includes("ADMIN") || clinicIds.has(pet.primaryClinicId));
}
function visibleAppointments(user, state) {
    const clinicIds = new Set(clinicIdsForUser(user, state));
    return state.appointments.filter((appointment) => appointment.ownerUserId === user.id || user.roles.includes("ADMIN") || clinicIds.has(appointment.clinicId));
}
function visibleInvoices(user, state) {
    const appointmentIds = new Set(visibleAppointments(user, state).map((appointment) => appointment.id));
    return state.invoices.filter((item) => appointmentIds.has(item.appointmentId));
}
function visibleRooms(user, state) {
    const appointmentIds = new Set(visibleAppointments(user, state).map((appointment) => appointment.id));
    return state.telemedRooms.filter((room) => appointmentIds.has(room.appointmentId));
}
function visibleNotifications(user, state) {
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
function ensureClinicStaffCount(state) {
    state.clinics = state.clinics.map((clinic) => ({
        ...clinic,
        staffCount: state.clinicStaff.filter((member) => member.clinicId === clinic.id).length
    }));
}
function addNotification(state, category, title, message, options) {
    state.notifications.unshift(createNotification(nextId(state, "note"), category, title, message, {
        userId: options?.userId,
        clinicId: options?.clinicId
    }));
}
function buildAnalytics(state) {
    const totalRevenue = state.invoices.reduce((sum, item) => sum + (item.payment?.status === "SUCCEEDED" ? item.invoice.total : 0), 0);
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
function sanitizeRoles(roles) {
    const allowed = new Set(["OWNER", "CLINIC_ADMIN", "VET", "RECEPTIONIST", "ADMIN"]);
    const selected = (roles ?? []).filter((role) => allowed.has(role));
    return selected.length ? Array.from(new Set(selected)) : ["OWNER"];
}
function createDemoResponse(value) {
    return clone(value);
}
function matchPath(path, pattern) {
    return path.match(pattern);
}
export function getDemoCredentials() {
    return {
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASSWORD
    };
}
export async function handleDemoApiRequest(path, token, init) {
    const method = (init?.method ?? "GET").toUpperCase();
    const cleanPath = path.replace(/\/+$/, "") || "/";
    const state = await readState();
    if (cleanPath === "/users/register" && method === "POST") {
        const body = parseBody(init);
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!email || !body.password || !body.fullName || !body.phone) {
            throw new HttpError(400, "Missing required registration fields");
        }
        if (state.users.some((user) => user.email.toLowerCase() === email)) {
            throw new HttpError(409, "Email already registered");
        }
        const user = {
            id: nextId(state, "user"),
            email,
            phone: String(body.phone),
            passwordHash: await bcrypt.hash(String(body.password), 10),
            status: "ACTIVE",
            roles: ["OWNER"],
            clinicIds: [],
            fullName: String(body.fullName)
        };
        state.users.push(user);
        addNotification(state, "ACCOUNT", "Cuenta creada", `${user.fullName} ya puede empezar a usar PetWell.`, { userId: user.id });
        writeState(state);
        return createDemoResponse({
            token: buildToken(user.id),
            user: toSessionUser(user)
        });
    }
    if (cleanPath === "/users/login" && method === "POST") {
        const body = parseBody(init);
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const user = state.users.find((item) => item.email.toLowerCase() === email);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            throw new HttpError(401, "Invalid email or password");
        }
        writeState(state);
        return createDemoResponse({
            token: buildToken(user.id),
            user: toSessionUser(user)
        });
    }
    const currentUser = requireUser(state, token);
    if (cleanPath === "/users/me" && method === "GET") {
        return createDemoResponse({ user: toSessionUser(currentUser) });
    }
    if (cleanPath === "/users/clinics" && method === "GET") {
        ensureClinicStaffCount(state);
        writeState(state);
        return createDemoResponse({ clinics: state.clinics });
    }
    if (cleanPath === "/users/admin/users" && method === "GET") {
        requireRole(currentUser, ["ADMIN"]);
        return createDemoResponse({ users: state.users.map(toAdminUser) });
    }
    const roleMatch = matchPath(cleanPath, /^\/users\/admin\/users\/([^/]+)\/roles$/);
    if (roleMatch && method === "PUT") {
        requireRole(currentUser, ["ADMIN"]);
        const target = state.users.find((user) => user.id === roleMatch[1]);
        if (!target) {
            notFound("User not found");
        }
        const body = parseBody(init);
        target.roles = sanitizeRoles(body.roles);
        addNotification(state, "GOVERNANCE", "Permisos actualizados", `Se actualizo el acceso de ${target.fullName}.`, { userId: target.id });
        writeState(state);
        return createDemoResponse({ user: toAdminUser(target) });
    }
    if (cleanPath === "/users/clinics" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN"]);
        const body = parseBody(init);
        const clinic = {
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
        return createDemoResponse({ clinic });
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
        addNotification(state, "CLINIC", "Equipo actualizado", `${targetUser.fullName} fue asignado a ${clinic.legalName}.`, { clinicId });
        writeState(state);
        return createDemoResponse({ ok: true });
    }
    if (cleanPath === "/pets" && method === "GET") {
        return createDemoResponse({ pets: visiblePets(currentUser, state) });
    }
    const petDetailMatch = matchPath(cleanPath, /^\/pets\/([^/]+)$/);
    if (petDetailMatch && method === "GET") {
        const pet = visiblePets(currentUser, state).find((item) => item.id === petDetailMatch[1]) ?? null;
        if (!pet) {
            notFound("Pet not found");
        }
        return createDemoResponse({ pet });
    }
    if (cleanPath === "/pets" && method === "POST") {
        requireRole(currentUser, ["OWNER", "ADMIN"]);
        const body = parseBody(init);
        const clinicId = String(body.primaryClinicId ?? "");
        if (!state.clinics.some((clinic) => clinic.id === clinicId)) {
            notFound("Clinic not found");
        }
        const pet = {
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
        return createDemoResponse({ pet });
    }
    if (cleanPath === "/ehr/consents" && method === "GET") {
        const clinicIds = new Set(clinicIdsForUser(currentUser, state));
        const consents = state.consents.filter((item) => currentUser.roles.includes("ADMIN") || item.ownerUserId === currentUser.id || clinicIds.has(item.clinicId));
        return createDemoResponse({ consents });
    }
    if (cleanPath === "/ehr/consents" && method === "POST") {
        requireRole(currentUser, ["OWNER", "ADMIN"]);
        const body = parseBody(init);
        const petId = String(body.petId ?? "");
        const pet = state.pets.find((item) => item.id === petId);
        if (!pet || !pet.ownerIds.includes(currentUser.id)) {
            throw new HttpError(403, "Pet ownership required");
        }
        const consent = {
            id: nextId(state, "consent"),
            petId,
            ownerUserId: currentUser.id,
            clinicId: String(body.clinicId ?? ""),
            scope: String(body.scope ?? "CONSULTA"),
            createdAt: nowIso()
        };
        state.consents.push(consent);
        addNotification(state, "EHR", "Acceso autorizado", `La clinica ya puede revisar la informacion de ${pet.name}.`, { userId: currentUser.id, clinicId: consent.clinicId });
        writeState(state);
        return createDemoResponse({ consent });
    }
    if (cleanPath === "/appointments/schedules" && method === "GET") {
        return createDemoResponse({ schedules: state.schedules });
    }
    if (cleanPath === "/appointments/schedules" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
        const body = parseBody(init);
        const schedule = {
            id: nextId(state, "schedule"),
            clinicId: String(body.clinicId ?? ""),
            vetUserId: String(body.vetUserId ?? currentUser.id),
            dayOfWeek: Number(body.dayOfWeek ?? 1),
            start: String(body.start ?? "08:00"),
            end: String(body.end ?? "16:00"),
            slotMinutes: Number(body.slotMinutes ?? 30)
        };
        state.schedules.push(schedule);
        addNotification(state, "SCHEDULE", "Horario listo", "La disponibilidad ya quedo organizada.", { clinicId: schedule.clinicId });
        writeState(state);
        return createDemoResponse({ schedule });
    }
    if (cleanPath === "/appointments" && method === "GET") {
        return createDemoResponse({ appointments: visibleAppointments(currentUser, state) });
    }
    if (cleanPath === "/appointments" && method === "POST") {
        requireRole(currentUser, ["OWNER", "ADMIN"]);
        const body = parseBody(init);
        const petId = String(body.petId ?? "");
        const pet = state.pets.find((item) => item.id === petId);
        if (!pet || !pet.ownerIds.includes(currentUser.id)) {
            throw new HttpError(403, "Pet ownership required");
        }
        const appointment = {
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
        addNotification(state, "APPOINTMENT", "Cita creada", `La cita de ${pet.name} ya quedo reservada y esta pendiente de pago.`, { userId: currentUser.id, clinicId: appointment.clinicId });
        writeState(state);
        return createDemoResponse({ appointment });
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
            addNotification(state, "APPOINTMENT", "Consulta finalizada", "La atencion ya fue marcada como finalizada.", { clinicId: appointment.clinicId, userId: appointment.ownerUserId });
        }
        else if (action === "confirm") {
            requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "RECEPTIONIST"]);
            appointment.status = "CONFIRMED";
        }
        else {
            appointment.status = "CANCELLED";
        }
        writeState(state);
        return createDemoResponse({ appointment });
    }
    if (cleanPath === "/payments" && method === "POST") {
        requireRole(currentUser, ["OWNER", "ADMIN"]);
        const body = parseBody(init);
        const appointment = state.appointments.find((item) => item.id === String(body.appointmentId ?? ""));
        if (!appointment || (appointment.ownerUserId !== currentUser.id && !currentUser.roles.includes("ADMIN"))) {
            notFound("Appointment not found");
        }
        const existing = state.invoices.find((item) => item.appointmentId === appointment.id);
        const invoice = existing ??
            {
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
            };
        if (!existing) {
            state.invoices.unshift(invoice);
        }
        else {
            existing.invoice.status = "PAID";
            existing.payment = {
                id: nextId(state, "payment"),
                amount: Number(body.amount ?? existing.invoice.total),
                provider: String(body.provider ?? "SIMULATED"),
                status: "SUCCEEDED"
            };
        }
        appointment.status = "CONFIRMED";
        addNotification(state, "BILLING", "Pago confirmado", `Se registro el pago de ${Math.round(Number(body.amount ?? 95000)).toLocaleString("es-CO")} y la cita quedo confirmada.`, { userId: currentUser.id, clinicId: appointment.clinicId });
        addNotification(state, "APPOINTMENT", "Cita confirmada", "La cita ya quedo confirmada y visible en tu agenda.", {
            userId: currentUser.id,
            clinicId: appointment.clinicId
        });
        if (appointment.type === "TELEMED" && !state.telemedRooms.some((room) => room.appointmentId === appointment.id)) {
            const room = {
                appointmentId: appointment.id,
                roomCode: `PW-${nextId(state, "room").slice(-4).toUpperCase()}`,
                roomUrl: buildDemoUrl(`/telemed/${appointment.id}`),
                createdAt: nowIso()
            };
            state.telemedRooms.unshift(room);
            addNotification(state, "TELEMED", "Video consulta lista", "La sala virtual ya esta lista para entrar.", { userId: currentUser.id, clinicId: appointment.clinicId });
        }
        writeState(state);
        return createDemoResponse({ invoice });
    }
    if (cleanPath === "/payments/invoices" && method === "GET") {
        return createDemoResponse({ invoices: visibleInvoices(currentUser, state) });
    }
    const paymentMatch = matchPath(cleanPath, /^\/payments\/([^/]+)$/);
    if (paymentMatch && method === "GET") {
        const item = state.invoices.find((invoice) => invoice.appointmentId === paymentMatch[1]);
        return createDemoResponse({ payment: item?.payment ?? null, invoice: item?.invoice ?? null });
    }
    if (cleanPath === "/telemed/rooms" && method === "GET") {
        return createDemoResponse({ rooms: visibleRooms(currentUser, state) });
    }
    const roomMatch = matchPath(cleanPath, /^\/telemed\/rooms\/([^/]+)$/);
    if (roomMatch && method === "GET") {
        const room = visibleRooms(currentUser, state).find((item) => item.appointmentId === roomMatch[1]) ?? null;
        return createDemoResponse({ room });
    }
    if (cleanPath === "/notifications" && method === "GET") {
        return createDemoResponse({ notifications: visibleNotifications(currentUser, state) });
    }
    if (cleanPath === "/notifications/send" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "RECEPTIONIST"]);
        const body = parseBody(init);
        addNotification(state, "MANUAL", String(body.title ?? "Aviso manual"), String(body.message ?? "Mensaje sin detalle"), {
            clinicId: String(body.clinicId ?? "") || undefined,
            userId: String(body.userId ?? "") || undefined
        });
        writeState(state);
        return createDemoResponse({ ok: true });
    }
    if (cleanPath === "/analytics/summary" && method === "GET") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET", "RECEPTIONIST"]);
        return createDemoResponse(buildAnalytics(state));
    }
    if (cleanPath === "/analytics/events" && method === "GET") {
        return createDemoResponse({ events: state.notifications });
    }
    if (cleanPath === "/ehr/access-logs" && method === "GET") {
        return createDemoResponse({ accessLogs: [] });
    }
    if (cleanPath === "/ehr/records" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
        const body = parseBody(init);
        const petId = String(body.petId ?? "");
        const pet = state.pets.find((item) => item.id === petId);
        if (!pet) {
            notFound("Pet not found");
        }
        const record = {
            id: nextId(state, "record"),
            petId,
            clinicId: String(body.clinicId ?? pet.primaryClinicId),
            vetUserId: currentUser.id,
            reason: String(body.reason ?? "Consulta general"),
            notes: String(body.notes ?? ""),
            createdAt: nowIso()
        };
        state.records.unshift(record);
        addNotification(state, "CLINICAL", "Consulta guardada", "Se guardo una nueva nota de consulta.", { clinicId: record.clinicId, userId: pet.ownerIds[0] });
        writeState(state);
        return createDemoResponse({ record });
    }
    if (cleanPath === "/ehr/vaccinations" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
        const body = parseBody(init);
        const petId = String(body.petId ?? "");
        const pet = state.pets.find((item) => item.id === petId);
        if (!pet) {
            notFound("Pet not found");
        }
        const vaccination = {
            id: nextId(state, "vaccine"),
            petId,
            clinicId: String(body.clinicId ?? pet.primaryClinicId),
            vaccineCode: String(body.vaccineCode ?? "VAC"),
            date: String(body.date ?? new Date().toISOString().slice(0, 10))
        };
        state.vaccinations.unshift(vaccination);
        addNotification(state, "CLINICAL", "Vacunacion registrada", `Se registro la vacuna ${vaccination.vaccineCode}.`, { clinicId: vaccination.clinicId, userId: pet.ownerIds[0] });
        writeState(state);
        return createDemoResponse({ vaccination });
    }
    if (cleanPath === "/ehr/prescriptions" && method === "POST") {
        requireRole(currentUser, ["ADMIN", "CLINIC_ADMIN", "VET"]);
        const body = parseBody(init);
        const petId = String(body.petId ?? "");
        const pet = state.pets.find((item) => item.id === petId);
        if (!pet) {
            notFound("Pet not found");
        }
        const prescription = {
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
        addNotification(state, "CLINICAL", "Tratamiento guardado", `Se guardo la indicacion de ${prescription.drug}.`, { clinicId: prescription.clinicId, userId: pet.ownerIds[0] });
        writeState(state);
        return createDemoResponse({ prescription });
    }
    const recordsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/records$/);
    if (recordsMatch && method === "GET") {
        const petId = recordsMatch[1];
        const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
        if (!allowed) {
            throw new HttpError(403, "Record access denied");
        }
        return createDemoResponse({
            records: state.records
                .filter((item) => item.petId === petId)
                .map(({ petId: _petId, clinicId: _clinicId, vetUserId: _vetUserId, createdAt: _createdAt, ...item }) => item)
        });
    }
    const vaccinationsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/vaccinations$/);
    if (vaccinationsMatch && method === "GET") {
        const petId = vaccinationsMatch[1];
        const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
        if (!allowed) {
            throw new HttpError(403, "Vaccination access denied");
        }
        return createDemoResponse({
            vaccinations: state.vaccinations
                .filter((item) => item.petId === petId)
                .map(({ petId: _petId, clinicId: _clinicId, ...item }) => item)
        });
    }
    const prescriptionsMatch = matchPath(cleanPath, /^\/ehr\/pets\/([^/]+)\/prescriptions$/);
    if (prescriptionsMatch && method === "GET") {
        const petId = prescriptionsMatch[1];
        const allowed = visiblePets(currentUser, state).some((pet) => pet.id === petId);
        if (!allowed) {
            throw new HttpError(403, "Record access denied");
        }
        return createDemoResponse({
            prescriptions: state.prescriptions
                .filter((item) => item.petId === petId)
                .map(({ petId: _petId, clinicId: _clinicId, vetUserId: _vetUserId, frequency: _frequency, start: _start, end: _end, ...item }) => item)
        });
    }
    throw new HttpError(404, `Route not implemented: ${method} ${cleanPath}`);
}
export async function handleIntegratedApiRequest({ path, method = "GET", token, bodyText = "", baseUrl = "https://petwell.local" }) {
    const db = getPool();
    if (!db) {
        throw new HttpError(500, "Missing PETWELL_APP_DB_URL or POSTGRES_URL. Configure a Postgres database for the integrated API.");
    }
    const client = await db.connect();
    const context = {
        client,
        state: null,
        dirty: false,
        baseUrl
    };
    try {
        await client.query("BEGIN");
        const result = await requestContext.run(context, async () => handleDemoApiRequest(path, token, { method, body: bodyText }));
        if (context.dirty && context.state) {
            await persistState(client, context.state);
        }
        await client.query("COMMIT");
        return {
            status: 200,
            payload: result
        };
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
export function isHttpError(error) {
    return error instanceof HttpError;
}

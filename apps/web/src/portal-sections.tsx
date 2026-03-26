import { dayName, formatDate } from "./api.js";
import { InlineForm, Panel } from "./components.js";
import {
  ROLE_OPTIONS,
  appointmentStatusLabel,
  appointmentTypeLabel,
  canCompleteAppointments,
  canManageStaff,
  canSendNotifications,
  canWriteEhr,
  hasRole,
  notificationCategoryLabel,
  roleLabel,
  type AdminUser,
  type AnalyticsSummary,
  type Appointment,
  type Clinic,
  type InvoiceItem,
  type Notification,
  type Pet,
  type Role,
  type Schedule,
  type SessionUser,
  type SimpleItem,
  type TelemedRoom
} from "./dashboard-models.js";
import { EmptyState, HistoryColumns } from "./dashboard-shared.js";

type SubmitJson = (path: string, body: Record<string, unknown>, method?: string) => Promise<void>;

export function OwnerPortal(props: {
  clinics: Clinic[];
  pets: Pet[];
  schedules: Schedule[];
  appointments: Appointment[];
  invoices: InvoiceItem[];
  telemedRooms: TelemedRoom[];
  selectedPetId: string;
  setSelectedPetId: (value: string) => void;
  records: SimpleItem[];
  vaccinations: SimpleItem[];
  prescriptions: SimpleItem[];
  submitJson: SubmitJson;
  payAppointment: (appointmentId: string) => Promise<void>;
}) {
  const selectedPet = props.pets.find((pet) => pet.id === props.selectedPetId) ?? null;
  const clinicNames = new Map(props.clinics.map((clinic) => [clinic.id, clinic.legalName]));
  const petNames = new Map(props.pets.map((pet) => [pet.id, pet.name]));
  const appointmentsById = new Map(props.appointments.map((appointment) => [appointment.id, appointment]));

  return (
    <div className="portal-grid">
      <Panel eyebrow="Mascotas" title="Tu espacio de cuidado">
        <div className="panel-copy">
          <p>Registra a tus mascotas, mantén sus datos al dia y comparte acceso con tu clinica cuando lo necesites.</p>
        </div>
        <div className="form-cluster two-up">
          <InlineForm
            title="Nueva mascota"
            fields={[
              { name: "name", placeholder: "Nombre" },
              { name: "species", placeholder: "Especie" },
              { name: "breed", placeholder: "Raza" }
            ]}
            extraField={
              <select name="primaryClinicId" required>
                <option value="">Clinica principal</option>
                {props.clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.legalName}
                  </option>
                ))}
              </select>
            }
            submitLabel="Guardar mascota"
            onSubmit={(data) => props.submitJson("/pets", data)}
          />

          <InlineForm
            title="Autorizar a tu clinica"
            fields={[{ name: "scope", placeholder: "Que puede consultar la clinica" }]}
            extraField={
              <>
                <select name="petId" required>
                  <option value="">Mascota</option>
                  {props.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
                <select name="clinicId" required>
                  <option value="">Clinica</option>
                  {props.clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.legalName}
                    </option>
                  ))}
                </select>
              </>
            }
            submitLabel="Autorizar acceso"
            onSubmit={(data) => props.submitJson("/ehr/consents", data)}
          />
        </div>

        <div className="entity-grid">
          {props.pets.length ? (
            props.pets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                className={`entity-card entity-card-button ${props.selectedPetId === pet.id ? "is-active" : ""}`}
                onClick={() => props.setSelectedPetId(pet.id)}
              >
                <span className="entity-kicker">{pet.species}</span>
                <strong>{pet.name}</strong>
                <span>{pet.breed}</span>
              </button>
            ))
          ) : (
            <EmptyState text="Todavia no has registrado mascotas." />
          )}
        </div>
      </Panel>

      <Panel eyebrow="Citas" title="Agenda una consulta">
        <div className="panel-copy">
          <p>Elige la mascota, la clinica y la hora que mejor te funcione.</p>
        </div>
        <InlineForm
          title="Programar cita"
          fields={[
            { name: "startTime", type: "datetime-local", placeholder: "Inicio" },
            { name: "endTime", type: "datetime-local", placeholder: "Fin" }
          ]}
          extraField={
            <>
              <select name="petId" required>
                <option value="">Mascota</option>
                {props.pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                  </option>
                ))}
              </select>
              <select name="clinicId" required>
                <option value="">Clinica</option>
                {props.clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.legalName}
                  </option>
                ))}
              </select>
              <select name="vetUserId" required>
                <option value="">Profesional disponible</option>
                {props.schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.vetUserId}>
                    {(clinicNames.get(schedule.clinicId) ?? "Clinica")} · {dayName(schedule.dayOfWeek)} · {schedule.start} a{" "}
                    {schedule.end}
                  </option>
                ))}
              </select>
              <select name="type" required>
                <option value="IN_PERSON">Presencial</option>
                <option value="TELEMED">Video consulta</option>
              </select>
            </>
          }
          submitLabel="Reservar cita"
          onSubmit={(data) =>
            props.submitJson("/appointments", {
              ...data,
              startTime: new Date(String(data.startTime)).toISOString(),
              endTime: new Date(String(data.endTime)).toISOString()
            })
          }
        />
      </Panel>

      <Panel eyebrow="Seguimiento" title="Tus citas y pagos">
        <div className="feed-columns">
          <div className="feed-group">
            <h3>Citas</h3>
            {props.appointments.length ? (
              props.appointments.map((appointment) => (
                <article key={appointment.id} className="feed-card">
                  <div>
                    <strong>{appointmentTypeLabel(appointment.type)}</strong>
                    <span>{formatDate(appointment.startTime)}</span>
                    <small>
                      {petNames.get(appointment.petId) ?? "Mascota"} ·{" "}
                      {clinicNames.get(appointment.clinicId) ?? "Clinica"}
                    </small>
                  </div>
                  <div className="feed-actions">
                    <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                      {appointmentStatusLabel(appointment.status)}
                    </span>
                    {appointment.status === "PENDING_PAYMENT" ? (
                      <button type="button" onClick={() => void props.payAppointment(appointment.id)}>
                        Pagar consulta
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="Aun no tienes citas programadas." />
            )}
          </div>

          <div className="feed-group">
            <h3>Comprobantes</h3>
            {props.invoices.length ? (
              props.invoices.map((item) => (
                <article key={item.invoice.id} className="feed-card">
                  <div>
                    <strong>Pago registrado</strong>
                    <span>{formatDate(item.invoice.issuedAt)}</span>
                    <small>
                      {petNames.get(appointmentsById.get(item.appointmentId)?.petId ?? "") ?? "Consulta"} ·{" "}
                      {clinicNames.get(appointmentsById.get(item.appointmentId)?.clinicId ?? "") ?? "Clinica"}
                    </small>
                  </div>
                  <small>${item.invoice.total.toLocaleString("es-CO")}</small>
                </article>
              ))
            ) : (
              <EmptyState text="Tus comprobantes apareceran aqui despues del pago." />
            )}
          </div>

          <div className="feed-group">
            <h3>Video consultas</h3>
            {props.telemedRooms.length ? (
              props.telemedRooms.map((room) => (
                <article key={room.appointmentId} className="feed-card">
                  <div>
                    <strong>Sala lista</strong>
                    <span>{formatDate(room.createdAt)}</span>
                    <small>{petNames.get(appointmentsById.get(room.appointmentId)?.petId ?? "") ?? "Consulta virtual"}</small>
                  </div>
                  <a href={room.roomUrl} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                </article>
              ))
            ) : (
              <EmptyState text="Todavia no tienes video consultas activas." />
            )}
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Historia clinica" title={selectedPet ? selectedPet.name : "Selecciona una mascota"}>
        {selectedPet ? (
          <HistoryColumns
            records={props.records}
            vaccinations={props.vaccinations}
            prescriptions={props.prescriptions}
          />
        ) : (
          <EmptyState text="Selecciona una mascota para ver sus consultas, vacunas y tratamientos." />
        )}
      </Panel>
    </div>
  );
}

export function ClinicPortal(props: {
  user: SessionUser;
  clinics: Clinic[];
  pets: Pet[];
  appointments: Appointment[];
  analytics: AnalyticsSummary | null;
  notifications: Notification[];
  selectedPetId: string;
  setSelectedPetId: (value: string) => void;
  records: SimpleItem[];
  vaccinations: SimpleItem[];
  prescriptions: SimpleItem[];
  submitJson: SubmitJson;
}) {
  const selectedPet = props.pets.find((pet) => pet.id === props.selectedPetId) ?? null;
  const clinicNames = new Map(props.clinics.map((clinic) => [clinic.id, clinic.legalName]));
  const petNames = new Map(props.pets.map((pet) => [pet.id, pet.name]));

  return (
    <div className="portal-grid">
      {(hasRole(props.user, "CLINIC_ADMIN") || canManageStaff(props.user)) && (
        <Panel eyebrow="Clinica" title="Sede y equipo">
          <div className="panel-copy">
            <p>Mantén ordenadas tus sedes y define quién atiende cada servicio sin llenar la pantalla de ruido.</p>
          </div>
          <div className="form-cluster two-up">
            {hasRole(props.user, "CLINIC_ADMIN") ? (
              <InlineForm
                title="Nueva sede"
                fields={[
                  { name: "legalName", placeholder: "Nombre de la clinica" },
                  { name: "taxId", placeholder: "Identificacion tributaria" },
                  { name: "address", placeholder: "Ciudad o direccion" }
                ]}
                submitLabel="Guardar sede"
                onSubmit={(data) => props.submitJson("/users/clinics", data)}
              />
            ) : null}

            {canManageStaff(props.user) ? (
              <InlineForm
                title="Agregar miembro"
                fields={[{ name: "userId", placeholder: "Codigo interno de la persona" }]}
                extraField={
                  <>
                    <select name="clinicId" required>
                      <option value="">Clinica</option>
                      {props.clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                          {clinic.legalName}
                        </option>
                      ))}
                    </select>
                    <select name="staffRole" required>
                      <option value="CLINIC_ADMIN">Administrador de clinica</option>
                      <option value="VET">Veterinario</option>
                      <option value="RECEPTIONIST">Recepcion</option>
                    </select>
                  </>
                }
                submitLabel="Agregar al equipo"
                onSubmit={(data) =>
                  props.submitJson(`/users/clinics/${String(data.clinicId)}/staff`, {
                    userId: data.userId,
                    staffRole: data.staffRole
                  })
                }
              />
            ) : null}
          </div>

          <div className="entity-grid">
            {props.clinics.length ? (
              props.clinics.map((clinic) => (
                <article key={clinic.id} className="entity-card">
                  <span className="entity-kicker">Sede</span>
                  <strong>{clinic.legalName}</strong>
                  <span>{clinic.address}</span>
                  <small>{clinic.staffCount ?? 0} personas en el equipo</small>
                </article>
              ))
            ) : (
              <EmptyState text="Todavia no hay sedes disponibles para esta cuenta." />
            )}
          </div>
        </Panel>
      )}

      <Panel eyebrow="Agenda" title="Horarios y consultas">
        <div className="form-cluster">
          <InlineForm
            title="Nuevo horario"
            fields={[
              { name: "vetUserId", placeholder: "Codigo interno del profesional" },
              { name: "start", type: "time", placeholder: "Desde" },
              { name: "end", type: "time", placeholder: "Hasta" },
              { name: "slotMinutes", type: "number", placeholder: "Duracion de cada cita (min)" }
            ]}
            extraField={
              <>
                <select name="dayOfWeek" required>
                  <option value="">Dia de atencion</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {dayName(day)}
                    </option>
                  ))}
                </select>
                <select name="clinicId" required>
                  <option value="">Clinica</option>
                  {props.clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.legalName}
                    </option>
                  ))}
                </select>
              </>
            }
            submitLabel="Guardar horario"
            onSubmit={(data) => props.submitJson("/appointments/schedules", data)}
          />
        </div>

        <div className="feed-columns">
          <div className="feed-group">
            <h3>Consultas programadas</h3>
            {props.appointments.length ? (
              props.appointments.map((appointment) => (
                <article key={appointment.id} className="feed-card">
                  <div>
                    <strong>{appointmentTypeLabel(appointment.type)}</strong>
                    <span>{formatDate(appointment.startTime)}</span>
                    <small>
                      {petNames.get(appointment.petId) ?? "Paciente"} ·{" "}
                      {clinicNames.get(appointment.clinicId) ?? "Clinica"}
                    </small>
                  </div>
                  <div className="feed-actions">
                    <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                      {appointmentStatusLabel(appointment.status)}
                    </span>
                    {appointment.status === "CONFIRMED" && canCompleteAppointments(props.user) ? (
                      <button
                        type="button"
                        onClick={() => void props.submitJson(`/appointments/${appointment.id}/complete`, {})}
                      >
                        Marcar como finalizada
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="Aun no hay consultas programadas." />
            )}
          </div>

          <div className="feed-group">
            <h3>Resumen</h3>
            {props.analytics?.global ? (
              <div className="kpi-stack">
                <article className="mini-kpi">
                  <span>Ingresos</span>
                  <strong>${Math.round(props.analytics.global.revenue).toLocaleString("es-CO")}</strong>
                </article>
                <article className="mini-kpi">
                  <span>Citas</span>
                  <strong>{props.analytics.global.totalAppointments}</strong>
                </article>
                <article className="mini-kpi">
                  <span>Video consultas</span>
                  <strong>{props.analytics.global.telemedCount}</strong>
                </article>
              </div>
            ) : (
              <EmptyState text="El resumen aparecera cuando haya movimiento en la agenda." />
            )}
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Pacientes" title="Pacientes y seguimiento">
        <div className="entity-grid">
          {props.pets.length ? (
            props.pets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                className={`entity-card entity-card-button ${props.selectedPetId === pet.id ? "is-active" : ""}`}
                onClick={() => props.setSelectedPetId(pet.id)}
              >
                <span className="entity-kicker">{pet.species}</span>
                <strong>{pet.name}</strong>
                <span>{pet.breed}</span>
                <small>{clinicNames.get(pet.primaryClinicId) ?? "Clinica principal"}</small>
              </button>
            ))
          ) : (
            <EmptyState text="Todavia no hay pacientes visibles para esta sede." />
          )}
        </div>

        {selectedPet ? (
          <HistoryColumns
            records={props.records}
            vaccinations={props.vaccinations}
            prescriptions={props.prescriptions}
          />
        ) : (
          <EmptyState text="Selecciona un paciente para ver su historia clinica." />
        )}
      </Panel>

      <div className="split-panels">
        {canWriteEhr(props.user) ? (
          <Panel eyebrow="Atencion" title="Registrar consulta">
            <div className="form-cluster">
              <InlineForm
                title="Notas de la consulta"
                fields={[
                  { name: "reason", placeholder: "Motivo de la visita" },
                  { name: "notes", placeholder: "Lo mas importante de la atencion" }
                ]}
                extraField={
                  <>
                    <select name="petId" required>
                      <option value="">Mascota</option>
                      {props.pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name}
                        </option>
                      ))}
                    </select>
                    <select name="clinicId" required>
                      <option value="">Clinica</option>
                      {props.clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                          {clinic.legalName}
                        </option>
                      ))}
                    </select>
                  </>
                }
                submitLabel="Guardar consulta"
                onSubmit={(data) => props.submitJson("/ehr/records", data)}
              />

              <InlineForm
                title="Vacuna aplicada"
                fields={[
                  { name: "vaccineCode", placeholder: "Nombre de la vacuna" },
                  { name: "date", type: "date", placeholder: "Fecha" },
                  { name: "batch", placeholder: "Lote" }
                ]}
                extraField={
                  <>
                    <select name="petId" required>
                      <option value="">Mascota</option>
                      {props.pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name}
                        </option>
                      ))}
                    </select>
                    <select name="clinicId" required>
                      <option value="">Clinica</option>
                      {props.clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                          {clinic.legalName}
                        </option>
                      ))}
                    </select>
                  </>
                }
                submitLabel="Registrar vacuna"
                onSubmit={(data) => props.submitJson("/ehr/vaccinations", data)}
              />

              <InlineForm
                title="Tratamiento indicado"
                fields={[
                  { name: "drug", placeholder: "Medicamento" },
                  { name: "dose", placeholder: "Dosis" },
                  { name: "frequency", placeholder: "Frecuencia" },
                  { name: "start", type: "date", placeholder: "Inicio" },
                  { name: "end", type: "date", placeholder: "Fin" },
                  { name: "notes", placeholder: "Indicaciones" }
                ]}
                extraField={
                  <>
                    <select name="petId" required>
                      <option value="">Mascota</option>
                      {props.pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name}
                        </option>
                      ))}
                    </select>
                    <select name="clinicId" required>
                      <option value="">Clinica</option>
                      {props.clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                          {clinic.legalName}
                        </option>
                      ))}
                    </select>
                  </>
                }
                submitLabel="Guardar tratamiento"
                onSubmit={(data) => props.submitJson("/ehr/prescriptions", data)}
              />
            </div>
          </Panel>
        ) : null}

        {canSendNotifications(props.user) ? (
          <Panel eyebrow="Comunicacion" title="Mensajes">
            <InlineForm
              title="Enviar mensaje"
              fields={[
                { name: "title", placeholder: "Asunto" },
                { name: "message", placeholder: "Mensaje" }
              ]}
              extraField={
                <>
                  <select name="clinicId">
                    <option value="">Enviar a toda la clinica (opcional)</option>
                    {props.clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.legalName}
                      </option>
                    ))}
                  </select>
                  <input name="userId" placeholder="Codigo interno de la persona (opcional)" />
                </>
              }
              submitLabel="Enviar"
              onSubmit={(data) => props.submitJson("/notifications/send", data)}
            />

            <div className="feed-group">
              <h3>Mensajes recientes</h3>
              {props.notifications.length ? (
                props.notifications.slice(0, 5).map((notification) => (
                  <article key={notification.id} className="feed-card">
                    <div>
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                    </div>
                    <small>{formatDate(notification.createdAt)}</small>
                  </article>
                ))
              ) : (
                <EmptyState text="Todavia no hay mensajes recientes." />
              )}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

export function AdminPortal(props: {
  clinics: Clinic[];
  users: AdminUser[];
  analytics: AnalyticsSummary | null;
  updateRoles: (userId: string, roles: Role[]) => Promise<void>;
  submitJson: SubmitJson;
}) {
  function toggleRoles(currentRoles: Role[], role: Role) {
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((item) => item !== role)
      : [...currentRoles, role];

    return nextRoles.length ? nextRoles : (["OWNER"] as Role[]);
  }

  return (
    <div className="portal-grid">
      <Panel eyebrow="Personas" title="Usuarios y permisos">
        <div className="panel-copy">
          <p>Organiza accesos y deja visible solo lo necesario para cada persona.</p>
        </div>
        <div className="entity-grid users-grid">
          {props.users.length ? (
            props.users.map((adminUser) => (
              <article key={adminUser.id} className="entity-card">
                <span className="entity-kicker">{adminUser.status === "ACTIVE" ? "Cuenta activa" : adminUser.status}</span>
                <strong>{adminUser.fullName}</strong>
                <span>{adminUser.email}</span>
                <small>{adminUser.phone}</small>
                <div className="chip-row">
                  {adminUser.roles.map((role) => (
                    <span key={role} className="soft-chip">
                      {roleLabel(role)}
                    </span>
                  ))}
                </div>
                <small>Activa o retira accesos segun la labor de esta persona.</small>
                <div className="role-actions">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={adminUser.roles.includes(role) ? "is-selected" : ""}
                      onClick={() => void props.updateRoles(adminUser.id, toggleRoles(adminUser.roles, role))}
                    >
                      {roleLabel(role)}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <EmptyState text="Todavia no hay usuarios registrados." />
          )}
        </div>
      </Panel>

      <div className="split-panels">
        <Panel eyebrow="Clinicas" title="Sedes registradas">
          <InlineForm
            title="Crear sede"
            fields={[
              { name: "legalName", placeholder: "Nombre de la clinica" },
              { name: "taxId", placeholder: "Identificacion tributaria" },
              { name: "address", placeholder: "Ciudad o direccion" }
            ]}
            submitLabel="Guardar sede"
            onSubmit={(data) => props.submitJson("/users/clinics", data)}
          />

          <div className="entity-grid">
            {props.clinics.length ? (
              props.clinics.map((clinic) => (
                <article key={clinic.id} className="entity-card">
                  <span className="entity-kicker">Sede</span>
                  <strong>{clinic.legalName}</strong>
                  <span>{clinic.address}</span>
                  <small>{clinic.staffCount ?? 0} personas en el equipo</small>
                </article>
              ))
            ) : (
              <EmptyState text="Todavia no hay sedes registradas." />
            )}
          </div>
        </Panel>

        <Panel eyebrow="Resumen" title="Vista general">
          {props.analytics?.global ? (
            <div className="kpi-stack">
              <article className="mini-kpi">
                <span>Clinicas activas</span>
                <strong>{props.analytics.global.activeClinics}</strong>
              </article>
              <article className="mini-kpi">
                <span>Mascotas</span>
                <strong>{props.analytics.global.registeredPets}</strong>
              </article>
              <article className="mini-kpi">
                <span>Citas</span>
                <strong>{props.analytics.global.totalAppointments}</strong>
              </article>
              <article className="mini-kpi">
                <span>Ingresos</span>
                <strong>${Math.round(props.analytics.global.revenue).toLocaleString("es-CO")}</strong>
              </article>
            </div>
          ) : (
            <EmptyState text="La vista general aparecera cuando haya movimiento en la plataforma." />
          )}

          <div className="feed-group">
            <h3>Por clinica</h3>
            {props.analytics?.clinics.length ? (
              props.analytics.clinics.map((clinic) => (
                <article key={`${clinic.clinicId}-${clinic.date}`} className="feed-card">
                  <div>
                    <strong>{clinic.appointments} citas</strong>
                    <span>Ocupacion del dia: {clinic.occupancy}%</span>
                  </div>
                  <small>${Math.round(clinic.revenue).toLocaleString("es-CO")}</small>
                </article>
              ))
            ) : (
              <EmptyState text="Todavia no hay datos suficientes para este resumen." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ActivityRail(props: {
  status: string;
  loading: boolean;
  notifications: Notification[];
  selectedPetName?: string;
  portalTitle: string;
}) {
  const lowerStatus = props.status.toLowerCase();
  const state = props.loading
    ? "syncing"
    : lowerStatus.includes("no fue") || lowerStatus.includes("no puedes") || lowerStatus.includes("actualizando")
      ? "attention"
      : "online";

  return (
    <div className="rail-stack">
      <Panel eyebrow="Hoy" title="Como va tu dia">
        <div className={`signal-banner signal-${state}`}>
          <span className="signal-chip">
            {state === "syncing" ? "Actualizando" : state === "attention" ? "Atencion" : "Al dia"}
          </span>
          <strong>{props.status}</strong>
          <p>
            {state === "attention"
              ? "Algunas secciones pueden tardar un poco mas de lo normal."
              : "Tu informacion principal esta lista para continuar."}
          </p>
        </div>
      </Panel>

      <Panel eyebrow="Novedades" title="Actividad reciente">
        <div className="feed-group">
          {props.notifications.length ? (
            props.notifications.slice(0, 6).map((notification) => (
              <article key={notification.id} className="timeline-card">
                <span className="timeline-dot" />
                <div className="timeline-copy">
                  <small className="timeline-tag">{notificationCategoryLabel(notification.category)}</small>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                </div>
                <small>{formatDate(notification.createdAt)}</small>
              </article>
            ))
          ) : (
            <EmptyState text="Todavia no hay novedades para mostrar." />
          )}
        </div>
      </Panel>

      <Panel eyebrow="En foco" title="Lo importante ahora">
        <div className="context-grid">
          <article className="context-card">
            <span>Seccion</span>
            <strong>{props.portalTitle}</strong>
          </article>
          <article className="context-card">
            <span>En pantalla</span>
            <strong>{props.selectedPetName ?? "Vista general"}</strong>
          </article>
        </div>
      </Panel>
    </div>
  );
}

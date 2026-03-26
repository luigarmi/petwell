import { dayName, formatDate } from "./api.js";
import { InlineForm, Panel } from "./components.js";
import {
  ROLE_OPTIONS,
  canCompleteAppointments,
  canManageStaff,
  canSendNotifications,
  canWriteEhr,
  hasRole,
  shortId,
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

  return (
    <div className="portal-grid">
      <Panel eyebrow="Perfil" title="Mascotas y permisos">
        <div className="panel-copy">
          <p>Registra perfiles y habilita el acceso clinico antes de cada atencion.</p>
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
            title="Consentimiento EHR"
            fields={[{ name: "scope", placeholder: "Alcance autorizado" }]}
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
                <small>{shortId(pet.id)}</small>
              </button>
            ))
          ) : (
            <EmptyState text="Todavia no hay mascotas registradas para este propietario." />
          )}
        </div>
      </Panel>

      <Panel eyebrow="Agenda" title="Reserva una consulta">
        <div className="panel-copy">
          <p>Elige mascota, sede y franja disponible. La cita nace en pendiente de pago.</p>
        </div>
        <InlineForm
          title="Nueva cita"
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
                <option value="">Veterinario</option>
                {props.schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.vetUserId}>
                    {shortId(schedule.vetUserId)} / {dayName(schedule.dayOfWeek)} {schedule.start}-{schedule.end}
                  </option>
                ))}
              </select>
              <select name="type" required>
                <option value="IN_PERSON">Presencial</option>
                <option value="TELEMED">Telemedicina</option>
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

      <Panel eyebrow="Seguimiento" title="Citas, pagos y salas">
        <div className="feed-columns">
          <div className="feed-group">
            <h3>Citas</h3>
            {props.appointments.length ? (
              props.appointments.map((appointment) => (
                <article key={appointment.id} className="feed-card">
                  <div>
                    <strong>{appointment.type === "TELEMED" ? "Telemedicina" : "Presencial"}</strong>
                    <span>{formatDate(appointment.startTime)}</span>
                  </div>
                  <div className="feed-actions">
                    <span className={`status-pill status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                    {appointment.status === "PENDING_PAYMENT" ? (
                      <button type="button" onClick={() => void props.payAppointment(appointment.id)}>
                        Pagar 95.000
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="Aun no hay citas registradas." />
            )}
          </div>

          <div className="feed-group">
            <h3>Facturas</h3>
            {props.invoices.length ? (
              props.invoices.map((item) => (
                <article key={item.invoice.id} className="feed-card">
                  <div>
                    <strong>Factura {shortId(item.invoice.id)}</strong>
                    <span>{item.invoice.status}</span>
                  </div>
                  <small>${item.invoice.total.toLocaleString("es-CO")}</small>
                </article>
              ))
            ) : (
              <EmptyState text="Las facturas apareceran despues del pago." />
            )}
          </div>

          <div className="feed-group">
            <h3>Salas telemedicina</h3>
            {props.telemedRooms.length ? (
              props.telemedRooms.map((room) => (
                <article key={room.appointmentId} className="feed-card">
                  <div>
                    <strong>{room.roomCode}</strong>
                    <span>{formatDate(room.createdAt)}</span>
                  </div>
                  <a href={room.roomUrl} target="_blank" rel="noreferrer">
                    Abrir sala
                  </a>
                </article>
              ))
            ) : (
              <EmptyState text="No hay salas activas todavia." />
            )}
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Historial" title={selectedPet ? `Historia visible de ${selectedPet.name}` : "Historia visible"}>
        {selectedPet ? (
          <HistoryColumns
            records={props.records}
            vaccinations={props.vaccinations}
            prescriptions={props.prescriptions}
          />
        ) : (
          <EmptyState text="Selecciona una mascota para revisar su historial." />
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

  return (
    <div className="portal-grid">
      {(hasRole(props.user, "CLINIC_ADMIN") || canManageStaff(props.user)) && (
        <Panel eyebrow="Operacion" title="Sede y staff">
          <div className="panel-copy">
            <p>Configura la sede y vincula al personal segun el contexto de la clinica.</p>
          </div>
          <div className="form-cluster two-up">
            {hasRole(props.user, "CLINIC_ADMIN") ? (
              <InlineForm
                title="Crear clinica"
                fields={[
                  { name: "legalName", placeholder: "Razon social" },
                  { name: "taxId", placeholder: "NIT" },
                  { name: "address", placeholder: "Direccion" }
                ]}
                submitLabel="Crear sede"
                onSubmit={(data) => props.submitJson("/users/clinics", data)}
              />
            ) : null}

            {canManageStaff(props.user) ? (
              <InlineForm
                title="Vincular staff"
                fields={[{ name: "userId", placeholder: "ID del usuario" }]}
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
                      <option value="CLINIC_ADMIN">CLINIC_ADMIN</option>
                      <option value="VET">VET</option>
                      <option value="RECEPTIONIST">RECEPTIONIST</option>
                    </select>
                  </>
                }
                submitLabel="Vincular"
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
                  <small>
                    NIT {clinic.taxId} / Staff {clinic.staffCount ?? 0}
                  </small>
                </article>
              ))
            ) : (
              <EmptyState text="No hay clinicas disponibles para este usuario." />
            )}
          </div>
        </Panel>
      )}

      <Panel eyebrow="Agenda" title="Disponibilidad y seguimiento">
        <div className="form-cluster">
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
                <option value="">Clinica</option>
                {props.clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.legalName}
                  </option>
                ))}
              </select>
            }
            submitLabel="Guardar horario"
            onSubmit={(data) => props.submitJson("/appointments/schedules", data)}
          />
        </div>

        <div className="feed-columns">
          <div className="feed-group">
            <h3>Citas activas</h3>
            {props.appointments.length ? (
              props.appointments.map((appointment) => (
                <article key={appointment.id} className="feed-card">
                  <div>
                    <strong>{appointment.type === "TELEMED" ? "Telemedicina" : "Presencial"}</strong>
                    <span>{formatDate(appointment.startTime)}</span>
                  </div>
                  <div className="feed-actions">
                    <span className={`status-pill status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                    {appointment.status === "CONFIRMED" && canCompleteAppointments(props.user) ? (
                      <button
                        type="button"
                        onClick={() => void props.submitJson(`/appointments/${appointment.id}/complete`, {})}
                      >
                        Completar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="La agenda aun no tiene citas visibles." />
            )}
          </div>

          <div className="feed-group">
            <h3>Indicadores</h3>
            {props.analytics?.global ? (
              <div className="kpi-stack">
                <article className="mini-kpi">
                  <span>Revenue</span>
                  <strong>${Math.round(props.analytics.global.revenue).toLocaleString("es-CO")}</strong>
                </article>
                <article className="mini-kpi">
                  <span>Citas</span>
                  <strong>{props.analytics.global.totalAppointments}</strong>
                </article>
                <article className="mini-kpi">
                  <span>Telemed</span>
                  <strong>{props.analytics.global.telemedCount}</strong>
                </article>
              </div>
            ) : (
              <EmptyState text="La analitica aparecera cuando existan eventos operativos." />
            )}
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Pacientes" title="Historia clinica visible">
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
                <small>{shortId(pet.id)}</small>
              </button>
            ))
          ) : (
            <EmptyState text="No hay pacientes visibles para esta sede." />
          )}
        </div>

        {selectedPet ? (
          <HistoryColumns
            records={props.records}
            vaccinations={props.vaccinations}
            prescriptions={props.prescriptions}
          />
        ) : (
          <EmptyState text="Selecciona un paciente para ver su historial." />
        )}
      </Panel>

      <div className="split-panels">
        {canWriteEhr(props.user) ? (
          <Panel eyebrow="EHR" title="Registrar atencion">
            <div className="form-cluster">
              <InlineForm
                title="Nuevo record"
                fields={[
                  { name: "reason", placeholder: "Motivo" },
                  { name: "notes", placeholder: "Notas clinicas" }
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
                submitLabel="Guardar record"
                onSubmit={(data) => props.submitJson("/ehr/records", data)}
              />

              <InlineForm
                title="Vacunacion"
                fields={[
                  { name: "vaccineCode", placeholder: "Codigo" },
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
                title="Prescripcion"
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
                submitLabel="Emitir prescripcion"
                onSubmit={(data) => props.submitJson("/ehr/prescriptions", data)}
              />
            </div>
          </Panel>
        ) : null}

        {canSendNotifications(props.user) ? (
          <Panel eyebrow="Comunicacion" title="Notificaciones">
            <InlineForm
              title="Mensaje manual"
              fields={[
                { name: "title", placeholder: "Titulo" },
                { name: "message", placeholder: "Mensaje" }
              ]}
              extraField={
                <>
                  <select name="clinicId">
                    <option value="">Clinica opcional</option>
                    {props.clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.legalName}
                      </option>
                    ))}
                  </select>
                  <input name="userId" placeholder="Usuario opcional" />
                </>
              }
              submitLabel="Enviar"
              onSubmit={(data) => props.submitJson("/notifications/send", data)}
            />

            <div className="feed-group">
              <h3>Ultimos avisos</h3>
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
                <EmptyState text="No hay avisos manuales recientes." />
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
      <Panel eyebrow="Gobierno" title="Usuarios y roles">
        <div className="panel-copy">
          <p>Los roles elevados se asignan desde este contexto para evitar exposicion publica de privilegios.</p>
        </div>
        <div className="entity-grid users-grid">
          {props.users.length ? (
            props.users.map((adminUser) => (
              <article key={adminUser.id} className="entity-card">
                <span className="entity-kicker">{adminUser.status}</span>
                <strong>{adminUser.fullName}</strong>
                <span>{adminUser.email}</span>
                <small>{shortId(adminUser.id)}</small>
                <div className="chip-row">
                  {adminUser.roles.map((role) => (
                    <span key={role} className="soft-chip">
                      {role}
                    </span>
                  ))}
                </div>
                <div className="role-actions">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => void props.updateRoles(adminUser.id, toggleRoles(adminUser.roles, role))}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <EmptyState text="No hay usuarios cargados para administracion." />
          )}
        </div>
      </Panel>

      <div className="split-panels">
        <Panel eyebrow="Sedes" title="Alta de clinicas">
          <InlineForm
            title="Nueva sede"
            fields={[
              { name: "legalName", placeholder: "Razon social" },
              { name: "taxId", placeholder: "NIT" },
              { name: "address", placeholder: "Direccion" }
            ]}
            submitLabel="Crear clinica"
            onSubmit={(data) => props.submitJson("/users/clinics", data)}
          />

          <div className="entity-grid">
            {props.clinics.length ? (
              props.clinics.map((clinic) => (
                <article key={clinic.id} className="entity-card">
                  <span className="entity-kicker">Clinica</span>
                  <strong>{clinic.legalName}</strong>
                  <span>{clinic.address}</span>
                  <small>
                    NIT {clinic.taxId} / Staff {clinic.staffCount ?? 0}
                  </small>
                </article>
              ))
            ) : (
              <EmptyState text="No hay clinicas registradas todavia." />
            )}
          </div>
        </Panel>

        <Panel eyebrow="Analitica" title="Pulso global">
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
                <span>Revenue</span>
                <strong>${Math.round(props.analytics.global.revenue).toLocaleString("es-CO")}</strong>
              </article>
            </div>
          ) : (
            <EmptyState text="La analitica global aparecera despues de procesar eventos." />
          )}

          <div className="feed-group">
            <h3>Resumen por clinica</h3>
            {props.analytics?.clinics.length ? (
              props.analytics.clinics.map((clinic) => (
                <article key={`${clinic.clinicId}-${clinic.date}`} className="feed-card">
                  <div>
                    <strong>{shortId(clinic.clinicId)}</strong>
                    <span>{clinic.appointments} citas / ocupacion {clinic.occupancy}%</span>
                  </div>
                  <small>${Math.round(clinic.revenue).toLocaleString("es-CO")}</small>
                </article>
              ))
            ) : (
              <EmptyState text="No hay KPIs por clinica disponibles." />
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
    : lowerStatus.includes("no fue") || lowerStatus.includes("no tienes") || lowerStatus.includes("falta sincronizar")
      ? "attention"
      : "online";

  return (
    <div className="rail-stack">
      <Panel eyebrow="Estado" title="Centro de control">
        <div className={`signal-banner signal-${state}`}>
          <span className="signal-chip">
            {state === "syncing" ? "Sincronizando" : state === "attention" ? "Revisar" : "En linea"}
          </span>
          <strong>{props.status}</strong>
          <p>Si un modulo no responde en despliegue, revisa la URL publica del backend y la configuracion de CORS.</p>
        </div>
      </Panel>

      <Panel eyebrow="Radar" title="Linea de actividad">
        <div className="feed-group">
          {props.notifications.length ? (
            props.notifications.slice(0, 6).map((notification) => (
              <article key={notification.id} className="timeline-card">
                <span className="timeline-dot" />
                <div className="timeline-copy">
                  <small className="timeline-tag">{notification.category}</small>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                </div>
                <small>{formatDate(notification.createdAt)}</small>
              </article>
            ))
          ) : (
            <EmptyState text="No hay actividad reciente que mostrar." />
          )}
        </div>
      </Panel>

      <Panel eyebrow="Contexto" title="Foco operativo">
        <div className="context-grid">
          <article className="context-card">
            <span>Portal actual</span>
            <strong>{props.portalTitle}</strong>
          </article>
          <article className="context-card">
            <span>Mascota o paciente</span>
            <strong>{props.selectedPetName ?? "Sin seleccion"}</strong>
          </article>
        </div>
      </Panel>
    </div>
  );
}

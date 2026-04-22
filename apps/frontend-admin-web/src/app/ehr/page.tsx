'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AdminIcon } from '../../components/admin-icons';
import { API_URL, apiFetch, downloadApiFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/presentation';

type PetItem = {
  id: string;
  name: string;
  species: string;
  breed: string;
};

type AttachmentItem = {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
};

type EhrRecord = {
  id: string;
  petId: string;
  clinicId: string;
  veterinarianId: string;
  appointmentId?: string | null;
  consultation: string;
  reasonForVisit?: string | null;
  anamnesis?: string | null;
  physicalExam?: string | null;
  diagnosis: string;
  vaccines: string;
  treatments?: string | null;
  prescriptions: string;
  labResults: string;
  imagingReports?: string | null;
  clinicalNotes: string;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentItem[];
};

type RecordFormState = {
  appointmentId: string;
  consultation: string;
  reasonForVisit: string;
  anamnesis: string;
  physicalExam: string;
  diagnosis: string;
  vaccines: string;
  treatments: string;
  prescriptions: string;
  labResults: string;
  imagingReports: string;
  clinicalNotes: string;
};

const blankForm = (): RecordFormState => ({
  appointmentId: '',
  consultation: '',
  reasonForVisit: '',
  anamnesis: '',
  physicalExam: '',
  diagnosis: '',
  vaccines: '',
  treatments: '',
  prescriptions: '',
  labResults: '',
  imagingReports: '',
  clinicalNotes: ''
});

const formSections: Array<{ key: keyof RecordFormState; label: string; required?: boolean }> = [
  { key: 'appointmentId', label: 'Id de cita' },
  { key: 'consultation', label: 'Consulta', required: true },
  { key: 'reasonForVisit', label: 'Motivo de visita' },
  { key: 'anamnesis', label: 'Anamnesis' },
  { key: 'physicalExam', label: 'Examen fisico' },
  { key: 'diagnosis', label: 'Diagnostico', required: true },
  { key: 'vaccines', label: 'Vacunas', required: true },
  { key: 'treatments', label: 'Tratamientos' },
  { key: 'prescriptions', label: 'Prescripciones', required: true },
  { key: 'labResults', label: 'Resultados de laboratorio', required: true },
  { key: 'imagingReports', label: 'Reportes de imagenes' },
  { key: 'clinicalNotes', label: 'Notas clinicas', required: true }
];

function startCase(value?: string | null) {
  if (!value) {
    return 'Sin dato';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[1.3rem] bg-paper px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-navy">{value?.trim() ? value : 'Sin dato registrado.'}</p>
    </div>
  );
}

export default function EhrPage() {
  const { session } = useAuth();
  const clinicId = session?.user.clinicIds[0];
  const canWriteRecord = ['superadmin', 'clinic_admin', 'veterinarian'].includes(session?.user.role ?? '');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState<RecordFormState>(blankForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const petsQuery = useQuery({
    queryKey: ['ehr-pets', clinicId, session?.accessToken],
    queryFn: () => apiFetch<PetItem[]>(`/pets?clinicId=${clinicId}`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken && clinicId)
  });

  useEffect(() => {
    const firstPetId = petsQuery.data?.[0]?.id;
    if (!firstPetId) {
      setSelectedPetId(null);
      return;
    }

    if (!selectedPetId || !petsQuery.data?.some((pet) => pet.id === selectedPetId)) {
      setSelectedPetId(firstPetId);
    }
  }, [petsQuery.data, selectedPetId]);

  const recordsQuery = useQuery({
    queryKey: ['ehr-records', selectedPetId, session?.accessToken],
    queryFn: () => apiFetch<EhrRecord[]>(`/ehr/records/pet/${selectedPetId}?reason=admin_review`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken && selectedPetId)
  });

  const selectedPet = petsQuery.data?.find((pet) => pet.id === selectedPetId) ?? null;

  function updateField(key: keyof RecordFormState, value: string) {
    setRecordForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setRecordForm(blankForm());
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function uploadFiles(recordId: string) {
    if (!session?.accessToken || selectedFiles.length === 0) {
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));

    const response = await fetch(`${API_URL}/ehr/records/${recordId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'No fue posible cargar los archivos clinicos.');
    }
  }

  async function handleCreateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken || !selectedPetId || !canWriteRecord) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    let createdRecordId: string | null = null;
    try {
      const created = await apiFetch<{ id: string }>(
        '/ehr/records',
        {
          method: 'POST',
          body: JSON.stringify({
            petId: selectedPetId,
            appointmentId: recordForm.appointmentId || undefined,
            consultation: recordForm.consultation,
            reasonForVisit: recordForm.reasonForVisit || undefined,
            anamnesis: recordForm.anamnesis || undefined,
            physicalExam: recordForm.physicalExam || undefined,
            diagnosis: recordForm.diagnosis,
            vaccines: recordForm.vaccines,
            treatments: recordForm.treatments || undefined,
            prescriptions: recordForm.prescriptions,
            labResults: recordForm.labResults,
            imagingReports: recordForm.imagingReports || undefined,
            clinicalNotes: recordForm.clinicalNotes
          })
        },
        session.accessToken
      );
      createdRecordId = created.id;

      let attachmentsUploaded = false;
      if (selectedFiles.length > 0) {
        await uploadFiles(created.id);
        attachmentsUploaded = true;
      }

      await recordsQuery.refetch();
      resetForm();

      setSubmitMessage(
        attachmentsUploaded
          ? 'La historia clinica fue creada con archivos adjuntos y ya quedo visible para descarga.'
          : 'La historia clinica fue creada y quedo visible para descarga.'
      );
    } catch (error) {
      if (createdRecordId) {
        await recordsQuery.refetch();
        setSubmitError(
          error instanceof Error
            ? `La historia clinica se creo, pero los archivos no se pudieron cargar: ${error.message}`
            : 'La historia clinica se creo, pero los archivos no se pudieron cargar.'
        );
      } else {
        setSubmitError(error instanceof Error ? error.message : 'No fue posible crear la historia clinica.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecordDownload(recordId: string) {
    if (!session?.accessToken) {
      return;
    }

    setDownloadError(null);
    setDownloadingKey(`record:${recordId}`);

    try {
      const result = await downloadApiFile(`/ehr/records/${recordId}/download?reason=admin_download`, session.accessToken);
      triggerBrowserDownload(result.blob, result.fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'No fue posible descargar la historia clinica.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function handleAttachmentDownload(recordId: string, attachmentId: string) {
    if (!session?.accessToken) {
      return;
    }

    const downloadKey = `attachment:${attachmentId}`;
    setDownloadError(null);
    setDownloadingKey(downloadKey);

    try {
      const result = await downloadApiFile(
        `/ehr/records/${recordId}/attachments/${attachmentId}/download?reason=admin_attachment_download`,
        session.accessToken
      );
      triggerBrowserDownload(result.blob, result.fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'No fue posible descargar el archivo clinico.');
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <AdminIcon name="ehr" className="h-4 w-4" />
          Historia clinica
        </span>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-navy">Registros por paciente</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-black/62">
              El veterinario puede crear historia clinica, adjuntar archivos y revisar el expediente completo por mascota.
            </p>
          </div>
          <span className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">
            {recordsQuery.data?.length ?? 0} registros visibles
          </span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[0.34fr,0.66fr]">
        <aside className="rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-navy">Pacientes</h2>
              <p className="mt-2 text-sm text-black/58">Selecciona una mascota para crear o revisar su historia.</p>
            </div>
            <span className="rounded-full bg-paper px-3 py-2 text-xs font-semibold text-navy">{petsQuery.data?.length ?? 0}</span>
          </div>

          <div className="mt-5 space-y-3">
            {petsQuery.data?.map((pet) => {
              const isActive = pet.id === selectedPetId;
              return (
                <button
                  key={pet.id}
                  className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                    isActive ? 'border-navy bg-navy text-white shadow-[0_16px_32px_rgba(23,63,95,0.14)]' : 'border-black/6 bg-paper text-navy'
                  }`}
                  onClick={() => {
                    setSelectedPetId(pet.id);
                    setSubmitError(null);
                    setSubmitMessage(null);
                    setDownloadError(null);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.18em] ${isActive ? 'text-white/65' : 'text-black/45'}`}>
                        {startCase(pet.species)}
                      </p>
                      <p className="mt-2 text-lg font-semibold">{pet.name}</p>
                      <p className={`mt-1 text-sm ${isActive ? 'text-white/75' : 'text-black/58'}`}>{pet.breed}</p>
                    </div>
                    <AdminIcon name="paw" className="h-5 w-5" />
                  </div>
                </button>
              );
            })}

            {!petsQuery.data?.length ? (
              <div className="rounded-[1.5rem] border border-black/6 bg-paper px-4 py-4 text-sm text-black/58">
                No hay mascotas visibles para esta sede.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-navy">
              {selectedPet ? `Nueva historia para ${selectedPet.name}` : 'Nueva historia clinica'}
            </h2>
            <p className="mt-2 text-sm text-black/58">
              {selectedPet ? `${startCase(selectedPet.species)} · ${selectedPet.breed}` : 'Selecciona un paciente para registrar la historia.'}
            </p>

            {submitError ? (
              <div className="mt-4 rounded-[1.3rem] border border-ember/20 bg-ember/8 px-4 py-3 text-sm text-ember">{submitError}</div>
            ) : null}
            {submitMessage ? (
              <div className="mt-4 rounded-[1.3rem] border border-mint/20 bg-mint/8 px-4 py-3 text-sm text-mint">{submitMessage}</div>
            ) : null}

            {canWriteRecord ? (
              <form className="mt-5 space-y-4" onSubmit={handleCreateRecord}>
                <div className="grid gap-4 md:grid-cols-2">
                  {formSections.map((section) => (
                    <label key={section.key} className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
                        {section.label}
                        {section.required ? ' *' : ''}
                      </span>
                      <textarea
                        className="min-h-[110px] w-full rounded-[1.2rem] border border-black/8 bg-paper px-4 py-3 text-sm text-navy outline-none ring-0"
                        required={section.required}
                        value={recordForm[section.key]}
                        onChange={(event) => {
                          updateField(section.key, event.target.value);
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="rounded-[1.4rem] border border-black/6 bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Adjuntos clinicos</p>
                  <input
                    ref={fileInputRef}
                    className="mt-3 block w-full text-sm text-navy"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setSelectedFiles(Array.from(event.target.files ?? []));
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file) => (
                      <span key={file.name} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-navy ring-1 ring-black/6">
                        {file.name}
                      </span>
                    ))}
                    {!selectedFiles.length ? <span className="text-sm text-black/55">Sin archivos seleccionados.</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-2xl bg-navy px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
                    disabled={!selectedPetId || isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Guardando historia...' : 'Crear historia clinica'}
                  </button>
                  <button
                    className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-navy"
                    onClick={() => {
                      resetForm();
                      setSubmitError(null);
                      setSubmitMessage(null);
                    }}
                    type="button"
                  >
                    Limpiar formulario
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-[1.3rem] border border-black/8 bg-paper px-4 py-4 text-sm text-black/58">
                Tu rol puede revisar historia clinica, pero no crear registros nuevos.
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-navy">
                  {selectedPet ? `Historia de ${selectedPet.name}` : 'Historia clinica'}
                </h2>
                <p className="mt-2 text-sm text-black/58">Cada registro muestra texto medico y archivos adjuntos descargables.</p>
              </div>
            </div>

            {downloadError ? (
              <div className="mt-4 rounded-[1.3rem] border border-ember/20 bg-ember/8 px-4 py-3 text-sm text-ember">{downloadError}</div>
            ) : null}

            <div className="mt-5 space-y-4">
              {recordsQuery.data?.map((record) => (
                <article
                  key={record.id}
                  className="rounded-[2rem] border border-black/6 bg-white p-6 shadow-[0_14px_34px_rgba(23,63,95,0.05)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-black/45">Registro clinico</p>
                      <h3 className="mt-2 text-2xl font-semibold text-navy">{record.diagnosis}</h3>
                      <p className="mt-2 text-sm text-black/58">
                        Creado {formatDateTime(record.createdAt)} · Actualizado {formatDateTime(record.updatedAt)}
                      </p>
                    </div>
                    <button
                      className="rounded-2xl bg-navy px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
                      disabled={downloadingKey === `record:${record.id}`}
                      onClick={() => {
                        void handleRecordDownload(record.id);
                      }}
                    >
                      {downloadingKey === `record:${record.id}` ? 'Descargando...' : 'Descargar historia'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <DetailBlock label="Consulta" value={record.consultation} />
                    <DetailBlock label="Motivo de visita" value={record.reasonForVisit} />
                    <DetailBlock label="Anamnesis" value={record.anamnesis} />
                    <DetailBlock label="Examen fisico" value={record.physicalExam} />
                    <DetailBlock label="Vacunas" value={record.vaccines} />
                    <DetailBlock label="Tratamientos" value={record.treatments} />
                    <DetailBlock label="Prescripciones" value={record.prescriptions} />
                    <DetailBlock label="Resultados de laboratorio" value={record.labResults} />
                    <DetailBlock label="Reportes de imagenes" value={record.imagingReports} />
                    <DetailBlock label="Notas clinicas" value={record.clinicalNotes} />
                  </div>

                  <div className="mt-5 rounded-[1.4rem] bg-paper px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-black/45">Archivos adjuntos</p>
                        <p className="mt-2 text-sm text-black/58">El usuario podra ver y descargar estos mismos archivos por mascota.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-navy ring-1 ring-black/6">
                        {record.attachments.length}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {record.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-black/6 bg-white px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-navy">{attachment.fileName}</p>
                            <p className="mt-1 text-xs text-black/55">
                              {formatFileSize(attachment.size)} · {formatDateTime(attachment.uploadedAt)}
                            </p>
                          </div>
                          <button
                            className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:bg-black/5"
                            disabled={downloadingKey === `attachment:${attachment.id}`}
                            onClick={() => {
                              void handleAttachmentDownload(record.id, attachment.id);
                            }}
                          >
                            {downloadingKey === `attachment:${attachment.id}` ? 'Descargando...' : 'Descargar archivo'}
                          </button>
                        </div>
                      ))}

                      {!record.attachments.length ? <p className="text-sm text-black/55">Sin adjuntos en este registro.</p> : null}
                    </div>
                  </div>
                </article>
              ))}

              {selectedPetId && !recordsQuery.data?.length && !recordsQuery.isLoading ? (
                <div className="rounded-[2rem] border border-black/6 bg-paper px-5 py-4 text-sm text-black/58">
                  Esta mascota todavia no tiene registros clinicos visibles para tu sede.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

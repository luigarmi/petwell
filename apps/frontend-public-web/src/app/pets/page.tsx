'use client';

import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PetSex, PetSpecies } from '@petwell/shared-types';

import { AuthNotice } from '../../components/auth-notice';
import { PublicIcon } from '../../components/public-icons';
import { apiFetch, downloadApiFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime, formatPetAge, formatSex, formatSpecies } from '../../lib/presentation';

const schema = z.object({
  name: z.string().min(2),
  species: z.nativeEnum(PetSpecies),
  breed: z.string().min(2),
  sex: z.nativeEnum(PetSex),
  weightKg: z.coerce.number().min(0.1),
  birthDate: z.string(),
  mainClinicId: z.string().optional()
});

type PetItem = {
  id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  weightKg: number;
  birthDate: string;
  allergies?: string[] | null;
};

type AttachmentItem = {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
};

type EhrRecord = {
  id: string;
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
    <div className="rounded-2xl bg-canvas px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{value?.trim() ? value : 'Sin dato registrado.'}</p>
    </div>
  );
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

export default function PetsPage() {
  const { session } = useAuth();
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      species: PetSpecies.DOG,
      sex: PetSex.FEMALE
    }
  });

  const petsQuery = useQuery({
    queryKey: ['pets', session?.accessToken],
    queryFn: () => apiFetch<PetItem[]>('/pets', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  useEffect(() => {
    const firstPetId = petsQuery.data?.[0]?.id;
    if (!firstPetId) {
      setActivePetId(null);
      return;
    }

    if (activePetId && petsQuery.data?.some((pet) => pet.id === activePetId)) {
      return;
    }

    setActivePetId(firstPetId);
  }, [activePetId, petsQuery.data]);

  const recordsQuery = useQuery({
    queryKey: ['pet-ehr-records', activePetId, session?.accessToken],
    queryFn: () => apiFetch<EhrRecord[]>(`/ehr/records/pet/${activePetId}?reason=owner_portal`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken && activePetId)
  });

  if (!session) {
    return (
      <AuthNotice
        title="Tus mascotas solo se muestran con sesion"
        description="Ingresa para registrar mascotas, revisar sus datos clave y mantener separado el historial de cada una."
      />
    );
  }

  async function handleDownload(recordId: string) {
    if (!session) {
      return;
    }

    setDownloadError(null);
    setDownloadingRecordId(`record:${recordId}`);

    try {
      const result = await downloadApiFile(`/ehr/records/${recordId}/download?reason=owner_download`, session.accessToken);
      triggerBrowserDownload(result.blob, result.fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'No fue posible descargar la historia clinica.');
    } finally {
      setDownloadingRecordId(null);
    }
  }

  async function handleAttachmentDownload(recordId: string, attachmentId: string) {
    if (!session) {
      return;
    }

    const downloadKey = `attachment:${attachmentId}`;
    setDownloadError(null);
    setDownloadingRecordId(downloadKey);

    try {
      const result = await downloadApiFile(
        `/ehr/records/${recordId}/attachments/${attachmentId}/download?reason=owner_attachment_download`,
        session.accessToken
      );
      triggerBrowserDownload(result.blob, result.fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'No fue posible descargar el archivo clinico.');
    } finally {
      setDownloadingRecordId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr,1.08fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
          <PublicIcon name="paw" className="h-4 w-4" />
          Registro claro
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-3xl font-bold text-leaf">Registrar mascota</h1>
        <p className="mt-3 text-sm leading-6 text-black/62">Registra los datos principales de tu mascota.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await apiFetch(
              '/pets',
              {
                method: 'POST',
                body: JSON.stringify(values)
              },
              session.accessToken
            );
            await petsQuery.refetch();
            form.reset({
              species: PetSpecies.DOG,
              sex: PetSex.FEMALE
            });
          })}
        >
          <input placeholder="Nombre" {...form.register('name')} />
          <div className="grid gap-4 md:grid-cols-2">
            <select {...form.register('species')}>
              {Object.values(PetSpecies).map((value) => (
                <option key={value} value={value}>
                  {formatSpecies(value)}
                </option>
              ))}
            </select>
            <input placeholder="Raza" {...form.register('breed')} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select {...form.register('sex')}>
              {Object.values(PetSex).map((value) => (
                <option key={value} value={value}>
                  {formatSex(value)}
                </option>
              ))}
            </select>
            <input type="number" step="0.1" placeholder="Peso en kg" {...form.register('weightKg')} />
          </div>
          <input type="date" {...form.register('birthDate')} />
          <button className="w-full bg-clay text-white shadow-[0_16px_32px_rgba(217,135,82,0.18)]">Guardar mascota</button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/78 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-heading)] text-3xl font-bold text-leaf">Mis mascotas</h2>
            <p className="mt-2 text-sm text-black/58">Consulta los datos registrados y el historial clínico descargable de cada mascota.</p>
          </div>
          <span className="rounded-full bg-leaf/10 px-4 py-2 text-sm font-semibold text-leaf">{petsQuery.data?.length ?? 0} registradas</span>
        </div>

        {downloadError ? (
          <div className="mt-5 rounded-[1.3rem] border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">{downloadError}</div>
        ) : null}

        <div className="mt-6 space-y-4">
          {petsQuery.data?.map((pet) => {
            const isActive = pet.id === activePetId;
            return (
              <article
                key={pet.id}
                className="rounded-[1.7rem] border border-black/5 bg-white/90 p-5 shadow-[0_16px_38px_rgba(31,42,32,0.05)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">{formatSpecies(pet.species)}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-leaf">{pet.name}</h3>
                    <p className="mt-1 text-sm text-black/60">{pet.breed}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-leaf">
                    <PublicIcon name="paw" className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-canvas px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Sexo</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatSex(pet.sex)}</p>
                  </div>
                  <div className="rounded-2xl bg-canvas px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Edad</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatPetAge(pet.birthDate)}</p>
                  </div>
                  <div className="rounded-2xl bg-canvas px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Peso</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{pet.weightKg} kg</p>
                  </div>
                </div>

                {pet.allergies?.length ? (
                  <p className="mt-4 text-sm text-black/62">Alergias registradas: {pet.allergies.join(', ')}.</p>
                ) : (
                  <p className="mt-4 text-sm text-black/45">Sin alergias registradas.</p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      isActive ? 'bg-leaf text-white' : 'border border-black/10 text-ink'
                    }`}
                    onClick={() => {
                      setDownloadError(null);
                      setActivePetId(isActive ? null : pet.id);
                    }}
                  >
                    <PublicIcon name="book" className="h-4 w-4" />
                    {isActive ? 'Ocultar historial' : 'Ver historial'}
                  </button>
                </div>

                {isActive ? (
                  <div className="mt-5 space-y-4 rounded-[1.5rem] border border-leaf/12 bg-canvas/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Historia clinica</p>
                        <p className="mt-2 text-sm text-black/58">Puedes abrir cada registro y descargarlo.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-leaf">
                        {recordsQuery.data?.length ?? 0} registros
                      </span>
                    </div>

                    {recordsQuery.data?.map((record) => (
                      <article key={record.id} className="rounded-[1.4rem] border border-white/80 bg-white p-4 shadow-[0_12px_28px_rgba(31,42,32,0.04)]">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h4 className="text-lg font-semibold text-leaf">{record.diagnosis}</h4>
                            <p className="mt-2 text-sm text-black/55">
                              Creado {formatDateTime(record.createdAt)} · Actualizado {formatDateTime(record.updatedAt)}
                            </p>
                          </div>
                          <button
                            className="rounded-2xl bg-leaf px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
                            disabled={downloadingRecordId === `record:${record.id}`}
                            onClick={() => {
                              void handleDownload(record.id);
                            }}
                          >
                            {downloadingRecordId === `record:${record.id}` ? 'Descargando...' : 'Descargar historia'}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
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

                        <div className="mt-4 rounded-[1.3rem] border border-black/6 bg-canvas px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Archivos adjuntos</p>
                              <p className="mt-2 text-sm text-black/58">Documentos e imagenes asociados a este registro.</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-leaf ring-1 ring-black/6">
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
                                  <p className="text-sm font-semibold text-ink">{attachment.fileName}</p>
                                  <p className="mt-1 text-xs text-black/55">
                                    {formatFileSize(attachment.size)} · {formatDateTime(attachment.uploadedAt)}
                                  </p>
                                </div>
                                <button
                                  className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-black/5"
                                  disabled={downloadingRecordId === `attachment:${attachment.id}`}
                                  onClick={() => {
                                    void handleAttachmentDownload(record.id, attachment.id);
                                  }}
                                >
                                  {downloadingRecordId === `attachment:${attachment.id}` ? 'Descargando...' : 'Descargar archivo'}
                                </button>
                              </div>
                            ))}

                            {!record.attachments.length ? <p className="text-sm text-black/55">Sin adjuntos en este registro.</p> : null}
                          </div>
                        </div>
                      </article>
                    ))}

                    {!recordsQuery.data?.length && !recordsQuery.isLoading ? (
                      <div className="rounded-[1.4rem] border border-black/6 bg-white px-4 py-4 text-sm text-black/58">
                        Esta mascota todavia no tiene historia clinica registrada.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

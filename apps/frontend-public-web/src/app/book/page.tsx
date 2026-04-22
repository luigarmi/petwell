'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AppointmentType } from '@petwell/shared-types';

import { AuthNotice } from '../../components/auth-notice';
import { PublicIcon } from '../../components/public-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatAppointmentType, formatCurrency, formatDateTime } from '../../lib/presentation';

type ClinicItem = {
  id: string;
  name: string;
  services: Array<{ appointmentType: AppointmentType; name: string; priceCop: number }>;
  veterinarians: Array<{ id: string; firstName: string; lastName: string }>;
};

type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  available: boolean;
};

export default function BookPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [clinicId, setClinicId] = useState('');
  const [veterinarianId, setVeterinarianId] = useState('');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(AppointmentType.IN_PERSON);
  const [date, setDate] = useState('');
  const [petId, setPetId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clinicsQuery = useQuery({
    queryKey: ['book-clinics'],
    queryFn: () => apiFetch<ClinicItem[]>('/clinics/public/search')
  });

  const petsQuery = useQuery({
    queryKey: ['book-pets', session?.accessToken],
    queryFn: () => apiFetch<Array<{ id: string; name: string }>>('/pets', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  const selectedClinic = useMemo(
    () => clinicsQuery.data?.find((clinic) => clinic.id === clinicId),
    [clinicId, clinicsQuery.data]
  );

  const selectedService = selectedClinic?.services.find((service) => service.appointmentType === appointmentType);

  const availabilityQuery = useQuery({
    queryKey: ['availability', clinicId, veterinarianId, date],
    queryFn: () =>
      apiFetch<AvailabilitySlot[]>(
        `/availability?clinicId=${clinicId}&veterinarianId=${veterinarianId}&date=${date}`
      ),
    enabled: Boolean(clinicId && veterinarianId && date)
  });

  const availableSlots = availabilityQuery.data?.filter((slot) => slot.available) ?? [];

  function resetBookingState() {
    setSelectedSlot(null);
    setBookingError(null);
    setBookingMessage(null);
  }

  async function handleReserve() {
    if (!selectedSlot || !session?.accessToken) {
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);
    setBookingMessage(null);

    try {
      const appointment = await apiFetch<{ id: string }>(
        '/appointments',
        {
          method: 'POST',
          body: JSON.stringify({
            clinicId,
            veterinarianId,
            appointmentType,
            petId,
            startsAt: selectedSlot.startsAt
          })
        },
        session.accessToken
      );

      let payment: { id: string } | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          payment = await apiFetch<{ id: string }>(
            `/billing/payments/appointment/${appointment.id}/latest`,
            {},
            session.accessToken
          );
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (payment) {
        router.push(`/payments/${payment.id}`);
        return;
      }

      setBookingMessage('La cita fue creada. El pago todavia se esta preparando; puedes verla en tu historial.');
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'No fue posible crear la cita.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session) {
    return (
      <AuthNotice
        title="Debes iniciar sesion para reservar"
        description="Reserva con tu cuenta para vincular la cita a una mascota, generar el pago y habilitar el historial de seguimiento."
      />
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
          <PublicIcon name="book" className="h-4 w-4" />
          Reserva guiada
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Reservar cita</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
          Primero eliges sede, servicio, profesional y mascota. Despues seleccionas una franja y confirmas la reserva con el boton.
        </p>
      </header>

      <div className="grid gap-6 rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur lg:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-4">
          <select
            value={clinicId}
            onChange={(event) => {
              setClinicId(event.target.value);
              resetBookingState();
            }}
          >
            <option value="">Selecciona una clinica</option>
            {clinicsQuery.data?.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>

          <select
            value={appointmentType}
            onChange={(event) => {
              setAppointmentType(event.target.value as AppointmentType);
              resetBookingState();
            }}
          >
            {selectedClinic?.services.map((service) => (
              <option key={service.appointmentType} value={service.appointmentType}>
                {service.name}
              </option>
            ))}
          </select>

          <select
            value={veterinarianId}
            onChange={(event) => {
              setVeterinarianId(event.target.value);
              resetBookingState();
            }}
          >
            <option value="">Selecciona un veterinario</option>
            {selectedClinic?.veterinarians.map((vet) => (
              <option key={vet.id} value={vet.id}>
                {vet.firstName} {vet.lastName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              resetBookingState();
            }}
          />

          <select
            value={petId}
            onChange={(event) => {
              setPetId(event.target.value);
              setBookingError(null);
              setBookingMessage(null);
            }}
          >
            <option value="">Selecciona una mascota</option>
            {petsQuery.data?.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>

          {selectedService ? (
            <div className="rounded-[1.5rem] bg-canvas px-4 py-4 text-sm text-black/62">
              <p className="font-semibold text-leaf">{selectedService.name}</p>
              <p className="mt-2">Valor estimado: {formatCurrency(selectedService.priceCop)}</p>
              <p className="mt-1">Modalidad: {formatAppointmentType(selectedService.appointmentType)}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-leaf">Disponibilidad</h2>
            <span className="rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
              {availableSlots.length} franjas
            </span>
          </div>

          <div className="grid gap-3">
            {availabilityQuery.data?.map((slot) => (
              <button
                key={slot.startsAt}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                  !slot.available
                    ? 'border-black/5 bg-black/5 text-black/40'
                    : selectedSlot?.startsAt === slot.startsAt
                      ? 'border-leaf bg-leaf/10 text-ink ring-2 ring-leaf/20'
                      : 'border-leaf/15 bg-white text-ink'
                }`}
                disabled={!slot.available}
                onClick={() => {
                  setSelectedSlot(slot);
                  setBookingError(null);
                  setBookingMessage(null);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-leaf">{formatDateTime(slot.startsAt)}</p>
                    <p className="mt-1 text-sm text-black/55">
                      {slot.available ? 'Disponible para reservar' : 'No disponible en este momento'}
                    </p>
                  </div>
                  <PublicIcon name="arrow-right" className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>

          {!availabilityQuery.data?.length && clinicId && veterinarianId && date ? (
            <div className="rounded-[1.5rem] border border-black/8 bg-white/82 px-5 py-4 text-sm text-black/62">
              No hay franjas disponibles para esa combinacion. Cambia la fecha o el veterinario.
            </div>
          ) : null}

          <div className="rounded-[1.6rem] border border-white/70 bg-white/84 p-5 shadow-[0_18px_46px_rgba(31,42,32,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Confirmacion</p>
            <div className="mt-3 space-y-2 text-sm text-black/65">
              <p>{selectedSlot ? `Franja elegida: ${formatDateTime(selectedSlot.startsAt)}` : 'Selecciona una franja disponible.'}</p>
              {selectedService ? <p>Servicio: {selectedService.name}</p> : null}
            </div>

            {bookingError ? (
              <div className="mt-4 rounded-[1.2rem] border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
                {bookingError}
              </div>
            ) : null}

            {bookingMessage ? (
              <div className="mt-4 rounded-[1.2rem] border border-leaf/15 bg-leaf/8 px-4 py-3 text-sm text-leaf">
                {bookingMessage}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-leaf px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
                disabled={!selectedSlot || !petId || isSubmitting}
                onClick={() => {
                  void handleReserve();
                }}
              >
                <PublicIcon name="book" className="h-4 w-4" />
                {isSubmitting ? 'Creando cita...' : 'Reservar cita'}
              </button>

              <Link href="/appointments" className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-ink">
                Ver mis citas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

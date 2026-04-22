'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../lib/api';

type ClinicItem = {
  id: string;
  name: string;
  city: string;
  specialties: string[];
  services: Array<{ id: string; name: string; appointmentType: string; priceCop: number }>;
  veterinarians: Array<{ id: string; firstName: string; lastName: string }>;
};

export default function ClinicsPage() {
  const clinicsQuery = useQuery({
    queryKey: ['public-clinics'],
    queryFn: () => apiFetch<ClinicItem[]>('/clinics/public/search')
  });

  return (
    <section className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-4xl font-bold text-leaf">Clínicas disponibles</h1>
      <div className="grid gap-5">
        {clinicsQuery.data?.map((clinic) => (
          <article key={clinic.id} className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-leaf">{clinic.name}</h2>
                <p className="text-black/60">{clinic.city}</p>
                <p className="mt-2 text-sm text-black/70">{clinic.specialties.join(', ')}</p>
              </div>
              <div className="rounded-2xl bg-sand px-4 py-2 text-sm font-medium text-leaf">
                {clinic.veterinarians.length} veterinarios
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {clinic.services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-black/5 p-4">
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-black/60">{service.appointmentType}</p>
                  <p className="mt-2 text-leaf">{service.priceCop.toLocaleString('es-CO')} COP</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

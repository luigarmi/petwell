'use client';

import { useQuery } from '@tanstack/react-query';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type PetItem = {
  id: string;
  name: string;
  species: string;
  breed: string;
  weightKg?: number | null;
  sex?: string | null;
  allergies?: string[] | null;
};

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

export default function PetsPage() {
  const { session } = useAuth();
  const clinicId = session?.user.clinicIds[0];
  const petsQuery = useQuery({
    queryKey: ['admin-pets', clinicId, session?.accessToken],
    queryFn: () => apiFetch<PetItem[]>(`/pets?clinicId=${clinicId}`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken && clinicId)
  });

  const pets = petsQuery.data ?? [];

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <AdminIcon name="paw" className="h-4 w-4" />
          Pacientes de la sede
        </span>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-navy">Mascotas</h1>
            <p className="mt-3 text-sm leading-6 text-black/62">
              Vista resumida para identificar rapido al paciente, su raza, su peso y alertas basicas de cuidado.
            </p>
          </div>
          <span className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">{pets.length} pacientes visibles</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pets.map((pet) => (
          <article key={pet.id} className="rounded-[1.7rem] border border-white/70 bg-white/84 p-5 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">{startCase(pet.species)}</p>
                <h2 className="mt-2 text-2xl font-semibold text-navy">{pet.name}</h2>
                <p className="mt-1 text-sm text-black/58">{pet.breed}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist text-navy">
                <AdminIcon name="paw" className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] bg-paper px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Peso</p>
                <p className="mt-1 text-sm font-semibold text-navy">{pet.weightKg ? `${pet.weightKg} kg` : 'Sin dato'}</p>
              </div>
              <div className="rounded-[1.3rem] bg-paper px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Sexo</p>
                <p className="mt-1 text-sm font-semibold text-navy">{startCase(pet.sex)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-black/62">
              {pet.allergies?.length ? `Alergias reportadas: ${pet.allergies.join(', ')}.` : 'Sin alergias reportadas.'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

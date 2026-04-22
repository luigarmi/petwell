'use client';

import { useQuery } from '@tanstack/react-query';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatRole, roleBadgeClassName } from '../../lib/presentation';

type UserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
};

export default function UsersPage() {
  const { session } = useAuth();
  const clinicId = session?.user.clinicIds[0];
  const queryPath = clinicId && session?.user.role !== 'superadmin' ? `/users?clinicId=${clinicId}` : '/users';

  const usersQuery = useQuery({
    queryKey: ['admin-users', queryPath, session?.accessToken],
    queryFn: () => apiFetch<UserItem[]>(queryPath, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  const users = usersQuery.data ?? [];
  const staffCount = users.filter((user) => user.role !== 'pet_owner').length;
  const vetCount = users.filter((user) => user.role === 'veterinarian').length;

  return (
    <section className="space-y-6">
      <header className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur md:grid-cols-[1.15fr,0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            <AdminIcon name="users" className="h-4 w-4" />
            Equipo visible
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">Usuarios</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
            Esta vista ya no muestra identificadores crudos y, para administracion de sede, se limita al equipo que corresponde.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-[1.5rem] bg-navy p-5 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/58">Total visible</p>
            <p className="mt-3 text-3xl font-semibold">{users.length}</p>
          </article>
          <article className="rounded-[1.5rem] bg-white p-5 shadow-[0_16px_38px_rgba(23,63,95,0.06)]">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Veterinarios</p>
            <p className="mt-3 text-3xl font-semibold text-navy">{vetCount}</p>
            <p className="mt-2 text-sm text-black/58">{staffCount} perfiles de equipo</p>
          </article>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => (
          <article key={user.id} className="rounded-[1.7rem] border border-white/70 bg-white/84 p-5 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-navy">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="mt-1 text-sm text-black/58">{user.email}</p>
              </div>
              <span className={roleBadgeClassName(user.role)}>{formatRole(user.role)}</span>
            </div>
            <div className="mt-5 rounded-[1.4rem] bg-paper px-4 py-4 text-sm text-black/62">
              <p className="font-semibold text-navy">Contacto</p>
              <p className="mt-2">{user.phone}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

import './globals.css';

import { AdminShell } from '../components/admin-shell';
import { Providers } from '../lib/providers';

export const metadata = {
  title: 'PetWell Admin',
  description: 'Panel administrativo de PetWell'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-[var(--font-body)]">
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}

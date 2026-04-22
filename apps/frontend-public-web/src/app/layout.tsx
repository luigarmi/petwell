import './globals.css';

import { PublicNav } from '../components/public-nav';
import { Providers } from '../lib/providers';

export const metadata = {
  title: 'PetWell',
  description: 'Plataforma integral de salud y bienestar animal'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-[var(--font-body)]">
        <Providers>
          <PublicNav />
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

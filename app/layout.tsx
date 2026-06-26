import type { Metadata } from 'next';
import '@/styles/globals.css';

// Layout raiz minimo: apenas <html>/<body> + design system global.
// O chrome do portal (Sidebar + Topbar) vive em app/(portal)/layout.tsx,
// para que /login fique fora dele. Story 5.2.
export const metadata: Metadata = {
  title: 'CRM — Cranium Digital',
  description: 'Plataforma de atendimento via WhatsApp com IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

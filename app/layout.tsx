import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

// Layout raiz minimo: apenas <html>/<body> + design system global.
// O chrome do portal (Sidebar + Topbar) vive em app/(portal)/layout.tsx,
// para que /login fique fora dele. Story 5.2.
export const metadata: Metadata = {
  title: 'CRM — Cranium Digital',
  description: 'Plataforma de atendimento via WhatsApp com IA',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Cranium' },
};

// PWA / mobile: cor do tema (barra do navegador/app) + viewport responsivo.
export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
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

import type { MetadataRoute } from 'next';

// Manifesto PWA — deixa o portal instalável no celular (ícone na tela inicial,
// abre em tela cheia com cara de app). Identidade Cranium.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRM Cranium Digital',
    short_name: 'Cranium',
    description: 'Portal de atendimento via WhatsApp com IA da Cranium Digital',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1A0A2E',
    theme_color: '#7C3AED',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

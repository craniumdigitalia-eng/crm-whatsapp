import type { Metadata } from 'next';
import GruposInbox from '@/components/GruposInbox';

export const metadata: Metadata = {
  title: 'Grupos — Cranium Digital',
};

// Aba Grupos: inbox estilo WhatsApp, só de grupos (lista + conversa + responder).
export default function GruposPage() {
  return <GruposInbox />;
}

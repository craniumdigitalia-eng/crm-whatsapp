import type { Metadata } from 'next';
import ConversasInbox from '@/components/ConversasInbox';

export const metadata: Metadata = {
  title: 'Conversas — Cranium Digital',
};

// Story 5.15 — Inbox estilo WhatsApp Web (tema escuro Cranium).
// Reaproveita as APIs de leads (lista, detalhe, reply, takeover/release, status).
export default function ConversasPage() {
  return <ConversasInbox />;
}

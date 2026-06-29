import type { Metadata } from 'next';
import AgendaModule from '@/components/AgendaModule';

export const metadata: Metadata = {
  title: 'Agenda — Cranium Digital',
};

// Story 5.7 — módulo de agendamento (Google Calendar)
export default function AgendaPage() {
  return <AgendaModule />;
}

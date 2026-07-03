import type { Metadata } from 'next';
import DemandasBoard from '@/components/DemandasBoard';

export const metadata: Metadata = {
  title: 'Demandas — Cranium Digital',
};

// Aba Demandas: quadro kanban das demandas postadas nos grupos de WhatsApp.
export default function DemandasPage() {
  return <DemandasBoard />;
}

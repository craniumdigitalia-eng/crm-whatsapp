import type { Metadata } from 'next';
import BiDashboard from '@/components/BiDashboard';

export const metadata: Metadata = {
  title: 'Métricas & BI — Cranium Digital',
};

// Story 5.6 — módulo de Métricas & BI.
// Dashboard de indicadores do funil de leads via WhatsApp + IA.
export default function BiPage() {
  return <BiDashboard />;
}

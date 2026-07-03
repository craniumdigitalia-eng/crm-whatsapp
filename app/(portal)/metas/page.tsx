import type { Metadata } from 'next';
import MetasDashboard from '@/components/MetasDashboard';

export const metadata: Metadata = {
  title: 'Metas — Cranium Digital',
};

// Aba Metas: projeção de crescimento da carteira e do MRR.
export default function MetasPage() {
  return <MetasDashboard />;
}

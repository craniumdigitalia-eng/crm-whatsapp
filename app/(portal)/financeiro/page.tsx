import type { Metadata } from 'next';
import FinanceDashboard from '@/components/FinanceDashboard';

export const metadata: Metadata = {
  title: 'Financeiro — Cranium Digital',
};

// Módulo Financeiro: fluxo de caixa, MRR, churn e DRE da Cranium.
export default function FinanceiroPage() {
  return <FinanceDashboard />;
}

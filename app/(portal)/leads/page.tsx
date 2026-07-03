import { redirect } from 'next/navigation';

// A aba Leads foi consolidada dentro do BI (métricas em cima, tabela de leads
// embaixo). Mantemos a rota como redirect para não quebrar links/bookmarks antigos.
export default function LeadsPage() {
  redirect('/bi');
}

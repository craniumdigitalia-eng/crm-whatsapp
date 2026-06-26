import { redirect } from 'next/navigation';

// Raiz do portal redireciona para o módulo CRM (kanban).
export default function RootPage() {
  redirect('/crm');
}

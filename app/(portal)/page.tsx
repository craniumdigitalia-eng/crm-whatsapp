import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardHome from '@/components/DashboardHome';

export const metadata: Metadata = {
  title: 'Dashboard — Cranium Digital',
};

// Home do portal: visão-resumo do funil (reusa /api/bi/metrics) + atalhos.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = (profile?.nome ?? user.email ?? '').split(' ')[0] || 'equipe';

  return <DashboardHome firstName={firstName} />;
}

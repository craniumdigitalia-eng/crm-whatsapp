import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import EmailModule from '@/components/EmailModule';

export const metadata: Metadata = {
  title: 'Email Marketing — Cranium Digital',
};

// Aba "Email Marketing" (migration 007). O envio e a config do provedor exigem
// admin (gateado também no servidor); aqui só decidimos o que mostrar/habilitar.
export default async function EmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
  }

  return <EmailModule isAdmin={isAdmin} />;
}

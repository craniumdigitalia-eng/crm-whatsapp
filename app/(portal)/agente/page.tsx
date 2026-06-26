import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AgentConfigModule from '@/components/AgentConfigModule';

export const metadata: Metadata = {
  title: 'Agente IA — Cranium Digital',
};

// Aba "Agente IA": personaliza COMO a IA atende no WhatsApp (persona, tom,
// abordagem, qualificacao, escalonamento, guardrails). Salvar exige admin
// (gateado tambem no servidor); aqui so decidimos o que habilitar.
export default async function AgentePage() {
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

  return <AgentConfigModule isAdmin={isAdmin} />;
}

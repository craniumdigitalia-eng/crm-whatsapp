import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ConfigModule from '@/components/ConfigModule';

export const metadata: Metadata = {
  title: 'Configurações — Cranium Digital',
};

// Tela de Configurações do perfil (Story 5.2): foto, nome e senha.
// Server component: lê o perfil do usuário logado e injeta no módulo client.
export default async function ConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, nome, role, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <ConfigModule
      initialProfile={{
        id: user.id,
        email: profile?.email ?? user.email ?? '',
        nome: profile?.nome ?? '',
        role: (profile?.role as 'admin' | 'atendente') ?? 'atendente',
        avatarUrl: profile?.avatar_url ?? null,
      }}
    />
  );
}

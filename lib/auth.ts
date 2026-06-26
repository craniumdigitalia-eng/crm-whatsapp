import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Gate de autenticacao para os Route Handlers em app/api/** (Story 5.2).
// Uso no inicio de cada handler:
//   const auth = await requireUser();
//   if (auth instanceof NextResponse) return auth;  // 401 JSON
//   // ...segue com auth.user
//
// NAO aplicar em /api/leadgen (protegido por assinatura HMAC do Meta) nem nos
// Vercel Functions da raiz api/* (webhook/cron/health — endpoints de maquina).
export async function requireUser(): Promise<{ user: User } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  }
  return { user };
}

// Gate de AUTORIZACAO (RBAC) — exige usuario autenticado E com role 'admin'.
// Uso identico ao requireUser:
//   const auth = await requireAdmin();
//   if (auth instanceof NextResponse) return auth;  // 401 (sem sessao) ou 403 (nao-admin)
//
// O papel e lido da tabela `profiles` (RLS deixa o usuario ler o proprio registro),
// NUNCA de user_metadata (que e editavel pelo usuario). A coluna `role` so pode ser
// alterada pela service_role — garantido pelo trigger da migration 006.
//
// Aplicar apenas em endpoints que GRAVAM credenciais/segredos sensiveis
// (ex.: integracoes Meta/Google). Os endpoints de CRM (leads/tags/checklist) usam
// requireUser — qualquer membro autenticado da equipe opera o funil.
export async function requireAdmin(): Promise<{ user: User } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'requer admin' }, { status: 403 });
  }
  return { user };
}

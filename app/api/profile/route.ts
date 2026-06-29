import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// /api/profile — perfil do PRÓPRIO usuário logado (tela /config, Story 5.2).
// Gate requireUser: qualquer membro autenticado edita o próprio perfil.
// A escrita roda via anon key + sessão, respeitando a RLS de `profiles`
// (policy profiles_self_update: só a própria linha). O `role` NÃO é editável
// aqui — além de não ser enviado, o trigger da migration 006 bloqueia a troca.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROFILE_COLS = 'id, email, nome, role, avatar_url';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', auth.user.id)
    .maybeSingle();

  if (error) {
    console.error('[api/profile] GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: { nome?: unknown; avatar_url?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch: { nome?: string; avatar_url?: string | null } = {};

  if (body.nome !== undefined) {
    if (typeof body.nome !== 'string') {
      return NextResponse.json({ error: 'nome inválido' }, { status: 400 });
    }
    const nome = body.nome.trim();
    if (nome.length < 1 || nome.length > 80) {
      return NextResponse.json(
        { error: 'O nome deve ter entre 1 e 80 caracteres.' },
        { status: 400 },
      );
    }
    patch.nome = nome;
  }

  if (body.avatar_url !== undefined) {
    if (body.avatar_url !== null && typeof body.avatar_url !== 'string') {
      return NextResponse.json({ error: 'avatar_url inválido' }, { status: 400 });
    }
    patch.avatar_url = body.avatar_url;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.user.id)
    .select(PROFILE_COLS)
    .maybeSingle();

  if (error) {
    console.error('[api/profile] PATCH:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

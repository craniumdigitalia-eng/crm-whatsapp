import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { refreshGroupsCache } from '@/src/crm/groupchat';

// POST /api/groups/refresh — atualiza o cache de grupos buscando na Evolution
// (operação LENTA, ~25s). Acionada pelo botão "Atualizar" na aba Grupos.
export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const count = await refreshGroupsCache();
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    console.error('[api/groups/refresh] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

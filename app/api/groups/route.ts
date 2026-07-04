import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDemandCountsByGroup } from '@/src/crm/demands';
import { getLastMessageByGroup, getCachedGroups, refreshGroupsCache } from '@/src/crm/groupchat';

// GET /api/groups — lista os grupos (do CACHE, rápido) com a última mensagem e a
// contagem de demandas. O fetch na Evolution é lento (25s+), então só roda para
// popular o cache quando ele está vazio; a atualização normal é via /api/groups/refresh.
export const maxDuration = 60;

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    let cached = await getCachedGroups();
    if (cached.length === 0) {
      // Primeira vez / cache vazio: popula (pode demorar por causa da Evolution).
      await refreshGroupsCache().catch(() => {});
      cached = await getCachedGroups();
    }
    const [counts, lastByGroup] = await Promise.all([getDemandCountsByGroup(), getLastMessageByGroup()]);
    const merged = cached.map((g) => {
      const last = lastByGroup[g.jid];
      return {
        ...g,
        demandsOpen: counts[g.jid]?.aberta ?? 0,
        demandsTotal: counts[g.jid]?.total ?? 0,
        lastBody: last?.body ?? null,
        lastAt: last?.at ?? null,
        lastDirection: last?.direction ?? null,
      };
    });
    merged.sort((a, b) => {
      if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
      if (a.lastAt) return -1;
      if (b.lastAt) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return NextResponse.json({ groups: merged, total: merged.length });
  } catch (e) {
    console.error('[api/groups] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

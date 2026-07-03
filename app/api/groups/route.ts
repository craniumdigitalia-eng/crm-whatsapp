import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fetchAllGroups } from '@/src/whatsapp/evolution';
import { getDemandCountsByGroup } from '@/src/crm/demands';
import { getLastMessageByGroup } from '@/src/crm/groupchat';

// GET /api/groups — lista os grupos do WhatsApp (Evolution) com a última mensagem
// (para o inbox) e a contagem de demandas de cada um. Ordena por atividade recente.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const [groups, counts, lastByGroup] = await Promise.all([
      fetchAllGroups(),
      getDemandCountsByGroup(),
      getLastMessageByGroup(),
    ]);
    const merged = groups.map((g) => {
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
    // Grupos com mensagem recente primeiro; depois por nome.
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

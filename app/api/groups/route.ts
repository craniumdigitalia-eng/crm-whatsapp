import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fetchAllGroups } from '@/src/whatsapp/evolution';
import { getDemandCountsByGroup } from '@/src/crm/demands';

// GET /api/groups — lista todos os grupos do WhatsApp (Evolution) com a
// contagem de demandas (abertas/total) de cada um.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const [groups, counts] = await Promise.all([fetchAllGroups(), getDemandCountsByGroup()]);
    const merged = groups
      .map((g) => ({
        ...g,
        demandsOpen: counts[g.jid]?.aberta ?? 0,
        demandsTotal: counts[g.jid]?.total ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return NextResponse.json({ groups: merged, total: merged.length });
  } catch (e) {
    console.error('[api/groups] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

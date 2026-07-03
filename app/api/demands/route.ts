import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listDemands, DEMAND_CATEGORIES } from '@/src/crm/demands';

// GET /api/demands — lista as demandas do quadro + as categorias.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const demands = await listDemands();
    return NextResponse.json({ demands, categories: DEMAND_CATEGORIES });
  } catch (e) {
    console.error('[api/demands] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

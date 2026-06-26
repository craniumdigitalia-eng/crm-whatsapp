import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { computeMetrics, parsePeriod } from '@/src/crm/metrics';

// GET /api/bi/metrics?period=7d|30d|90d|all — agrega os indicadores do funil
// (Story 5.6). Gate requireUser: qualquer membro autenticado vê as métricas.
// As agregações rodam server-side com a service_role (src/crm/metrics.ts);
// retornamos apenas números/séries — nenhum dado sensível de lead individual.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const period = parsePeriod(new URL(req.url).searchParams.get('period'));
    const metrics = await computeMetrics(period);
    return NextResponse.json(metrics, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[api/bi/metrics] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

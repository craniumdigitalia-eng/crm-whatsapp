import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getFinanceSummary, type Period } from '@/src/crm/finance';

const VALID: Period[] = ['mes', 'trimestre', 'semestre', 'ano'];

// GET /api/finance/summary?period=mes|trimestre|semestre|ano
// KPIs (MRR, ativos, inadimplência, churn) + DRE do período.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const url = new URL(req.url);
    const p = (url.searchParams.get('period') ?? 'mes') as Period;
    const period: Period = VALID.includes(p) ? p : 'mes';
    const summary = await getFinanceSummary(period);
    return NextResponse.json(summary);
  } catch (e) {
    console.error('[api/finance/summary] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getGoals, setGoals, type FinanceGoals } from '@/src/crm/finance';

// GET /api/finance/goals — lê as metas de crescimento.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const goals = await getGoals();
    return NextResponse.json({ goals });
  } catch (e) {
    console.error('[api/finance/goals] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// PUT /api/finance/goals — salva as metas.
// Body: { newPerMonth, churnPerMonth, newTicket, targetMonth }
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<FinanceGoals>;
    const goals: FinanceGoals = {
      newPerMonth: Math.max(0, Number(body.newPerMonth ?? 0)),
      churnPerMonth: Math.max(0, Number(body.churnPerMonth ?? 0)),
      newTicket: Math.max(0, Number(body.newTicket ?? 0)),
      targetMonth: typeof body.targetMonth === 'string' ? body.targetMonth : '2026-12',
    };
    await setGoals(goals);
    return NextResponse.json({ goals });
  } catch (e) {
    console.error('[api/finance/goals] PUT:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

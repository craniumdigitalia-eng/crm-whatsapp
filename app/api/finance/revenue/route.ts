import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listRevenue, createRevenue } from '@/src/crm/finance';

// GET /api/finance/revenue — lista as receitas avulsas.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const revenue = await listRevenue();
    return NextResponse.json({ revenue });
  } catch (e) {
    console.error('[api/finance/revenue] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// POST /api/finance/revenue — lança uma receita avulsa.
// Body: { description, amount, received_on?, client_id? }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const description = (body.description ?? '').toString().trim();
    const amount = Number(body.amount ?? 0);
    if (!description) return NextResponse.json({ error: 'descricao obrigatoria' }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: 'valor deve ser maior que zero' }, { status: 400 });
    const revenue = await createRevenue({
      description,
      amount,
      received_on: body.received_on ? String(body.received_on) : undefined,
      client_id: body.client_id ? String(body.client_id) : null,
    });
    return NextResponse.json({ revenue }, { status: 201 });
  } catch (e) {
    console.error('[api/finance/revenue] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

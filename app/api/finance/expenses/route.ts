import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listExpenses, createExpense } from '@/src/crm/finance';

// GET /api/finance/expenses — lista as despesas.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const expenses = await listExpenses();
    return NextResponse.json({ expenses });
  } catch (e) {
    console.error('[api/finance/expenses] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// POST /api/finance/expenses — lança uma despesa.
// Body: { description, category?, amount, recurring?, start_date?, end_date? }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const description = (body.description ?? '').toString().trim();
    const amount = Number(body.amount ?? 0);
    if (!description) return NextResponse.json({ error: 'descricao obrigatoria' }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: 'valor deve ser maior que zero' }, { status: 400 });
    const expense = await createExpense({
      description,
      category: body.category ? String(body.category) : 'outros',
      amount,
      recurring: body.recurring === true,
      start_date: body.start_date ? String(body.start_date) : undefined,
      end_date: body.end_date ? String(body.end_date) : null,
    });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (e) {
    console.error('[api/finance/expenses] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

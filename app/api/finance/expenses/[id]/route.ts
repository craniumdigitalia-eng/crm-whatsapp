import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateExpense, deleteExpense } from '@/src/crm/finance';

// PATCH /api/finance/expenses/:id — edita uma despesa.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.description !== undefined) patch.description = String(body.description).trim();
    if (body.category !== undefined) patch.category = String(body.category);
    if (body.amount !== undefined) patch.amount = Number(body.amount);
    if (body.recurring !== undefined) patch.recurring = body.recurring === true;
    if (body.start_date !== undefined) patch.start_date = body.start_date;
    if (body.end_date !== undefined) patch.end_date = body.end_date;
    await updateExpense(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/finance/expenses/:id] PATCH:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// DELETE /api/finance/expenses/:id — remove uma despesa.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteExpense(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/finance/expenses/:id] DELETE:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

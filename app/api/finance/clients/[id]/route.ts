import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateClient, deleteClient } from '@/src/crm/finance';

// PATCH /api/finance/clients/:id — edita um cliente (nome, valor, status, etc.).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.monthly_value !== undefined) patch.monthly_value = Number(body.monthly_value);
    if (body.billing_day !== undefined) patch.billing_day = body.billing_day == null ? null : Number(body.billing_day);
    if (body.status !== undefined) patch.status = body.status;
    if (body.started_at !== undefined) patch.started_at = body.started_at;
    if (body.canceled_at !== undefined) patch.canceled_at = body.canceled_at;
    if (body.notes !== undefined) patch.notes = body.notes;
    await updateClient(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/finance/clients/:id] PATCH:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// DELETE /api/finance/clients/:id — remove um cliente.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteClient(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/finance/clients/:id] DELETE:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { deleteAsset, updateAsset } from '@/src/agent/assets';

// PATCH /api/agente/assets/:id — edita (ativar/desativar, label, caption, categoria).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.label !== undefined) patch.label = String(body.label).trim();
    if (body.caption !== undefined) patch.caption = String(body.caption).trim() || null;
    if (body.active !== undefined) patch.active = body.active === true;
    if (body.category !== undefined) patch.category = String(body.category);
    await updateAsset(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/agente/assets/:id] PATCH:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// DELETE /api/agente/assets/:id — remove o material (Storage + metadata).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteAsset(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/agente/assets/:id] DELETE:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

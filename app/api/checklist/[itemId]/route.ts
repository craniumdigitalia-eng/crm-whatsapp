import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateChecklistItem, deleteChecklistItem } from '@/src/crm/checklists';

// PATCH /api/checklist/:itemId — toggle done / editar text / reordenar position.
// Story 5.13 — Checklists dentro do lead.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { itemId } = await params;
  if (!itemId) return NextResponse.json({ error: 'itemId invalido' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({})) as {
      text?: unknown; done?: unknown; position?: unknown;
    };
    const fields: { text?: string; done?: boolean; position?: number } = {};
    if (typeof body.text === 'string') {
      const text = body.text.trim();
      if (!text) return NextResponse.json({ error: 'text invalido' }, { status: 400 });
      fields.text = text;
    }
    if (typeof body.done === 'boolean') fields.done = body.done;
    if (typeof body.position === 'number' && Number.isFinite(body.position)) {
      fields.position = body.position;
    }
    const item = await updateChecklistItem(itemId, fields);
    if (!item) return NextResponse.json({ error: 'item nao encontrado' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    console.error('[api/checklist/:itemId] PATCH:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/checklist/:itemId — remove um item do checklist.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { itemId } = await params;
  if (!itemId) return NextResponse.json({ error: 'itemId invalido' }, { status: 400 });
  try {
    await deleteChecklistItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/checklist/:itemId] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

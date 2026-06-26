import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateTag, deleteTag, DuplicateTagError } from '@/src/crm/tags';

// PATCH /api/tags/:id — edita name e/ou color de uma etiqueta.
// Story 5.12 — Etiquetas nos leads.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({})) as { name?: unknown; color?: unknown };
    const fields: { name?: string; color?: string } = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'name invalido' }, { status: 400 });
      fields.name = name;
    }
    if (typeof body.color === 'string' && body.color.trim()) fields.color = body.color.trim();
    const tag = await updateTag(id, fields);
    if (!tag) return NextResponse.json({ error: 'etiqueta nao encontrada' }, { status: 404 });
    return NextResponse.json({ tag });
  } catch (e) {
    if (e instanceof DuplicateTagError) {
      return NextResponse.json({ error: 'ja existe uma etiqueta com esse nome' }, { status: 409 });
    }
    console.error('[api/tags/:id] PATCH:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/tags/:id — remove a etiqueta do catalogo (cascateia em lead_tags).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    await deleteTag(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/tags/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

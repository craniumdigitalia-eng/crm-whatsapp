import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead } from '@/src/crm/leads';
import { getLeadTags, addLeadTag, removeLeadTag } from '@/src/crm/tags';

// GET /api/leads/:id/tags — etiquetas aplicadas ao lead.
// Story 5.12 — Etiquetas nos leads.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const tags = await getLeadTags(id);
    return NextResponse.json({ tags });
  } catch (e) {
    console.error('[api/leads/:id/tags] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/leads/:id/tags — atribui uma etiqueta { tag_id } ao lead.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({})) as { tag_id?: unknown };
    if (typeof body.tag_id !== 'string' || !body.tag_id) {
      return NextResponse.json({ error: 'tag_id obrigatorio' }, { status: 400 });
    }
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    await addLeadTag(id, body.tag_id);
    const tags = await getLeadTags(id);
    return NextResponse.json({ tags });
  } catch (e) {
    console.error('[api/leads/:id/tags] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/:id/tags — remove a etiqueta { tag_id } do lead.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({})) as { tag_id?: unknown };
    if (typeof body.tag_id !== 'string' || !body.tag_id) {
      return NextResponse.json({ error: 'tag_id obrigatorio' }, { status: 400 });
    }
    await removeLeadTag(id, body.tag_id);
    const tags = await getLeadTags(id);
    return NextResponse.json({ tags });
  } catch (e) {
    console.error('[api/leads/:id/tags] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

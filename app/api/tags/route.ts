import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listTags, createTag, DuplicateTagError } from '@/src/crm/tags';

// GET /api/tags — catalogo completo de etiquetas (para o picker no drawer).
// Story 5.12 — Etiquetas nos leads.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const tags = await listTags();
    return NextResponse.json({ tags });
  } catch (e) {
    console.error('[api/tags] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/tags — cria uma etiqueta { name, color? }.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({})) as { name?: unknown; color?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name obrigatorio' }, { status: 400 });
    const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : undefined;
    const tag = await createTag(name, color);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateTagError) {
      return NextResponse.json({ error: 'ja existe uma etiqueta com esse nome' }, { status: 409 });
    }
    console.error('[api/tags] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

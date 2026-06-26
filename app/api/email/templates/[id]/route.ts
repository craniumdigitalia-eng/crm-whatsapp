import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getTemplate, updateTemplate, deleteTemplate } from '@/src/crm/email';

// GET /api/email/templates/:id — um template (para edição/preview).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const template = await getTemplate(id);
    if (!template) return NextResponse.json({ error: 'template nao encontrado' }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    console.error('[api/email/templates/:id] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// PATCH /api/email/templates/:id — edita { name?, subject?, html? }.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      subject?: unknown;
      html?: unknown;
    };
    const fields: { name?: string; subject?: string; html?: string } = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'name invalido' }, { status: 400 });
      fields.name = name;
    }
    if (typeof body.subject === 'string') fields.subject = body.subject;
    if (typeof body.html === 'string') fields.html = body.html;
    const template = await updateTemplate(id, fields);
    if (!template) return NextResponse.json({ error: 'template nao encontrado' }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    console.error('[api/email/templates/:id] PATCH:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/email/templates/:id — remove o template.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/email/templates/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

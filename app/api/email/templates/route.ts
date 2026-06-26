import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listTemplates, createTemplate } from '@/src/crm/email';

// GET /api/email/templates — catálogo de templates.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ templates: await listTemplates() });
  } catch (e) {
    console.error('[api/email/templates] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/email/templates — cria um template { name, subject?, html? }.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      subject?: unknown;
      html?: unknown;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name obrigatorio' }, { status: 400 });
    const template = await createTemplate({
      name,
      subject: typeof body.subject === 'string' ? body.subject : undefined,
      html: typeof body.html === 'string' ? body.html : undefined,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    console.error('[api/email/templates] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

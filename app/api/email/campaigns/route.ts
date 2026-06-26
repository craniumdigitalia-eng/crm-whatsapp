import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listCampaigns, createCampaign, parseAudience } from '@/src/crm/email';

// GET /api/email/campaigns — lista de campanhas (mais recentes primeiro).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ campaigns: await listCampaigns() });
  } catch (e) {
    console.error('[api/email/campaigns] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/email/campaigns — cria campanha (rascunho).
// { name, subject?, template_id?, html?, audience? }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      subject?: unknown;
      template_id?: unknown;
      html?: unknown;
      audience?: unknown;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name obrigatorio' }, { status: 400 });

    const campaign = await createCampaign({
      name,
      subject: typeof body.subject === 'string' ? body.subject : undefined,
      template_id: typeof body.template_id === 'string' ? body.template_id : null,
      html: typeof body.html === 'string' ? body.html : undefined,
      audience: body.audience !== undefined ? parseAudience(body.audience) : null,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    console.error('[api/email/campaigns] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

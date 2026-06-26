import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  countRecipients,
  parseAudience,
  CampaignLockedError,
} from '@/src/crm/email';

// GET /api/email/campaigns/:id — campanha + stats (eventos) + total de destinatários.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'campanha nao encontrada' }, { status: 404 });
    const [stats, recipients] = await Promise.all([
      getCampaignStats(id),
      countRecipients(campaign.audience),
    ]);
    return NextResponse.json({ campaign, stats, recipients });
  } catch (e) {
    console.error('[api/email/campaigns/:id] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// PATCH /api/email/campaigns/:id — edita rascunho { name?, subject?, template_id?, html?, audience? }.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'name invalido' }, { status: 400 });
      fields.name = name;
    }
    if (typeof body.subject === 'string') fields.subject = body.subject;
    if (typeof body.html === 'string') fields.html = body.html;
    if ('template_id' in body) {
      fields.template_id = typeof body.template_id === 'string' ? body.template_id : null;
    }
    if ('audience' in body) fields.audience = parseAudience(body.audience);

    const campaign = await updateCampaign(id, fields);
    if (!campaign) return NextResponse.json({ error: 'campanha nao encontrada' }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (e) {
    if (e instanceof CampaignLockedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error('[api/email/campaigns/:id] PATCH:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/email/campaigns/:id — remove a campanha (eventos caem por cascade).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/email/campaigns/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

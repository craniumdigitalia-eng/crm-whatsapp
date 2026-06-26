import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sendCampaign, CampaignLockedError } from '@/src/crm/email';

// POST /api/email/campaigns/:id/send — dispara a campanha (somente admin).
// Usa o origin do request para montar os links de tracking dentro do email.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const origin = new URL(req.url).origin;
    const result = await sendCampaign(id, origin);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof CampaignLockedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error('[api/email/campaigns/:id/send] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

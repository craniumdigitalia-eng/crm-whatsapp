import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { parseAudience, countRecipients } from '@/src/crm/email';

// POST /api/email/preview — conta destinatários de um audience (antes de salvar/enviar).
// Body: { audience: {type:'leads',filters} | {type:'list',list_id} }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { audience?: unknown };
    const audience = parseAudience(body.audience);
    if (!audience) return NextResponse.json({ error: 'audience invalido' }, { status: 400 });
    const count = await countRecipients(audience);
    return NextResponse.json({ count });
  } catch (e) {
    console.error('[api/email/preview] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { recordEvent } from '@/src/crm/email';

// GET /api/email/track/click?c=<campaignId>&e=<email>&u=<urlOriginal>
// NÃO exige login — é o link clicado no email do destinatário. Grava o evento
// 'click' e redireciona (302) para a URL original. Só redireciona para http(s).
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = searchParams.get('c');
  const e = searchParams.get('e');
  const u = searchParams.get('u') ?? '';

  // Valida o destino: apenas http/https. Senão, manda pra raiz do portal.
  let target = '/';
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') target = parsed.toString();
  } catch {
    // u inválido — mantém o fallback.
  }

  if (c && e) {
    await recordEvent(c, e, 'click', { url: target }).catch((err) =>
      console.error('[track/click] recordEvent:', err)
    );
  }

  return NextResponse.redirect(target, { status: 302 });
}

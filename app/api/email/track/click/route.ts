import { NextResponse } from 'next/server';
import { recordEvent } from '@/src/crm/email';
import { verifyClick } from '@/src/crm/email-sign';

// GET /api/email/track/click?c=<campaignId>&e=<email>&u=<urlOriginal>&sig=<hmac>
// NÃO exige login — é o link clicado no email do destinatário. Grava o evento
// 'click' e redireciona (302) para a URL original.
//
// ANTI OPEN-REDIRECT (QA E3): a URL de destino `u` é assinada (HMAC sobre c|e|u)
// no momento do envio. Aqui RECUSAMOS qualquer destino cuja assinatura não bata —
// assim o portal nunca vira redirecionador aberto para phishing.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = searchParams.get('c');
  const e = searchParams.get('e');
  const u = searchParams.get('u') ?? '';
  const sig = searchParams.get('sig');

  // Sem parâmetros mínimos ou assinatura inválida -> não redireciona para `u`.
  // Manda pra raiz do portal (destino seguro) e não grava clique.
  if (!c || !e || !verifyClick(c, e, u, sig)) {
    console.warn('[track/click] assinatura inválida ou ausente — redirect recusado');
    return NextResponse.redirect(new URL('/', req.url), { status: 302 });
  }

  // Defesa em profundidade: mesmo com sig válida, só http/https.
  let target = new URL('/', req.url).toString();
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') target = parsed.toString();
  } catch {
    // u inválido — mantém o fallback (raiz do portal, absoluto).
  }

  await recordEvent(c, e, 'click', { url: target }).catch((err) =>
    console.error('[track/click] recordEvent:', err)
  );

  return NextResponse.redirect(target, { status: 302 });
}

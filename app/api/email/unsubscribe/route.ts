import { suppressEmail, recordEvent } from '@/src/crm/email';
import { verifyUnsub } from '@/src/crm/email-sign';

// GET /api/email/unsubscribe?c=<campaignId>&e=<email>&sig=<hmac>
// Descadastro público (QA E0) — SEM login (chamado do email do destinatário ou
// pelo cliente de email via List-Unsubscribe). A assinatura HMAC(unsub|c|e) é
// obrigatória: sem sig válida, NÃO descadastra (evita opt-out forjado de terceiros).
// Em sucesso, grava na supressão global + marca contatos + registra evento
// 'unsubscribe' e devolve uma página simples.
export const dynamic = 'force-dynamic';

function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#F8F7FF;color:#0F172A;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:40px;max-width:440px;
        text-align:center;box-shadow:0 8px 24px -8px rgba(124,58,237,.18)}
  h1{font-size:20px;margin:0 0 10px;color:#2D0F52}
  p{font-size:14px;color:#475569;line-height:1.6;margin:0}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = searchParams.get('c');
  const e = searchParams.get('e');
  const sig = searchParams.get('sig');

  if (!c || !e || !verifyUnsub(c, e, sig)) {
    return page(
      'Link inválido',
      'Este link de descadastro é inválido ou expirou. Use o link mais recente recebido por e-mail.',
      400
    );
  }

  try {
    await suppressEmail(e, c, 'unsubscribe_link');
    await recordEvent(c, e, 'unsubscribe', { source: 'link' }).catch((err) =>
      console.error('[unsubscribe] recordEvent:', err)
    );
  } catch (err) {
    console.error('[unsubscribe]:', err);
    return page(
      'Erro',
      'Não foi possível processar o descadastro agora. Tente novamente em instantes.',
      500
    );
  }

  return page(
    'Você foi descadastrado',
    'Pronto! O e-mail não receberá mais nossas campanhas. Se foi engano, fale com a gente.',
    200
  );
}

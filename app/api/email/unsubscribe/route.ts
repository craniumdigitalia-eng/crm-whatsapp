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

// Núcleo compartilhado: valida a assinatura e suprime o email.
// Retorna o resultado (ok | inválido | erro) para GET (página) e POST (status).
type UnsubResult = 'ok' | 'invalid' | 'error';

async function processUnsub(c: string | null, e: string | null, sig: string | null): Promise<UnsubResult> {
  if (!c || !e || !verifyUnsub(c, e, sig)) return 'invalid';
  try {
    await suppressEmail(e, c, 'unsubscribe_link');
    await recordEvent(c, e, 'unsubscribe', { source: 'link' }).catch((err) =>
      console.error('[unsubscribe] recordEvent:', err)
    );
    return 'ok';
  } catch (err) {
    console.error('[unsubscribe]:', err);
    return 'error';
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await processUnsub(
    searchParams.get('c'),
    searchParams.get('e'),
    searchParams.get('sig')
  );

  if (result === 'invalid') {
    return page(
      'Link inválido',
      'Este link de descadastro é inválido ou expirou. Use o link mais recente recebido por e-mail.',
      400
    );
  }
  if (result === 'error') {
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

// POST — one-click unsubscribe (RFC 8058). Gmail/Yahoo fazem POST na URL do
// header List-Unsubscribe quando há List-Unsubscribe-Post: One-Click.
// Os parâmetros (c/e/sig) vêm na QUERY STRING dessa URL; também aceitamos via
// corpo (form-urlencoded ou JSON) por robustez. Mesma validação do GET; resposta
// é só um status (não renderiza página).
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  let c = searchParams.get('c');
  let e = searchParams.get('e');
  let sig = searchParams.get('sig');

  // Fallback: se não vieram na query, tenta extrair do corpo.
  if (!c || !e || !sig) {
    try {
      const ct = req.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        c = c || (typeof body.c === 'string' ? body.c : null);
        e = e || (typeof body.e === 'string' ? body.e : null);
        sig = sig || (typeof body.sig === 'string' ? body.sig : null);
      } else {
        const form = await req.formData().catch(() => null);
        if (form) {
          c = c || (form.get('c') as string | null);
          e = e || (form.get('e') as string | null);
          sig = sig || (form.get('sig') as string | null);
        }
      }
    } catch {
      // ignora — cai na validação abaixo
    }
  }

  const result = await processUnsub(c, e, sig);
  if (result === 'invalid') {
    return new Response('assinatura inválida', { status: 400 });
  }
  if (result === 'error') {
    return new Response('erro ao processar', { status: 500 });
  }
  return new Response('ok', { status: 200 });
}

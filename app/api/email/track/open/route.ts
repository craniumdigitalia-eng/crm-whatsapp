import { recordEvent } from '@/src/crm/email';
import { throttle, clientIp } from '@/src/lib/rate-limit';

// GET /api/email/track/open?c=<campaignId>&e=<email>
// Pixel 1x1 transparente. NÃO exige login — é chamado pelo cliente de email do
// destinatário. Grava um evento 'open' e sempre devolve a imagem (fail-open).
//
// Rate limit: 120/min por IP. Clientes de email pre-carregam pixels em lote;
// 120 rpm cobre aberturas legítimas em massa sem bloquear usuarios reais.
export const dynamic = 'force-dynamic';

const OPEN_RATE_LIMIT = 120;

// GIF transparente 1x1.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: Request) {
  // Rate limit: bloqueia martelos no pixel (bot/scanner), mas nao em falha de banco
  // (throttle retorna allowed=true se o Supabase nao responder — fail-open).
  const ip = clientIp(req);
  const rl = await throttle({ key: `email-open:${ip}`, limit: OPEN_RATE_LIMIT, windowSec: 60 });
  // Pixel sempre retorna a imagem (fail-open) — mesmo bloqueado, nao expomos o status.
  if (!rl.allowed) {
    // Retorna o pixel silenciosamente: nao grava o evento, nao expoe o rate limit.
    return new Response(PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': String(PIXEL.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
      },
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const c = searchParams.get('c');
    const e = searchParams.get('e');
    if (c && e) {
      await recordEvent(c, e, 'open').catch((err) =>
        console.error('[track/open] recordEvent:', err)
      );
    }
  } catch (err) {
    console.error('[track/open]:', err);
  }
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  });
}

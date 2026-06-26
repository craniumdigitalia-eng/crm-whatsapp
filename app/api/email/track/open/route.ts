import { recordEvent } from '@/src/crm/email';

// GET /api/email/track/open?c=<campaignId>&e=<email>
// Pixel 1x1 transparente. NÃO exige login — é chamado pelo cliente de email do
// destinatário. Grava um evento 'open' e sempre devolve a imagem (fail-open).
export const dynamic = 'force-dynamic';

// GIF transparente 1x1.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: Request) {
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

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listGroupMessages, storeGroupMessage } from '@/src/crm/groupchat';
import { sendText } from '@/src/whatsapp/evolution';

// GET /api/groups/messages?jid=<groupJid> — histórico de mensagens do grupo.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const jid = new URL(req.url).searchParams.get('jid') ?? '';
  if (!jid) return NextResponse.json({ error: 'jid obrigatorio' }, { status: 400 });
  try {
    const messages = await listGroupMessages(jid);
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('[api/groups/messages] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// POST /api/groups/messages — envia uma mensagem no grupo. Body: { jid, text }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { jid?: unknown; text?: unknown };
    const jid = String(body.jid ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!jid || !text) return NextResponse.json({ error: 'jid e text obrigatorios' }, { status: 400 });

    const sentId = await sendText(jid, text);
    // Grava a saida imediatamente (o eco fromMe do webhook deduplica por external_id).
    await storeGroupMessage({
      externalId: sentId || undefined,
      groupJid: jid,
      direction: 'out',
      senderName: 'Você',
      body: text,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/groups/messages] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listGroupMessages, storeGroupMessage, deleteGroupMessage } from '@/src/crm/groupchat';
import { sendText, deleteGroupMessageForEveryone } from '@/src/whatsapp/evolution';

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

// DELETE /api/groups/messages — apaga uma mensagem do CRM e, quando possivel, do WhatsApp.
// Body: { id: string } — id UUID da linha em group_messages.
// Se a mensagem for de saida (direction='out') e tiver external_id, tenta apagar para
// todos via Evolution. Mensagem recebida (direction='in'): apaga so no CRM (o WhatsApp
// nao permite apagar mensagem de terceiros do dispositivo dos outros).
// Retorna: { ok, deletedFromWhatsApp, crmOnly } para a UI mostrar o aviso correto.
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(body.id ?? '').trim();
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const row = await deleteGroupMessage(id);
    if (!row.found) return NextResponse.json({ error: 'mensagem nao encontrada' }, { status: 404 });

    // Mensagem enviada por nos: tenta apagar para todos no WhatsApp tambem.
    if (row.direction === 'out' && row.external_id && row.group_jid) {
      const evo = await deleteGroupMessageForEveryone(row.group_jid, row.external_id, true);
      return NextResponse.json({ ok: true, deletedFromWhatsApp: evo.ok, crmOnly: !evo.ok, evoError: evo.error });
    }

    // Mensagem recebida (direction='in'): apagada so no CRM.
    return NextResponse.json({ ok: true, deletedFromWhatsApp: false, crmOnly: true });
  } catch (e) {
    console.error('[api/groups/messages] DELETE:', e);
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

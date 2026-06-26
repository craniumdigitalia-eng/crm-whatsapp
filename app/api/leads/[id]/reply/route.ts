import { NextResponse } from 'next/server';
import { getLead, addMessage, setStatus } from '@/src/crm/leads';
import { sendText } from '@/src/whatsapp/evolution';

// POST /api/leads/:id/reply — envia mensagem manual (humano respondendo).
// Coloca o lead em atendimento humano e pausa o agente de IA.
// Migrado de api/leads/[id]/reply.ts (Vercel handler) — Story 5.4.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    const body = await req.json().catch(() => ({})) as { text?: unknown };
    const text = (body.text ?? '').toString().trim();
    if (!text) return NextResponse.json({ error: 'texto vazio' }, { status: 400 });
    await sendText(lead.phone, text);
    await addMessage(id, 'out', text);
    if (lead.status !== 'humano') await setStatus(id, 'humano');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/leads/:id/reply] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

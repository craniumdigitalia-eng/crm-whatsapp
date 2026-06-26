import { NextResponse } from 'next/server';
import { getLead, getMessages } from '@/src/crm/leads';

// GET /api/leads/:id — detalhe do lead + histórico de conversa.
// Migrado de api/leads/[id]/index.ts (Vercel handler) — Story 5.4.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    const messages = await getMessages(id);
    return NextResponse.json({ lead, messages });
  } catch (e) {
    console.error('[api/leads/:id] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

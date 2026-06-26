import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead, getMessages, getLeadAttribution } from '@/src/crm/leads';

// GET /api/leads/:id — detalhe do lead + histórico de conversa.
// Migrado de api/leads/[id]/index.ts (Vercel handler) — Story 5.4.
// Story 5.14: anexa a atribuição/origem (Meta Lead Ads) quando existir.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    const messages = await getMessages(id);
    // Atribuição é tolerante a migration ausente (retorna null) — não bloqueia o drawer.
    const attribution = await getLeadAttribution(id);
    return NextResponse.json({ lead: { ...lead, ...(attribution ?? {}) }, messages });
  } catch (e) {
    console.error('[api/leads/:id] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead, setStatus } from '@/src/crm/leads';

// POST /api/leads/:id/release — devolve o atendimento para o agente de IA.
// Migrado de api/leads/[id]/release.ts (Vercel handler) — Story 5.4.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    if (!(await getLead(id))) {
      return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    }
    await setStatus(id, 'em_atendimento');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/leads/:id/release] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

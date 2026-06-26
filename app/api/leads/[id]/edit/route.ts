import { NextResponse } from 'next/server';
import { getLead, updateLeadFields } from '@/src/crm/leads';

// POST /api/leads/:id/edit — edita campos de qualificação manualmente.
// Migrado de api/leads/[id]/edit.ts (Vercel handler) — Story 5.4.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    if (!(await getLead(id))) {
      return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    }
    const body = await req.json().catch(() => ({})) as {
      name?: string;
      service_interest?: string;
      budget?: string;
      notes?: string;
    };
    const { name, service_interest, budget, notes } = body;
    await updateLeadFields(id, { name, service_interest, budget, notes });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/leads/:id/edit] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

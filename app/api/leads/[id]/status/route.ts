import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead, setStatus } from '@/src/crm/leads';
import { STATUS_LABELS } from '@/src/types';
import type { LeadStatus } from '@/src/types';

function validateStatus(s: unknown): s is LeadStatus {
  return typeof s === 'string' && s in STATUS_LABELS;
}

// POST /api/leads/:id/status — altera o estágio do lead no funil.
// Migrado de api/leads/[id]/status.ts (Vercel handler) — Story 5.4.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    const body = await req.json().catch(() => ({})) as { status?: unknown };
    if (!validateStatus(body.status)) {
      return NextResponse.json({ error: 'status invalido' }, { status: 400 });
    }
    await setStatus(id, body.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/leads/:id/status] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

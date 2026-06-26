import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead } from '@/src/crm/leads';
import {
  listUpcoming,
  listHistory,
  scheduleFollowUp,
} from '@/src/crm/followup-schedule';

// GET /api/followups — lista os follow-ups agendados (pendentes + historico).
// Qualquer membro autenticado da equipe opera o follow-up (requireUser).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const [upcoming, history] = await Promise.all([listUpcoming(), listHistory()]);
    return NextResponse.json({ upcoming, history });
  } catch (e) {
    console.error('[api/followups] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/followups — programa um follow-up para um lead.
// Body: { leadId: string, scheduledAt: ISO string, message: string }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      leadId?: unknown;
      scheduledAt?: unknown;
      message?: unknown;
    };

    const leadId = (body.leadId ?? '').toString().trim();
    const scheduledAtRaw = (body.scheduledAt ?? '').toString().trim();
    const message = (body.message ?? '').toString().trim();

    if (!leadId) return NextResponse.json({ error: 'lead obrigatorio' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });

    // Valida a data: precisa ser parseavel e no futuro.
    const when = new Date(scheduledAtRaw);
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: 'data invalida' }, { status: 400 });
    }
    if (when.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'a data precisa ser no futuro' }, { status: 400 });
    }

    // Garante que o lead existe (FK + 404 amigavel).
    const lead = await getLead(leadId);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });

    const created = await scheduleFollowUp({
      leadId,
      scheduledAt: when.toISOString(),
      message,
      createdBy: auth.user.id,
    });

    return NextResponse.json({ ok: true, followup: created }, { status: 201 });
  } catch (e) {
    console.error('[api/followups] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

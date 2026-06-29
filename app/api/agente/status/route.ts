import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getAgentEnabled, setAgentEnabled } from '@/src/agent/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agente/status — estado atual do interruptor global do agente de IA.
// Qualquer membro autenticado pode consultar (controle operacional da equipe).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const enabled = await getAgentEnabled();
    return NextResponse.json({ enabled });
  } catch (e) {
    console.error('[api/agente/status] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/agente/status — liga ou desliga o agente de IA globalmente.
// Body: { enabled: boolean }
// Qualquer membro autenticado pode pausar/retomar (controle operacional).
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { enabled?: unknown };
    if (typeof body?.enabled !== 'boolean') {
      return NextResponse.json({ error: '"enabled" deve ser boolean' }, { status: 400 });
    }
    await setAgentEnabled(body.enabled);
    return NextResponse.json({ enabled: body.enabled });
  } catch (e) {
    console.error('[api/agente/status] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

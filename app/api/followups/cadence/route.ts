import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import {
  getCadence,
  setCadence,
  parseCadenceSteps,
  DEFAULT_CADENCE,
  type CadenceStep,
} from '@/src/followup/cadence';

// GET /api/followups/cadence — cadencia padrao efetiva (salva ou default).
// Nao e segredo (so textos de retomada), entao vai ao client para preencher o
// formulario. Qualquer membro autenticado pode ver. Inclui o DEFAULT para o
// botao "Restaurar padrao" da UI.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const cadence = await getCadence();
    return NextResponse.json({ ...cadence, defaults: DEFAULT_CADENCE });
  } catch (e) {
    console.error('[api/followups/cadence] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/followups/cadence — salva a cadencia padrao. Mexe em COMO o follow-up
// automatico aborda TODOS os leads, entao exige admin.
// Body: { steps: { dueDay:number, hourBRT:number, message:string }[], enabled: boolean }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      steps?: unknown;
      enabled?: unknown;
    };

    const steps = parseCadenceSteps(body.steps);
    if (!steps) {
      return NextResponse.json(
        { error: 'cada toque precisa de dia (>=1), hora (0-23) e mensagem' },
        { status: 400 }
      );
    }

    const enabled = body.enabled !== false; // default habilitada
    await setCadence(steps as CadenceStep[], enabled);

    const cadence = await getCadence();
    return NextResponse.json({ ok: true, ...cadence, defaults: DEFAULT_CADENCE });
  } catch (e) {
    console.error('[api/followups/cadence] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import {
  getAgentConfig,
  setAgentConfig,
  AGENT_DEFAULTS,
  TONE_OPTIONS,
  type AgentConfig,
} from '@/src/agent/config';

// GET /api/agente/config — config efetiva do agente (valores salvos ou defaults).
// Estes campos NAO sao segredos (persona/tom/abordagem), entao podem ir ao client
// para pre-preencher o formulario. Qualquer membro autenticado pode ver.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const config = await getAgentConfig();
    return NextResponse.json({ config, defaults: AGENT_DEFAULTS, toneOptions: TONE_OPTIONS });
  } catch (e) {
    console.error('[api/agente/config] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/agente/config — salva a personalizacao do agente. Mexe em COMO a IA
// atende todos os leads, entao exige admin. Campos enviados como "" voltam ao default;
// campos ausentes (undefined) sao preservados.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AgentConfig> & {
      tone?: string;
    };
    await setAgentConfig({
      agent_persona_name: body.personaName,
      agent_persona_role: body.personaRole,
      agent_tone: body.tone,
      agent_company_context: body.companyContext,
      agent_opening: body.opening,
      agent_qualification_goals: body.qualificationGoals,
      agent_escalation_rules: body.escalationRules,
      agent_guardrails: body.guardrails,
    });
    const config = await getAgentConfig();
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    console.error('[api/agente/config] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { generateReply } from '@/src/agent/agent';
import { AGENT_DEFAULTS, type AgentConfig, type AgentTone } from '@/src/agent/config';
import type { Lead, Message } from '@/src/types';

// POST /api/agente/preview — testa o agente com uma mensagem de exemplo, SEM gravar
// nada no CRM nem enviar WhatsApp (dry-run). Usa um lead fake em memoria e a config
// vinda do formulario (mesmo que ainda nao salva), para o admin ver o efeito das
// edicoes antes de salvar. Exige admin (consome a API da Anthropic).
function isTone(v: unknown): v is AgentTone {
  return v === 'amigavel' || v === 'profissional' || v === 'consultivo';
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      leadName?: string;
      config?: Partial<AgentConfig> & { tone?: string };
    };

    const message = (body.message ?? '').trim();
    if (!message) {
      return NextResponse.json({ error: 'mensagem vazia' }, { status: 400 });
    }

    // Config efetiva da previa: defaults com as edicoes do formulario por cima.
    const c = body.config ?? {};
    const cfg: AgentConfig = {
      personaName: c.personaName?.trim() || AGENT_DEFAULTS.personaName,
      personaRole: c.personaRole?.trim() || AGENT_DEFAULTS.personaRole,
      tone: isTone(c.tone) ? c.tone : AGENT_DEFAULTS.tone,
      companyContext: c.companyContext?.trim() || AGENT_DEFAULTS.companyContext,
      opening: c.opening?.trim() || AGENT_DEFAULTS.opening,
      qualificationGoals: c.qualificationGoals?.trim() || AGENT_DEFAULTS.qualificationGoals,
      escalationRules: c.escalationRules?.trim() || AGENT_DEFAULTS.escalationRules,
      guardrails: c.guardrails?.trim() || AGENT_DEFAULTS.guardrails,
    };

    const now = new Date().toISOString();
    const fakeLead = {
      id: 'preview',
      phone: '5500000000000',
      name: body.leadName?.trim() || null,
      status: 'novo',
    } as Lead;
    const history: Message[] = [
      {
        id: 'preview-msg',
        lead_id: 'preview',
        direction: 'in',
        body: message,
        external_id: null,
        created_at: now,
      },
    ];

    const result = await generateReply(fakeLead, history, { config: cfg, dryRun: true });
    return NextResponse.json({ reply: result.reply, handoff: result.handoff });
  } catch (e) {
    console.error('[api/agente/preview] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

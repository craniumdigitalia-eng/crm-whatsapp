import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createCampaign, parseAudience } from '@/src/crm/email';
import { gerarPilula, escolherTema } from '@/src/crm/email-content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Permite até 60s — a chamada ao Claude pode levar alguns segundos.
export const maxDuration = 60;

// POST /api/email/generate
// Body: { theme?: string, audience?: Audience }
//   theme    = tema da pílula (se vazio, escolhe um dos padrão aleatoriamente)
//   audience = público-alvo da campanha (opcional; segue o tipo Audience de email.ts)
// Resposta: { campaign } — campanha criada com status "rascunho"
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      theme?: unknown;
      audience?: unknown;
    };

    // Tema: usa o informado (se preenchido) ou sorteia um dos padrão.
    const theme =
      typeof body.theme === 'string' && body.theme.trim()
        ? body.theme.trim()
        : escolherTema();

    const audience = body.audience !== undefined ? parseAudience(body.audience) : null;

    // Gera o conteúdo da pílula via Claude.
    const { subject, html } = await gerarPilula(theme);

    // Cria a campanha como rascunho (createCampaign sempre cria com status "rascunho").
    const campaign = await createCampaign({
      name: `Pílula: ${subject || theme}`,
      subject,
      html,
      audience,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    console.error('[api/email/generate] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getEvolutionConnectionStatus } from '@/src/crm/integrations';
import { instanceStatus, EvolutionConfigError, EvolutionApiError } from '@/src/whatsapp/evolution-admin';

// GET /api/integrations/evolution/status — estado da conexao da instancia.
// requireUser: qualquer membro da equipe pode ver se o WhatsApp esta conectado.
// Retorna { configured, state, number?, ... } — sem expor a apikey.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const flags = await getEvolutionConnectionStatus();
    // Sem credenciais nao adianta bater na Evolution: responde "nao configurada".
    if (!flags.configured) {
      return NextResponse.json({ ...flags, state: 'disconnected' });
    }
    const status = await instanceStatus();
    return NextResponse.json({ ...flags, ...status });
  } catch (e) {
    if (e instanceof EvolutionConfigError) {
      return NextResponse.json({ configured: false, state: 'disconnected', error: e.message }, { status: 200 });
    }
    if (e instanceof EvolutionApiError) {
      // Evolution fora do ar: reporta como "unreachable" sem derrubar a UI.
      return NextResponse.json({ configured: true, state: 'unreachable', error: e.message }, { status: 200 });
    }
    console.error('[api/integrations/evolution/status] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

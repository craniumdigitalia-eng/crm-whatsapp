import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { connectInstance, EvolutionConfigError, EvolutionApiError } from '@/src/whatsapp/evolution-admin';

// POST /api/integrations/evolution/connect — cria/conecta a instancia na Evolution
// e devolve o QR code (base64) para parear. RBAC: admin (aciona a Evolution).
// O browser NUNCA fala direto com a Evolution — este proxy guarda a apikey no server.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await connectInstance();
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof EvolutionConfigError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof EvolutionApiError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error('[api/integrations/evolution/connect] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

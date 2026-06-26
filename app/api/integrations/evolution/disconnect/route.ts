import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { logoutInstance, EvolutionConfigError, EvolutionApiError } from '@/src/whatsapp/evolution-admin';

// POST /api/integrations/evolution/disconnect — derruba a sessao pareada (logout).
// RBAC: admin. Idempotente: instancia ja desconectada retorna ok.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    await logoutInstance();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EvolutionConfigError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof EvolutionApiError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error('[api/integrations/evolution/disconnect] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

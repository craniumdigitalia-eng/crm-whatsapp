import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getGoogleConnectionStatus } from '@/src/crm/integrations';

// GET /api/integrations/google/status — status da conexao Google Calendar (sem segredos).
// requireUser: qualquer membro autenticado ve o status no painel de Integracoes.
// { configured: ha client_id/secret; connected: ha refresh_token; calendarId }
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const status = await getGoogleConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error('[api/integrations/google/status] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

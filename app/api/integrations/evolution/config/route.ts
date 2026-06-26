import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import { getEvolutionConnectionStatus, setConfigValues } from '@/src/crm/integrations';

// GET /api/integrations/evolution/config — flags de configuracao (sem segredos).
// requireUser: a UI mostra url/instance e SE a apikey/token existem.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const status = await getEvolutionConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error('[api/integrations/evolution/config] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/integrations/evolution/config — salva url/apikey/instance/webhook token
// em integrations_config (override do env). Campos vazios sao ignorados (nao apagam
// um segredo ja salvo). RBAC: admin (grava a apikey).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({})) as {
      url?: string;
      api_key?: string;
      instance?: string;
      webhook_token?: string;
    };
    await setConfigValues({
      evolution_url: body.url?.replace(/\/$/, ''),
      evolution_api_key: body.api_key,
      evolution_instance: body.instance,
      evolution_webhook_token: body.webhook_token,
    });
    const status = await getEvolutionConnectionStatus();
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[api/integrations/evolution/config] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

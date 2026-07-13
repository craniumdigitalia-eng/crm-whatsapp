import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import { getOpenAiStatus, setConfigValues } from '@/src/crm/integrations';

// GET /api/integrations/openai/config — status da chave OpenAI (sem revelar o valor).
// Retorna { hasKey, source } onde source = 'db' | 'env' | 'none'. Story BYOK.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const status = await getOpenAiStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error('[api/integrations/openai/config] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/integrations/openai/config — salva a chave da OpenAI via aba Integracoes.
// Body: { api_key?: string }. Campo vazio e ignorado (nao apaga uma chave ja salva).
// RBAC: exige admin (grava credencial sensivel).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({})) as { api_key?: string };
    await setConfigValues({ openai_api_key: body.api_key });
    const status = await getOpenAiStatus();
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[api/integrations/openai/config] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

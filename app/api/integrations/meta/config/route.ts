import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import { getMetaConnectionStatus, setConfigValues } from '@/src/crm/integrations';

// GET /api/integrations/meta/config — status da conexao Meta (sem revelar segredos).
// Retorna apenas flags has* e o form id (que nao e segredo). Story 5.14.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const status = await getMetaConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error('[api/integrations/meta/config] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/integrations/meta/config — salva as credenciais vindas da aba Integracoes.
// Body: { page_access_token?, app_secret?, verify_token?, form_id? }.
// Campos vazios sao ignorados (nao apagam um segredo ja salvo).
// RBAC: grava token/secret do Meta -> exige admin (S2). O GET acima e so leitura
// de flags has* (nao-secretas), entao basta requireUser.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({})) as {
      page_access_token?: string;
      app_secret?: string;
      verify_token?: string;
      form_id?: string;
    };
    await setConfigValues({
      meta_page_access_token: body.page_access_token,
      meta_app_secret: body.app_secret,
      meta_verify_token: body.verify_token,
      meta_form_id: body.form_id,
    });
    const status = await getMetaConnectionStatus();
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[api/integrations/meta/config] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth';
import { getEmailConnectionStatus, setConfigValues } from '@/src/crm/integrations';

// GET /api/email/config — status "seguro" do provedor de envio (sem revelar a api key).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getEmailConnectionStatus());
  } catch (e) {
    console.error('[api/email/config] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// PUT /api/email/config — salva config do provedor (somente admin).
// { provider?, apiKey?, from?, user?, appPassword? }. Campos vazios não
// sobrescrevem segredo já salvo. Para Gmail SMTP: provider='gmail', user (conta
// Gmail) e appPassword (senha de app de 16 chars; espaços são removidos).
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      provider?: unknown;
      apiKey?: unknown;
      from?: unknown;
      user?: unknown;
      appPassword?: unknown;
    };
    await setConfigValues({
      email_provider: typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : undefined,
      email_api_key: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      email_from: typeof body.from === 'string' ? body.from : undefined,
      email_user: typeof body.user === 'string' ? body.user.trim() : undefined,
      // Senha de app do Gmail: remove espaços (o Google exibe em grupos de 4).
      email_app_password:
        typeof body.appPassword === 'string' ? body.appPassword.replace(/\s+/g, '') : undefined,
    });
    return NextResponse.json(await getEmailConnectionStatus());
  } catch (e) {
    console.error('[api/email/config] PUT:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

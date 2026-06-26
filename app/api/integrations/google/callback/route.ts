import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGoogleConfig, setConfigValues } from '@/src/crm/integrations';

// GET /api/integrations/google/callback — retorno do consentimento OAuth do Google.
// Chamado pelo BROWSER do admin voltando do Google (nao por uma maquina), entao NAO
// exige requireUser: a protecao e o `state` CSRF (cookie httpOnly setado no /auth).
// Troca o `code` por tokens e persiste o refresh_token em integrations_config.
// Em sucesso/erro, volta pra /integracoes com um query param que a UI traduz em banner.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function redirectUri(req: Request, configured: string): string {
  if (configured) return configured;
  return `${new URL(req.url).origin}/api/integrations/google/callback`;
}

function back(req: Request, status: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/integracoes?google=${status}`, req.url));
  // Limpa o cookie de CSRF (uso unico).
  res.cookies.set('g_oauth_state', '', { path: '/api/integrations/google', maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return back(req, 'cancelado');
  if (!code) return back(req, 'sem_code');

  // CSRF: o state precisa bater com o cookie setado no /auth.
  const cookieStore = await cookies();
  const expected = cookieStore.get('g_oauth_state')?.value;
  if (!expected || !state || state !== expected) {
    return back(req, 'state_invalido');
  }

  const cfg = await getGoogleConfig();
  if (!cfg.clientId || !cfg.clientSecret) return back(req, 'nao_configurado');

  let tokenRes: Response;
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri(req, cfg.redirectUri),
        grant_type: 'authorization_code',
      }),
    });
  } catch (e) {
    console.error('[google/callback] rede:', e);
    return back(req, 'erro');
  }

  const tokens = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok) {
    console.error('[google/callback] token:', tokens.error_description ?? tokens.error);
    return back(req, 'erro');
  }
  if (!tokens.refresh_token) {
    // Sem refresh_token (consentimento ja dado antes sem prompt=consent, ou app em modo teste).
    // O /auth forca prompt=consent, mas se faltar pedimos pra revogar acesso e reconectar.
    return back(req, 'sem_refresh');
  }

  try {
    await setConfigValues({ google_refresh_token: tokens.refresh_token });
  } catch (e) {
    console.error('[google/callback] persistir refresh_token:', e);
    return back(req, 'erro');
  }

  return back(req, 'conectado');
}

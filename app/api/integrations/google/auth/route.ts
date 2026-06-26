import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { getGoogleConfig } from '@/src/crm/integrations';

// GET /api/integrations/google/auth — inicia o OAuth 2.0 do Google Calendar.
// RBAC: requireAdmin (so admin conecta a agenda da equipe).
// Redireciona para o consentimento Google pedindo o escopo calendar.events,
// com access_type=offline + prompt=consent (garante o refresh_token na 1a vez).
// Protecao CSRF: gera um `state` aleatorio e o guarda num cookie httpOnly; o callback
// confere os dois. O redirect_uri vem do env (GOOGLE_REDIRECT_URI) ou e derivado do
// host atual ({origin}/api/integrations/google/callback) — funciona em localhost e Vercel.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function redirectUri(req: Request, configured: string): string {
  if (configured) return configured;
  return `${new URL(req.url).origin}/api/integrations/google/callback`;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const cfg = await getGoogleConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    // Sem credenciais: volta pra aba Integracoes com aviso (UI mostra "Google nao configurado").
    return NextResponse.redirect(new URL('/integracoes?google=nao_configurado', req.url));
  }

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(req, cfg.redirectUri),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  // Cookie de CSRF — curto, httpOnly, lido so pelo callback.
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations/google',
    maxAge: 600, // 10 min
  });
  return res;
}

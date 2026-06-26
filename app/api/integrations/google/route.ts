import { NextResponse } from 'next/server';

// GET /api/integrations/google — compat: o fluxo OAuth real vive em
// /api/integrations/google/auth (inicia) + /callback (troca o code) + /status.
// Mantido para o link antigo: apenas redireciona para o /auth.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/api/integrations/google/auth', req.url));
}

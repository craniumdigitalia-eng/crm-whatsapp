import { NextResponse } from 'next/server';

// GET /api/health — liveness check. Equivalente ao app.get("/health") do Express.
// Publico (sem token/sessao). O middleware ja exclui /api/*.
export async function GET() {
  return NextResponse.json({ ok: true });
}

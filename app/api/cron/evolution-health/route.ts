import { NextResponse } from 'next/server';
import { config } from '@/src/config';
import { checkEvolutionHealth } from '@/src/crm/health';

// GET/POST /api/cron/evolution-health — checa a conexao da Evolution e, na
// TRANSICAO (cai/volta), avisa por e-mail. Disparado pelo Vercel Cron (vercel.json)
// OU por um monitor externo (UptimeRobot/cron-job.org) via ?token={CRON_SECRET}.
//
// Auth: Authorization: Bearer {CRON_SECRET} (Vercel injeta) OU ?token={CRON_SECRET}.
export const maxDuration = 30;

async function run(req: Request): Promise<NextResponse> {
  const expected = config.cronSecret;
  const url = new URL(req.url);
  const okBearer = req.headers.get('authorization') === `Bearer ${expected}`;
  const okToken = url.searchParams.get('token') === expected;
  if (!expected || !(okBearer || okToken)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 });
  }
  try {
    const r = await checkEvolutionHealth();
    console.log(
      `[cron/evolution-health] state=${r.state} up=${r.up} changed=${r.changed} alertSent=${r.alertSent}`
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[cron/evolution-health]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}

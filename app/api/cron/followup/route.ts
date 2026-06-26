import { NextResponse } from 'next/server';
import { config } from '@/src/config';
import { runFollowUpCheck } from '@/src/followup/scheduler';

// GET /api/cron/followup — motor de follow-up disparado pelo Vercel Cron (vercel.json).
// Tambem aceita POST para disparo manual (testes/depuracao).
//
// Endpoint de MAQUINA — protegido pelo Authorization: Bearer {CRON_SECRET}, nunca por
// sessao (o middleware ja exclui /api/*). NAO usa requireUser.
// A Vercel injeta o header automaticamente nas chamadas de Cron; validar garante que
// apenas a plataforma (ou chamadores autorizados) podem acionar o ciclo.
//
// Batch: processa ate config.followupBatch leads por invocacao (padrao 50).
// Evita estourar o timeout da funcao serverless em bases grandes.
// Para volumes maiores, reduzir FOLLOWUP_BATCH ou aumentar a frequencia do cron.
export const maxDuration = 60;

async function runCron(req: Request) {
  // Rejeita se CRON_SECRET nao estiver configurado ou o token nao bater.
  const expected = config.cronSecret;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 });
  }

  try {
    const { sent, skipped, errors } = await runFollowUpCheck(config.followupBatch);
    console.log(
      `[cron/followup] ciclo concluido — enviados: ${sent}, pulados: ${skipped}, erros: ${errors}`
    );
    return NextResponse.json({ ok: true, sent, skipped, errors });
  } catch (e) {
    console.error('[cron/followup] erro no ciclo:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}

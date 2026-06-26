import { NextResponse } from 'next/server';
import { config } from '@/src/config';
import { runFollowUpCheck, runScheduledFollowUps } from '@/src/followup/scheduler';

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

  // Dois ciclos independentes na mesma rodada de cron:
  //  1) follow-up AUTOMATICO generico (leads.follow_up_count / FOLLOWUP_*).
  //  2) follow-ups AGENDADOS por lead (migration 008).
  // Isolados em try/catch separados: a falha de um NAO impede o outro de rodar.
  let auto = { sent: 0, skipped: 0, errors: 0 };
  let agendado = { sent: 0, errors: 0 };
  let failed = false;

  try {
    auto = await runFollowUpCheck(config.followupBatch);
    console.log(
      `[cron/followup] automatico — enviados: ${auto.sent}, pulados: ${auto.skipped}, erros: ${auto.errors}`
    );
  } catch (e) {
    failed = true;
    console.error('[cron/followup] erro no ciclo automatico:', e);
  }

  try {
    agendado = await runScheduledFollowUps();
    console.log(
      `[cron/followup] agendado — enviados: ${agendado.sent}, erros: ${agendado.errors}`
    );
  } catch (e) {
    failed = true;
    console.error('[cron/followup] erro no ciclo agendado:', e);
  }

  return NextResponse.json(
    {
      ok: !failed,
      auto,
      agendado,
      // Compat: campos no topo refletem o ciclo automatico (consumidores antigos).
      sent: auto.sent,
      skipped: auto.skipped,
      errors: auto.errors,
    },
    { status: failed ? 500 : 200 }
  );
}

export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}

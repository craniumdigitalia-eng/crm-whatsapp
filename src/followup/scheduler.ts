import cron from "node-cron";
import { config } from "../config";
import { Lead, AUTO_STATUSES, LeadStatus } from "../types";
import {
  addMessage,
  claimFollowUp,
  listFollowUpCandidates,
  setStatus,
  updateLeadFields,
} from "../crm/leads";
import { getDueFollowUps, markError, markSent } from "../crm/followup-schedule";
import {
  getCadence,
  cadenceMessage,
  brtHour,
  brtDayStartMs,
  elapsedBrtDays,
  CLOSURE_NOTE,
} from "./cadence";
import { sendText } from "../whatsapp/evolution";

// Estagios que entram na CADENCIA padrao: so leads aguardando resposta.
// Note que AUTO_STATUSES inclui 'qualificado' (o agente ainda responde la),
// mas um lead qualificado NAO deve receber a cadencia de retomada — ele segue
// pela mao do agente/equipe. Por isso a cadencia mira so estes dois estagios.
const CADENCE_STATUSES: LeadStatus[] = ["novo", "em_atendimento"];

// Rotacao de mensagens de retomada. Como sao ate 30 follow-ups por lead,
// variamos o texto ciclando por estas opcoes (e uma final na ultima tentativa).
const ROTATION = [
  (n: string) => `${n ? `Oi ${n}!` : "Oi!"} So passando pra saber se ainda posso te ajudar com o que conversamos 😊`,
  (n: string) => `${n ? n + ", " : ""}voltando rapidinho aqui 👀 Se fizer sentido, consigo te mostrar como a gente ajuda. Quer seguir?`,
  (n: string) => `${n ? "Oi " + n + "! " : ""}Ficou alguma duvida do que falamos? Posso esclarecer por aqui.`,
  (n: string) => `${n ? n + ", " : ""}quando for um bom momento pra retomar, e so me chamar. Sigo a disposicao!`,
  (n: string) => `${n ? "Oi " + n + "! " : ""}Tenho uma ideia que pode encaixar no seu caso. Quer que eu te conte rapidinho?`,
];

function lastChance(n: string): string {
  return `${n ? "Oi " + n + "! " : ""}Vou parar de te chamar por aqui pra nao incomodar. Se quiser retomar a qualquer momento, e so mandar mensagem. Um abraco!`;
}

function followUpText(stage: number, max: number, lead: Lead): string {
  const nome = lead.name ? lead.name.split(" ")[0] : "";
  if (stage >= max - 1) return lastChance(nome);
  return ROTATION[stage % ROTATION.length](nome);
}

export interface FollowUpResult {
  sent: number;
  skipped: number;
  errors: number;
}

// Executa um ciclo de retomadas: busca candidatos, aplica claim atomico e envia via canal.
// batchLimit: maximo de leads avaliados por ciclo (padrao: config.followupBatch).
// Exportada para uso direto pela funcao serverless /api/cron/followup (Story 3.4).
//
// Duas modalidades:
//  - CADENCIA padrao habilitada: o passo = follow_up_count (0-based); a mensagem
//    e a do passo (com {nome} interpolado). O disparo so ocorre se:
//      (a) elapsedDays (dias desde a criacao do lead) >= dueDay do passo;
//      (b) a hora BRT atual >= hourBRT do passo;
//      (c) o lead ainda nao recebeu follow-up HOJE (no maximo 1 toque/dia).
//    Apos o ultimo toque sem resposta, o lead e encerrado (status 'perdido' +
//    nota de encerramento). Maximo de toques = tamanho da cadencia. So leads em
//    novo/em_atendimento aguardando resposta entram.
//  - CADENCIA desabilitada: fallback para o comportamento ROTATION generico
//    (config.followupMax / config.followupIntervalMs / AUTO_STATUSES).
// Em ambas, o claim atomico e o reset ao responder (handler) sao preservados.
export async function runFollowUpCheck(batchLimit = config.followupBatch): Promise<FollowUpResult> {
  const cadence = await getCadence();
  const useCadence = cadence.enabled && cadence.steps.length > 0;

  // Em modo cadencia, o limite de toques e o tamanho da cadencia e so leads
  // aguardando resposta (novo/em_atendimento) entram. No fallback, mantem o
  // comportamento original (AUTO_STATUSES + followupMax).
  const maxCount = useCadence ? cadence.steps.length : config.followupMax;
  const statuses = useCadence ? CADENCE_STATUSES : AUTO_STATUSES;
  const leads = await listFollowUpCandidates(statuses, maxCount, batchLimit);

  const now = Date.now();
  const result: FollowUpResult = { sent: 0, skipped: 0, errors: 0 };

  // Em modo cadencia: a hora local (BRT) deste ciclo e o corte da meia-noite BRT
  // de hoje. Constantes do ciclo, calculadas uma vez (servidor roda em UTC).
  const nowDate = new Date(now);
  const hourNowBRT = useCadence ? brtHour(nowDate) : 0;
  const todayStartMs = useCadence ? brtDayStartMs(nowDate) : 0;

  for (const lead of leads) {
    const stage = lead.follow_up_count; // toques ja enviados (pre-claim)

    // Intervalo e texto dependem da modalidade. Em cadencia, o passo `stage`
    // define a mensagem, o dia minimo (dueDay) e a hora minima; o "1 toque/dia"
    // vem do corte BRT.
    let intervalMs: number;
    let text: string;
    if (useCadence) {
      const step = cadence.steps[stage];
      const msg = cadenceMessage(cadence.steps, stage, lead.name);
      if (!step || msg === null) {
        // Passo fora da cadencia (lead ja recebeu todos os toques). Guarda defensiva.
        result.skipped++;
        continue;
      }
      // Gate de DIA: so dispara quando ja se passaram dueDay dias desde a criacao.
      if (elapsedBrtDays(lead.created_at, nowDate) < step.dueDay) {
        result.skipped++;
        continue;
      }
      // Gate de HORA: so dispara a partir da hora (BRT) prevista para o passo.
      if (hourNowBRT < step.hourBRT) {
        result.skipped++;
        continue;
      }
      // Intervalo = tempo desde a meia-noite BRT de hoje. Combinado com o claim
      // atomico (last_message_at < meia-noite de hoje), garante no maximo 1 toque
      // por dia: so e elegivel se o ultimo contato foi ANTES de hoje.
      intervalMs = now - todayStartMs;
      text = msg;
    } else {
      intervalMs = config.followupIntervalMs;
      text = followUpText(stage, maxCount, lead);
    }

    const last = new Date(lead.last_message_at!).getTime();
    if (now - last < intervalMs) {
      // Otimizacao: evita round-trip de claim desnecessario para leads ainda dentro do intervalo
      // (em cadencia: leads ja contatados hoje).
      result.skipped++;
      continue;
    }

    // Claim atomico: incrementa follow_up_count somente se o lead ainda esta elegivel.
    // Protege contra: lead respondeu entre a leitura e o envio (last_direction vira 'in');
    //                 dois processos de cron rodando em paralelo sobre o mesmo lead.
    const claimed = await claimFollowUp(lead.id, stage, maxCount, intervalMs);
    if (!claimed) {
      console.log(
        `[followup] Claim falhou para ${lead.phone} — lead respondeu ou concorrencia detectada.`
      );
      result.skipped++;
      continue;
    }

    const newCount = stage + 1;
    const isLast = newCount >= maxCount;

    try {
      await sendText(lead.phone, text);
      await addMessage(lead.id, "out", text);
      console.log(`[followup] Retomada #${newCount}/${maxCount} para ${lead.phone}`);
      result.sent++;
    } catch (err) {
      console.error(`[followup] Falha ao enviar retomada para ${lead.phone}:`, err);
      result.errors++;
    }

    // Ao atingir o limite de toques, encerra o lead (transita para perdido).
    // Ocorre mesmo em caso de falha de envio: o counter ja foi incrementado e
    // o lead nao sera selecionado em ciclos futuros (follow_up_count < max deixa de ser verdadeiro).
    // Em cadencia, grava a nota de encerramento automatico (sem mais mensagens).
    if (isLast) {
      if (useCadence) {
        await updateLeadFields(lead.id, { status: "perdido", notes: CLOSURE_NOTE });
        console.log(`[followup] Lead ${lead.phone} concluiu a cadencia (${maxCount} toques) → encerrado.`);
      } else {
        await setStatus(lead.id, "perdido");
        console.log(`[followup] Lead ${lead.phone} atingiu ${maxCount} retomadas → perdido.`);
      }
    }
  }

  return result;
}

export interface ScheduledFollowUpResult {
  sent: number;
  errors: number;
}

// Processa os follow-ups AGENDADOS por lead (migration 008) que ja venceram.
// Diferente do follow-up automatico (runFollowUpCheck): aqui a equipe programou
// manualmente "lembrar o lead X em N dias com esta mensagem".
//
// ATENCAO precisao: na Vercel Hobby o cron roda 1x/dia (12h UTC) — entao um item
// agendado para 14h dispara na rodada do dia seguinte. Precisao fina (minutos)
// exige o plano Pro (cron mais frequente). Documentado tambem na UI.
//
// Robustez: claim-then-send. markSent() faz o claim atomico (status pendente->enviado)
// ANTES do envio, fechando a janela de envio-duplo caso dois ciclos rodem em paralelo.
// Cada item e isolado: uma falha de envio vira markError e NAO aborta os demais.
export async function runScheduledFollowUps(now = new Date()): Promise<ScheduledFollowUpResult> {
  const due = await getDueFollowUps(now.toISOString());
  const result: ScheduledFollowUpResult = { sent: 0, errors: 0 };

  for (const item of due) {
    if (!item.lead?.phone) {
      // Lead sem telefone (ou removido entre o select e o processamento): marca erro e segue.
      console.error(`[followup-agendado] item ${item.id} sem telefone do lead — pulando.`);
      await markError(item.id).catch(() => {});
      result.errors++;
      continue;
    }

    // Claim atomico: garante que so um ciclo envia este item.
    const claimed = await markSent(item.id);
    if (!claimed) {
      // Outro ciclo ja pegou (ou foi cancelado entre o select e agora).
      continue;
    }

    try {
      await sendText(item.lead.phone, item.message);
      await addMessage(item.lead_id, "out", item.message);
      console.log(`[followup-agendado] enviado para ${item.lead.phone} (item ${item.id}).`);
      result.sent++;
    } catch (err) {
      console.error(`[followup-agendado] falha ao enviar item ${item.id}:`, err);
      // Reverte o claim para 'erro' — a equipe reprograma manualmente.
      await markError(item.id).catch(() => {});
      result.errors++;
    }
  }

  return result;
}

// startFollowUpEngine: usado apenas em dev local (src/index.ts).
// Producao usa a funcao serverless /api/cron/followup (Story 3.4).
export function startFollowUpEngine(): void {
  cron.schedule(config.followupCron, () => {
    runFollowUpCheck().catch((e) => console.error("[followup] erro no ciclo:", e));
  });
  console.log(
    `[followup] Motor ativo: ate ${config.followupMax} retomadas/lead (cron: ${config.followupCron}).`
  );
}

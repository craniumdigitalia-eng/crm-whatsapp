import cron from "node-cron";
import { config } from "../config";
import { Lead, AUTO_STATUSES } from "../types";
import { addMessage, claimFollowUp, listFollowUpCandidates, setStatus } from "../crm/leads";
import { getDueFollowUps, markError, markSent } from "../crm/followup-schedule";
import { sendText } from "../whatsapp/evolution";

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
export async function runFollowUpCheck(batchLimit = config.followupBatch): Promise<FollowUpResult> {
  const leads = await listFollowUpCandidates(AUTO_STATUSES, config.followupMax, batchLimit);

  const now = Date.now();
  const result: FollowUpResult = { sent: 0, skipped: 0, errors: 0 };

  for (const lead of leads) {
    const last = new Date(lead.last_message_at!).getTime();
    if (now - last < config.followupIntervalMs) {
      // Otimizacao: evita round-trip de claim desnecessario para leads ainda dentro do intervalo.
      result.skipped++;
      continue;
    }

    // Texto calculado com o contador pre-claim (stage = numero de retomadas ja enviadas).
    const text = followUpText(lead.follow_up_count, config.followupMax, lead);

    // Claim atomico: incrementa follow_up_count somente se o lead ainda esta elegivel.
    // Protege contra: lead respondeu entre a leitura e o envio (last_direction vira 'in');
    //                 dois processos de cron rodando em paralelo sobre o mesmo lead.
    const claimed = await claimFollowUp(
      lead.id,
      lead.follow_up_count,
      config.followupMax,
      config.followupIntervalMs
    );
    if (!claimed) {
      console.log(
        `[followup] Claim falhou para ${lead.phone} — lead respondeu ou concorrencia detectada.`
      );
      result.skipped++;
      continue;
    }

    const newCount = lead.follow_up_count + 1;
    const isLast = newCount >= config.followupMax;

    try {
      await sendText(lead.phone, text);
      await addMessage(lead.id, "out", text);
      console.log(`[followup] Retomada #${newCount}/${config.followupMax} para ${lead.phone}`);
      result.sent++;
    } catch (err) {
      console.error(`[followup] Falha ao enviar retomada para ${lead.phone}:`, err);
      result.errors++;
    }

    // Ao atingir o limite de retomadas, transita para perdido.
    // Ocorre mesmo em caso de falha de envio: o counter ja foi incrementado e
    // o lead nao sera selecionado em ciclos futuros (follow_up_count < max deixa de ser verdadeiro).
    if (isLast) {
      await setStatus(lead.id, "perdido");
      console.log(
        `[followup] Lead ${lead.phone} atingiu ${config.followupMax} retomadas → perdido.`
      );
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

import cron from "node-cron";
import { config } from "../config";
import { db } from "../db";
import { Lead, AUTO_STATUSES } from "../types";
import { addMessage, claimFollowUp, setStatus } from "../crm/leads";
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

function parseSqliteDate(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

async function runFollowUpCheck(): Promise<void> {
  const placeholders = AUTO_STATUSES.map(() => "?").join(",");
  const leads = db
    .prepare(
      `SELECT * FROM leads
       WHERE status IN (${placeholders})
         AND last_direction = 'out'
         AND last_message_at IS NOT NULL
         AND follow_up_count < ?`
    )
    .all(...AUTO_STATUSES, config.followupMax) as Lead[];

  const now = Date.now();

  for (const lead of leads) {
    const last = parseSqliteDate(lead.last_message_at!).getTime();
    if (now - last < config.followupIntervalMs) continue; // otimizacao: evita round-trip desnecessario

    // Texto calculado com o contador pre-claim (stage = numero de retomadas ja enviadas).
    const text = followUpText(lead.follow_up_count, config.followupMax, lead);

    // Claim atomico: incrementa follow_up_count somente se o lead ainda esta elegivel.
    // Protege contra: lead respondeu entre a leitura e o envio (last_direction vira 'in');
    //                 dois processos de cron rodando em paralelo sobre o mesmo lead.
    const claimed = claimFollowUp(
      lead.id,
      lead.follow_up_count,
      config.followupMax,
      config.followupIntervalMs
    );
    if (!claimed) {
      console.log(
        `[followup] Claim falhou para ${lead.phone} — lead respondeu ou concorrencia detectada.`
      );
      continue;
    }

    const newCount = lead.follow_up_count + 1;
    const isLast = newCount >= config.followupMax;

    try {
      await sendText(lead.phone, text);
      addMessage(lead.id, "out", text);
      console.log(`[followup] Retomada #${newCount}/${config.followupMax} para ${lead.phone}`);
    } catch (err) {
      console.error(`[followup] Falha ao enviar retomada para ${lead.phone}:`, err);
    }

    // AC4: ao atingir o limite de retomadas, transita para perdido.
    // Ocorre mesmo em caso de falha de envio: o counter ja foi incrementado e
    // o lead nao sera selecionado em ciclos futuros (follow_up_count < max deixa de ser verdadeiro).
    if (isLast) {
      setStatus(lead.id, "perdido");
      console.log(
        `[followup] Lead ${lead.phone} atingiu ${config.followupMax} retomadas → perdido.`
      );
    }
  }
}

export function startFollowUpEngine(): void {
  cron.schedule(config.followupCron, () => {
    runFollowUpCheck().catch((e) => console.error("[followup] erro no ciclo:", e));
  });
  console.log(
    `[followup] Motor ativo: ate ${config.followupMax} retomadas/lead (cron: ${config.followupCron}).`
  );
}

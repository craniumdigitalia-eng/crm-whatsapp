import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "../../lib/config";
import { supabase } from "../../lib/supabase";
import { addMessage, setFollowUpCount } from "../../lib/leads";
import { sendText } from "../../lib/whatsapp";
import { Lead, AUTO_STATUSES } from "../../lib/types";

// Rotacao de mensagens de retomada (ate FOLLOWUP_MAX por lead).
const ROTATION = [
  (n: string) => `${n ? `Oi ${n}!` : "Oi!"} So passando pra saber se ainda posso te ajudar com o que conversamos 😊`,
  (n: string) => `${n ? n + ", " : ""}voltando rapidinho aqui 👀 Se fizer sentido, consigo te mostrar como a gente ajuda. Quer seguir?`,
  (n: string) => `${n ? "Oi " + n + "! " : ""}Ficou alguma duvida do que falamos? Posso esclarecer por aqui.`,
  (n: string) => `${n ? n + ", " : ""}quando for um bom momento pra retomar, e so me chamar. Sigo a disposicao!`,
  (n: string) => `${n ? "Oi " + n + "! " : ""}Tenho uma ideia que pode encaixar no seu caso. Quer que eu te conte rapidinho?`,
];

function followUpText(stage: number, max: number, lead: Lead): string {
  const nome = lead.name ? lead.name.split(" ")[0] : "";
  if (stage >= max - 1) {
    return `${nome ? "Oi " + nome + "! " : ""}Vou parar de te chamar por aqui pra nao incomodar. Se quiser retomar a qualquer momento, e so mandar mensagem. Um abraco!`;
  }
  return ROTATION[stage % ROTATION.length](nome);
}

// Acionada pelo Vercel Cron (ver vercel.json). Envia as retomadas pendentes.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protege contra chamadas externas: o Vercel Cron envia Authorization: Bearer <CRON_SECRET>.
  const auth = req.headers["authorization"];
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ error: "nao autorizado" });
    return;
  }

  const cutoff = new Date(Date.now() - config.followupIntervalMs).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("status", AUTO_STATUSES)
    .eq("last_direction", "out")
    .lt("follow_up_count", config.followupMax)
    .lte("last_message_at", cutoff);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const leads = (data ?? []) as Lead[];
  let enviados = 0;

  for (const lead of leads) {
    try {
      const text = followUpText(lead.follow_up_count, config.followupMax, lead);
      await sendText(lead.phone, text);
      await addMessage(lead.id, "out", text); // atualiza last_message_at
      await setFollowUpCount(lead.id, lead.follow_up_count + 1);
      enviados++;
    } catch (err) {
      console.error(`[cron/followup] falha em ${lead.phone}:`, err);
    }
  }

  res.status(200).json({ ok: true, candidatos: leads.length, enviados });
}

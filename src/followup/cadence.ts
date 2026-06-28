import { supabase } from "../db";

// =====================================================================
// Cadencia de follow-up PADRAO configuravel (sem migration).
// Ciclo de vida completo do lead que NAO responde: 3 fases + encerramento
// automatico. Se o lead responde, sai da cadencia e a IA assume.
//
// FASE 1 — Semana 1 (dias 1-7): 1 toque/dia, horarios alternados (BRT).
// FASE 2 — Resto do mes 1 (dias 10..28, a cada 3 dias).
// FASE 3 — Meses 2-4 (dias 34..118, a cada 6 dias).
// ENCERRAMENTO — apos o ultimo toque (~dia 118) sem resposta, o motor marca
//   o lead como 'perdido' com uma nota de encerramento (sem mais mensagens).
//
// Modelo: lista ordenada de toques { dueDay, hourBRT, message }. `dueDay` e o
// dia (absoluto, contado da criacao do lead) a partir do qual o toque pode sair;
// `hourBRT` e a hora minima (horario de Brasilia). follow_up_count = indice do
// proximo toque. O motor (src/followup/scheduler.ts) so dispara o toque do lead
// se elapsedDays>=dueDay E horaBRT_atual>=hourBRT E ainda nao houve follow-up
// hoje (no maximo 1/dia). Timezone: servidor UTC, BRT = UTC-3.
//
// Mesmo padrao das outras configs (Agente IA / integracoes): os valores vivem
// na tabela integrations_config (key/value) e o usuario edita pela aba Follow-up.
// Complementa — NAO substitui — o follow-up AGENDADO por lead
// (src/crm/followup-schedule.ts) nem o motor ROTATION (fallback quando a
// cadencia esta desabilitada).
// =====================================================================

// Chaves na tabela integrations_config.
const CADENCE_KEY = "followup_cadence"; // JSON: CadenceStep[]
const CADENCE_ENABLED_KEY = "followup_cadence_enabled"; // 'true' | 'false'

const DAY_MS = 24 * 60 * 60 * 1000;
// Brasil (BRT) = UTC-3, sem horario de verao desde 2019. O servidor roda em
// UTC; usamos este offset fixo para comparar a hora/dia local de Brasilia.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Nota gravada no lead quando a cadencia se esgota sem resposta.
export const CLOSURE_NOTE = "Encerrado automaticamente após 4 meses de follow-up sem resposta.";

// Um toque da cadencia: a partir do dia `dueDay` (absoluto, contado da criacao
// do lead) e da hora `hourBRT`, envie `message` (com {nome} interpolado).
export interface CadenceStep {
  dueDay: number;
  hourBRT: number;
  message: string;
}

export interface Cadence {
  steps: CadenceStep[];
  enabled: boolean;
}

// Mensagens da Fase 1 (semana 1) — gancho/curiosidade, 1 por dia.
const PHASE1: CadenceStep[] = [
  {
    dueDay: 1,
    hourBRT: 8,
    message:
      "Bom dia {nome}! 👋 Rapidinho: a maioria dos corretores que converso depende quase 100% de indicação — e isso é imprevisível. Dá pra ter um fluxo constante de clientes. Quer que eu te mostre como?",
  },
  {
    dueDay: 2,
    hourBRT: 12,
    message:
      "{nome}, um dado que assusta: 7 de cada 10 leads não são respondidos a tempo e esfriam. A gente resolve isso no automático. Posso te explicar?",
  },
  {
    dueDay: 3,
    hourBRT: 19,
    message:
      "Oi {nome}! Indicação e lista fria têm teto. Tráfego bem feito + processo de vendas, não. Topa uma call de 15 min pra eu te mostrar?",
  },
  {
    dueDay: 4,
    hourBRT: 21,
    message:
      "{nome}, imagina saber todo mês de onde vêm seus próximos clientes 📈 É exatamente isso que a gente monta. Bora conversar?",
  },
  {
    dueDay: 5,
    hourBRT: 8,
    message:
      "Bom dia {nome}! Corretor que estrutura o processo vende mais com MENOS esforço. Te mostro o passo a passo numa call rápida?",
  },
  {
    dueDay: 6,
    hourBRT: 12,
    message:
      "{nome}, prometo não encher 🙏 só acho que isso pode mudar seu jogo de vendas. 15 min e você decide. Que tal hoje?",
  },
  {
    dueDay: 7,
    hourBRT: 19,
    message:
      "Oi {nome}! Já é seu 7º dia comigo por aqui 😊 Se quiser, eu te mostro em 15 min como sair da dependência de indicação. Bora?",
  },
];

// Set rotacionado da Fase 2 (dias 10-28, a cada 3 dias).
const PHASE2_MESSAGES = [
  "Oi {nome}! Lembrei de você 😊 Tenho um case de corretor que saiu do zero pra um fluxo previsível de clientes. Quer que eu te conte rapidinho?",
  "{nome}, como anda a captação de clientes esse mês? Posso te dar uma ideia rápida que costuma destravar.",
  "Oi {nome}! Corretor que responde lead em minutos fecha MUITO mais — a gente automatiza isso. Quer ver como?",
  "{nome}, sigo por aqui caso queira parar de depender de indicação. É só me chamar 👊",
];

// Set rotacionado da Fase 3 (dias 34-118, a cada 6 dias).
const PHASE3_MESSAGES = [
  "Oi {nome}! Mês novo, meta nova 📈 Bora estruturar sua máquina de leads de uma vez?",
  "{nome}, uma dica: tráfego sem processo de vendas não converte. A gente entrega os dois. Topa uma call de 15 min?",
  "Oi {nome}! Se agora não é o momento, tudo bem 🙏 quando quiser crescer com previsibilidade, me chama.",
  "{nome}, ainda dá tempo de virar a chave esse ano. Quer que eu te mostre o caminho?",
];

// Horarios padrao alternados (BRT), rotacionados pelos toques de cada fase.
const PHASE2_HOURS = [9, 14, 19];
const PHASE3_HOURS = [10, 15, 20];

// Monta a cadencia padrao completa (3 fases). Os toques das fases 2/3 sao
// gerados em laco (dueDay crescente, hora e mensagem rotacionando).
function buildDefaultCadence(): CadenceStep[] {
  const steps: CadenceStep[] = [...PHASE1];

  // Fase 2 — dias 10, 13, 16, 19, 22, 25, 28 (horas 9/14/19).
  let r = 0;
  for (let day = 10; day <= 28; day += 3) {
    steps.push({
      dueDay: day,
      hourBRT: PHASE2_HOURS[r % PHASE2_HOURS.length],
      message: PHASE2_MESSAGES[r % PHASE2_MESSAGES.length],
    });
    r++;
  }

  // Fase 3 — dias 34, 40, 46, ... ate 118 (a cada 6 dias; horas 10/15/20).
  r = 0;
  for (let day = 34; day <= 118; day += 6) {
    steps.push({
      dueDay: day,
      hourBRT: PHASE3_HOURS[r % PHASE3_HOURS.length],
      message: PHASE3_MESSAGES[r % PHASE3_MESSAGES.length],
    });
    r++;
  }

  return steps;
}

export const DEFAULT_CADENCE: CadenceStep[] = buildDefaultCadence();

export const CADENCE_ENABLED_DEFAULT = true;

// =====================================================================
// Helpers de fuso (BRT) — puros, testaveis sem banco.
// =====================================================================

// Hora do dia (0..23) em Brasilia para o instante `now`.
export function brtHour(now: Date): number {
  return new Date(now.getTime() - BRT_OFFSET_MS).getUTCHours();
}

// Instante (epoch ms, em UTC) da meia-noite de HOJE em Brasilia para `now`.
export function brtDayStartMs(now: Date): number {
  const shifted = new Date(now.getTime() - BRT_OFFSET_MS);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return midnight + BRT_OFFSET_MS;
}

// Dias (de calendario BRT) decorridos entre a criacao do lead e `now`.
// Anchor estavel da cadencia: dia 0 = dia da criacao; dia 1 = dia seguinte.
export function elapsedBrtDays(createdAtIso: string, now: Date): number {
  const created = new Date(createdAtIso);
  if (isNaN(created.getTime())) return 0;
  return Math.round((brtDayStartMs(now) - brtDayStartMs(created)) / DAY_MS);
}

// =====================================================================
// Helpers de passo — puros, testaveis sem banco.
// =====================================================================

// Normaliza um valor cru (vindo do JSON salvo) em CadenceStep[].
// Descarta passos invalidos (dueDay/hourBRT fora de faixa ou message vazia).
// Retorna null se o resultado nao for utilizavel (cai no DEFAULT).
export function parseCadenceSteps(raw: unknown): CadenceStep[] | null {
  if (!Array.isArray(raw)) return null;
  const steps: CadenceStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const dueDay = Number((item as { dueDay?: unknown }).dueDay);
    const hourBRT = Number((item as { hourBRT?: unknown }).hourBRT);
    const message = (item as { message?: unknown }).message;
    if (!Number.isInteger(dueDay) || dueDay < 1) continue;
    if (!Number.isInteger(hourBRT) || hourBRT < 0 || hourBRT > 23) continue;
    if (typeof message !== "string" || !message.trim()) continue;
    steps.push({ dueDay, hourBRT, message: message.trim() });
  }
  if (steps.length === 0) return null;
  // Defensivo [K3]: ordena por dueDay ascendente (o motor assume essa ordem ao
  // escolher o toque "do dia"). Estavel — empates preservam a ordem de entrada.
  steps.sort((a, b) => a.dueDay - b.dueDay);
  return steps;
}

// Passo de indice `count` (= follow_up_count, 0-based), ou null se ja acabou.
export function stepAt(steps: CadenceStep[], count: number): CadenceStep | null {
  return steps[count] ?? null;
}

// Mensagem do passo `count`, com {nome} interpolado pelo primeiro nome do lead.
// null = passo fora da cadencia. Sem nome, remove a lacuna sem deixar "Oi !".
export function cadenceMessage(steps: CadenceStep[], count: number, name: string | null): string | null {
  const step = steps[count];
  if (!step) return null;
  const nome = name ? name.split(" ")[0] : "";
  return step.message
    .replace(/\{nome\}/g, nome)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([!?.,])/g, "$1")
    .trim();
}

// =====================================================================
// Leitura / escrita (integrations_config).
// =====================================================================

// Le a cadencia efetiva. Tolerante: se a tabela nao existe ou o JSON esta
// corrompido, cai no DEFAULT sem quebrar o motor de follow-up.
export async function getCadence(): Promise<Cadence> {
  const stored = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from("integrations_config")
      .select("key, value")
      .in("key", [CADENCE_KEY, CADENCE_ENABLED_KEY]);
    if (error) {
      console.warn(`[followup/cadence] getCadence: ${error.message}`);
    } else {
      for (const row of (data ?? []) as { key: string; value: string | null }[]) {
        if (row.value && row.value.trim()) stored.set(row.key, row.value.trim());
      }
    }
  } catch (e) {
    console.warn(`[followup/cadence] getCadence:`, e);
  }

  let steps = DEFAULT_CADENCE;
  const rawSteps = stored.get(CADENCE_KEY);
  if (rawSteps) {
    try {
      const parsed = parseCadenceSteps(JSON.parse(rawSteps));
      if (parsed) steps = parsed;
    } catch (e) {
      console.warn(`[followup/cadence] getCadence: JSON invalido, usando default:`, e);
    }
  }

  const enabledRaw = stored.get(CADENCE_ENABLED_KEY);
  const enabled = enabledRaw === undefined ? CADENCE_ENABLED_DEFAULT : enabledRaw === "true";

  return { steps, enabled };
}

// Grava (upsert) a cadencia. Valida os passos antes de salvar; lanca se a
// lista ficar vazia depois da normalizacao (evita salvar uma cadencia quebrada).
export async function setCadence(steps: CadenceStep[], enabled: boolean): Promise<void> {
  const valid = parseCadenceSteps(steps);
  if (!valid) {
    throw new Error("cadencia invalida: cada toque precisa de dia (>=1), hora (0-23) e mensagem");
  }

  const rows = [
    { key: CADENCE_KEY, value: JSON.stringify(valid) },
    { key: CADENCE_ENABLED_KEY, value: enabled ? "true" : "false" },
  ];
  const { error } = await supabase
    .from("integrations_config")
    .upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

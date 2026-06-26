import { supabase } from "../db";
import { LeadStatus, STATUS_LABELS } from "../types";

// =====================================================================
// Métricas & BI (Story 5.6)
// Agregações server-side para o dashboard de indicadores de uma operação
// de leads via WhatsApp com qualificação por IA.
//
// Princípios:
//   • Honestidade: banco vazio -> 0 / null (o UI mostra "—" / estado vazio).
//     NUNCA inventa números.
//   • Eficiência: contagens grandes via COUNT head (sem trazer linhas);
//     cálculos por-linha (budget, ciclo, 1ª resposta, séries) trazem apenas
//     as colunas necessárias dos leads do período, paginando.
//   • Coortes: as TAXAS são calculadas sobre os leads CRIADOS no período
//     (created_at). "Total de leads" é o acumulado de todo o histórico.
//
// Proxies documentados (o schema não guarda histórico de mudança de status):
//   • Ciclo médio: usa updated_at dos leads em 'fechado' como instante de
//     fechamento (a última atualização do lead fechado ≈ quando fechou).
//   • % atendido pela IA: fração de leads do período que NÃO foram para
//     'humano' (transferência) — proxy de atendimento automático.
//   • Perdas por estágio de origem: não rastreável sem histórico — expomos
//     apenas o total de perdidos no período.
// =====================================================================

export type BiPeriod = "7d" | "30d" | "90d" | "all";

const PERIODS: BiPeriod[] = ["7d", "30d", "90d", "all"];

export function parsePeriod(raw: string | null | undefined): BiPeriod {
  const p = (raw ?? "").toLowerCase();
  return (PERIODS as string[]).includes(p) ? (p as BiPeriod) : "30d";
}

// Ordem do funil "feliz" (caminho de conversão). 'perdido'/'humano' ficam fora
// da régua — não dá para posicioná-los em um estágio.
export const FUNNEL_STAGES: LeadStatus[] = [
  "novo",
  "em_atendimento",
  "qualificado",
  "proposta",
  "fechado",
];

const STAGE_RANK: Record<string, number> = Object.fromEntries(
  FUNNEL_STAGES.map((s, i) => [s, i])
);

const DAY_MS = 86_400_000;

// Início do período (ISO) ou null para "tudo".
export function sinceForPeriod(period: BiPeriod, now: number = Date.now()): string | null {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  if (days === null) return null;
  return new Date(now - days * DAY_MS).toISOString();
}

// ---------------------------------------------------------------------
// Parser de orçamento (budget é texto livre: "R$ 2.400", "2400", "1.5k").
// Tolerante ao formato brasileiro: '.' separador de milhar, ',' decimal.
// Retorna número em reais ou null se não der para extrair um valor.
// ---------------------------------------------------------------------
export function parseBudgetBRL(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // sufixo "k" / "mil" -> milhares
  let multiplier = 1;
  if (/\bk\b|\d\s*k\b|mil\b/.test(s)) multiplier = 1000;

  // mantém só dígitos, vírgula e ponto
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let normalized: string;
  if (hasComma && hasDot) {
    // formato BR "1.234,56" -> ponto é milhar, vírgula é decimal
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // só vírgula -> decimal
    normalized = s.replace(",", ".");
  } else if (hasDot) {
    // só ponto: se parece milhar ("2.400", "1.234.567") remove; senão é decimal
    const parts = s.split(".");
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    normalized = looksLikeThousands ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }

  const value = parseFloat(normalized);
  if (!isFinite(value)) return null;
  const result = value * multiplier;
  return result > 0 ? result : null;
}

// ---------------------------------------------------------------------
// Funil: a partir das contagens por status (snapshot atual), calcula
//   • reached: leads que chegaram NAQUELE estágio ou além (cumulativo) —
//     dá a forma clássica de funil (monotônico decrescente).
//   • current: leads atualmente parados naquele estágio.
//   • conversions: reached[i+1] / reached[i] entre estágios consecutivos.
// ---------------------------------------------------------------------
export interface FunnelStage {
  status: LeadStatus;
  label: string;
  reached: number;
  current: number;
}
export interface FunnelConversion {
  from: LeadStatus;
  to: LeadStatus;
  fromLabel: string;
  toLabel: string;
  rate: number | null; // 0..1 ou null se a base for 0
}

export function buildFunnel(statusCounts: Record<LeadStatus, number>): {
  stages: FunnelStage[];
  conversions: FunnelConversion[];
} {
  const reachedFor = (rank: number) =>
    FUNNEL_STAGES.reduce(
      (sum, s) => (STAGE_RANK[s] >= rank ? sum + (statusCounts[s] ?? 0) : sum),
      0
    );

  const stages: FunnelStage[] = FUNNEL_STAGES.map((status, i) => ({
    status,
    label: STATUS_LABELS[status],
    reached: reachedFor(i),
    current: statusCounts[status] ?? 0,
  }));

  const conversions: FunnelConversion[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    conversions.push({
      from: from.status,
      to: to.status,
      fromLabel: from.label,
      toLabel: to.label,
      rate: from.reached > 0 ? to.reached / from.reached : null,
    });
  }
  return { stages, conversions };
}

// ---------------------------------------------------------------------
// Série temporal: distribui datas (ISO) em buckets por dia, preenchendo
// todos os dias do intervalo com 0. `from`/`to` em ms (UTC day boundaries).
// ---------------------------------------------------------------------
export interface DayPoint {
  date: string; // YYYY-MM-DD
  count: number;
}
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
export function bucketByDay(isoDates: string[], fromMs: number, toMs: number): DayPoint[] {
  const counts = new Map<string, number>();
  for (const iso of isoDates) {
    const k = iso.slice(0, 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: DayPoint[] = [];
  // normaliza para o início do dia UTC
  let cursor = Date.UTC(
    new Date(fromMs).getUTCFullYear(),
    new Date(fromMs).getUTCMonth(),
    new Date(fromMs).getUTCDate()
  );
  const end = Date.UTC(
    new Date(toMs).getUTCFullYear(),
    new Date(toMs).getUTCMonth(),
    new Date(toMs).getUTCDate()
  );
  // guarda contra intervalos absurdos (no máximo ~2 anos de buckets diários)
  let guard = 0;
  while (cursor <= end && guard < 800) {
    const k = dayKey(cursor);
    out.push({ date: k, count: counts.get(k) ?? 0 });
    cursor += DAY_MS;
    guard++;
  }
  return out;
}

// ---------------------------------------------------------------------
// Tempo de 1ª resposta: por lead, minutos entre a 1ª mensagem 'in' e a 1ª
// 'out' que vem DEPOIS dela. Média sobre os leads que têm ambas.
// `byLead` = mensagens já agrupadas por lead (ordem qualquer).
// ---------------------------------------------------------------------
export interface MsgLite {
  direction: "in" | "out";
  created_at: string;
}
export function avgFirstResponseMinutes(byLead: Map<string, MsgLite[]>): number | null {
  const diffs: number[] = [];
  for (const msgs of byLead.values()) {
    let firstInMs = Infinity;
    for (const m of msgs) {
      if (m.direction === "in") {
        const t = Date.parse(m.created_at);
        if (t < firstInMs) firstInMs = t;
      }
    }
    if (!isFinite(firstInMs)) continue;
    let firstOutMs = Infinity;
    for (const m of msgs) {
      if (m.direction === "out") {
        const t = Date.parse(m.created_at);
        if (t >= firstInMs && t < firstOutMs) firstOutMs = t;
      }
    }
    if (isFinite(firstOutMs)) diffs.push((firstOutMs - firstInMs) / 60_000);
  }
  if (diffs.length === 0) return null;
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

// Origem -> rótulo legível.
export function sourceLabel(source: string | null | undefined): string {
  const s = (source ?? "").toLowerCase();
  if (!s) return "Sem origem";
  if (s.includes("meta") || s.includes("facebook") || s.includes("lead_ads")) return "Meta Lead Ads";
  if (s.includes("whats")) return "WhatsApp direto";
  if (s.includes("insta")) return "Instagram";
  return source as string;
}

// =====================================================================
// Tipos do payload retornado ao front-end.
// =====================================================================
export interface BiCards {
  totalLeads: number;
  newLeads: number;
  qualificationRate: number | null;
  winRate: number | null;
  avgCycleDays: number | null;
  avgFirstResponseMin: number | null;
  aiHandledRate: number | null;
  pipelineValue: number | null;
  pipelineCount: number;
}
export interface SourcePoint {
  source: string;
  label: string;
  count: number;
}
export interface BiActivity {
  messagesIn: number;
  messagesOut: number;
  followupsScheduled: number;
  followupsSent: number;
  humanTransfers: number;
}
export interface BiMetrics {
  period: BiPeriod;
  since: string | null;
  generatedAt: string;
  hasData: boolean;
  cards: BiCards;
  statusCounts: Record<LeadStatus, number>;
  funnel: { stages: FunnelStage[]; conversions: FunnelConversion[] };
  leadsOverTime: DayPoint[];
  bySource: SourcePoint[];
  losses: { total: number };
  activity: BiActivity;
}

// ---------------------------------------------------------------------
// Helpers de query.
// ---------------------------------------------------------------------
type Filter<T> = (q: T) => T;

async function countRows(
  table: string,
  apply?: Filter<ReturnType<typeof buildCountQuery>>
): Promise<number> {
  let q = buildCountQuery(table);
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
function buildCountQuery(table: string) {
  return supabase.from(table).select("*", { count: "exact", head: true });
}

interface LeadRow {
  status: LeadStatus;
  budget: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

// Busca paginada de todas as linhas que casam o filtro (cols enxutas).
async function fetchAllLeads(since: string | null): Promise<LeadRow[]> {
  const PAGE = 1000;
  const cols = "status,budget,source,created_at,updated_at";
  const out: LeadRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("leads").select(cols).order("created_at", { ascending: true });
    if (since) q = q.gte("created_at", since);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as LeadRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// Mensagens do período agrupadas por lead (para o tempo de 1ª resposta) e
// contagens in/out. Paginada por created_at.
async function fetchMessages(
  since: string | null
): Promise<{ byLead: Map<string, MsgLite[]>; inCount: number; outCount: number }> {
  const PAGE = 1000;
  const byLead = new Map<string, MsgLite[]>();
  let inCount = 0;
  let outCount = 0;
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("messages")
      .select("lead_id,direction,created_at")
      .order("created_at", { ascending: true });
    if (since) q = q.gte("created_at", since);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as { lead_id: string; direction: "in" | "out"; created_at: string }[];
    for (const r of rows) {
      if (r.direction === "in") inCount++;
      else outCount++;
      const arr = byLead.get(r.lead_id);
      const m: MsgLite = { direction: r.direction, created_at: r.created_at };
      if (arr) arr.push(m);
      else byLead.set(r.lead_id, [m]);
    }
    if (rows.length < PAGE) break;
  }
  return { byLead, inCount, outCount };
}

const EMPTY_STATUS_COUNTS = (): Record<LeadStatus, number> => ({
  novo: 0,
  em_atendimento: 0,
  qualificado: 0,
  proposta: 0,
  fechado: 0,
  perdido: 0,
  humano: 0,
});

// =====================================================================
// Orquestrador principal.
// =====================================================================
export async function computeMetrics(period: BiPeriod): Promise<BiMetrics> {
  const now = Date.now();
  const since = sinceForPeriod(period, now);

  // Linhas dos leads do período (coorte de taxas) — colunas enxutas, paginado.
  const [periodLeads, totalLeads, messages, followupsScheduled, followupsSent] = await Promise.all([
    fetchAllLeads(since),
    countRows("leads"),
    fetchMessages(since),
    countRows("follow_up_schedule", since ? (q) => q.gte("created_at", since) : undefined),
    countRows("follow_up_schedule", (q) => {
      let r = q.eq("status", "enviado");
      if (since) r = r.gte("sent_at", since);
      return r;
    }),
  ]);

  // Contagens por status sobre a coorte do período.
  const statusCounts = EMPTY_STATUS_COUNTS();
  for (const l of periodLeads) {
    if (l.status in statusCounts) statusCounts[l.status] += 1;
  }

  const periodTotal = periodLeads.length;
  const qualifiedPlus = periodLeads.filter((l) => (STAGE_RANK[l.status] ?? -1) >= STAGE_RANK.qualificado).length;
  const closed = statusCounts.fechado;

  // Pipeline: soma dos budgets parseáveis dos leads em 'proposta'.
  const propostaLeads = periodLeads.filter((l) => l.status === "proposta");
  const parsedBudgets = propostaLeads
    .map((l) => parseBudgetBRL(l.budget))
    .filter((v): v is number => v !== null);
  const pipelineValue = parsedBudgets.length > 0 ? parsedBudgets.reduce((a, b) => a + b, 0) : null;

  // Ciclo médio (proxy updated_at) sobre os leads fechados do período.
  const cycleDays = periodLeads
    .filter((l) => l.status === "fechado")
    .map((l) => (Date.parse(l.updated_at) - Date.parse(l.created_at)) / DAY_MS)
    .filter((d) => isFinite(d) && d >= 0);
  const avgCycleDays =
    cycleDays.length > 0 ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : null;

  // 1ª resposta: só considera leads da coorte do período.
  const periodMsgs = messages.byLead; // já filtrado por created_at do período
  const avgFirstResponseMin = avgFirstResponseMinutes(periodMsgs);

  // Série temporal de novos leads por dia.
  const fromMs = since ? Date.parse(since) : periodLeads.length > 0 ? Date.parse(periodLeads[0].created_at) : now;
  const leadsOverTime = bucketByDay(
    periodLeads.map((l) => l.created_at),
    fromMs,
    now
  );

  // Por origem.
  const bySourceMap = new Map<string, SourcePoint>();
  for (const l of periodLeads) {
    const label = sourceLabel(l.source);
    const key = l.source ?? "";
    const cur = bySourceMap.get(label);
    if (cur) cur.count += 1;
    else bySourceMap.set(label, { source: key, label, count: 1 });
  }
  const bySource = [...bySourceMap.values()].sort((a, b) => b.count - a.count);

  const cards: BiCards = {
    totalLeads,
    newLeads: periodTotal,
    qualificationRate: periodTotal > 0 ? qualifiedPlus / periodTotal : null,
    winRate: periodTotal > 0 ? closed / periodTotal : null,
    avgCycleDays,
    avgFirstResponseMin,
    aiHandledRate: periodTotal > 0 ? (periodTotal - statusCounts.humano) / periodTotal : null,
    pipelineValue,
    pipelineCount: propostaLeads.length,
  };

  return {
    period,
    since,
    generatedAt: new Date(now).toISOString(),
    hasData: totalLeads > 0,
    cards,
    statusCounts,
    funnel: buildFunnel(statusCounts),
    leadsOverTime,
    bySource,
    losses: { total: statusCounts.perdido },
    activity: {
      messagesIn: messages.inCount,
      messagesOut: messages.outCount,
      followupsScheduled,
      followupsSent,
      humanTransfers: statusCounts.humano,
    },
  };
}

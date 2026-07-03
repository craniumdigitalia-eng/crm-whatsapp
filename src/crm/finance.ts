import { supabase } from "../db";

// =====================================================================
// Metas de crescimento (aba Metas). Salvas em integrations_config.
//   newPerMonth  — novos clientes previstos por mês
//   churnPerMonth— clientes que saem por mês
//   newTicket    — ticket (mensalidade) esperado de cada novo cliente
//   targetMonth  — até quando projetar (YYYY-MM)
// =====================================================================
export interface FinanceGoals {
  newPerMonth: number;
  churnPerMonth: number;
  newTicket: number;
  targetMonth: string; // "YYYY-MM"
}

const GOALS_KEY = "finance_goals";
const GOALS_DEFAULT: FinanceGoals = {
  newPerMonth: 8,
  churnPerMonth: 4,
  newTicket: 1297,
  targetMonth: "2026-12",
};

export async function getGoals(): Promise<FinanceGoals> {
  try {
    const { data, error } = await supabase
      .from("integrations_config")
      .select("value")
      .eq("key", GOALS_KEY)
      .maybeSingle();
    if (error || !data?.value) return { ...GOALS_DEFAULT };
    const p = JSON.parse((data as { value: string }).value) as Partial<FinanceGoals>;
    return {
      newPerMonth: Number.isFinite(p.newPerMonth) ? Number(p.newPerMonth) : GOALS_DEFAULT.newPerMonth,
      churnPerMonth: Number.isFinite(p.churnPerMonth) ? Number(p.churnPerMonth) : GOALS_DEFAULT.churnPerMonth,
      newTicket: Number.isFinite(p.newTicket) ? Number(p.newTicket) : GOALS_DEFAULT.newTicket,
      targetMonth: typeof p.targetMonth === "string" ? p.targetMonth : GOALS_DEFAULT.targetMonth,
    };
  } catch (e) {
    console.warn("[finance] getGoals:", e);
    return { ...GOALS_DEFAULT };
  }
}

export async function setGoals(g: FinanceGoals): Promise<void> {
  const { error } = await supabase
    .from("integrations_config")
    .upsert({ key: GOALS_KEY, value: JSON.stringify(g) }, { onConflict: "key" });
  if (error) throw error;
}

// =====================================================================
// Módulo Financeiro da Cranium (gestão do próprio negócio, não dos leads).
// Clientes pagantes (MRR), receitas avulsas e despesas (fixas/variáveis).
// Base do painel de fluxo de caixa + DRE por período.
//
// Tudo TOLERANTE: se as tabelas fin_* ainda não existem (migration 011
// não aplicada), as leituras voltam vazias e o painel mostra estado vazio,
// sem derrubar o portal. Acesso só server-side via service_role.
// =====================================================================

export type ClientStatus = "ativo" | "atrasado" | "cancelado";

export interface FinClient {
  id: string;
  name: string;
  monthly_value: number;
  billing_day: number | null;
  status: ClientStatus;
  started_at: string; // YYYY-MM-DD
  canceled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinRevenue {
  id: string;
  client_id: string | null;
  description: string;
  amount: number;
  received_on: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | "infra"
  | "ferramentas"
  | "salarios"
  | "impostos"
  | "marketing"
  | "outros";

export interface FinExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  recurring: boolean;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "infra", label: "Infraestrutura" },
  { value: "ferramentas", label: "Ferramentas / SaaS" },
  { value: "salarios", label: "Salários / Pró-labore" },
  { value: "impostos", label: "Impostos" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" },
];

export type Period = "mes" | "trimestre" | "semestre" | "ano";

// --------------------------------------------------------------------
// Helpers de data (YYYY-MM-DD, sem fuso — datas de negócio).
// --------------------------------------------------------------------
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthStart(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1));
}
function monthEnd(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0));
}

// Janela [start, end] do período selecionado, relativa a hoje.
export function periodWindow(period: Period, now = new Date()): { start: string; end: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0..11
  if (period === "mes") {
    return { start: toISODate(monthStart(y, m)), end: toISODate(monthEnd(y, m)) };
  }
  if (period === "trimestre") {
    const q0 = Math.floor(m / 3) * 3;
    return { start: toISODate(monthStart(y, q0)), end: toISODate(monthEnd(y, q0 + 2)) };
  }
  if (period === "semestre") {
    const s0 = m < 6 ? 0 : 6;
    return { start: toISODate(monthStart(y, s0)), end: toISODate(monthEnd(y, s0 + 5)) };
  }
  // ano
  return { start: toISODate(monthStart(y, 0)), end: toISODate(monthEnd(y, 11)) };
}

// Lista de "âncoras" (primeiro dia de cada mês) dentro da janela.
function monthsInWindow(startISO: string, endISO: string): { y: number; m: number }[] {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  const out: { y: number; m: number }[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
    out.push({ y, m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

// Um item (cliente/despesa) está ativo no mês (y,m) se começou até o fim do mês
// e não terminou antes do início do mês.
function activeInMonth(startDate: string, endDate: string | null, y: number, m: number): boolean {
  const mStart = toISODate(monthStart(y, m));
  const mEnd = toISODate(monthEnd(y, m));
  if (startDate > mEnd) return false;
  if (endDate && endDate < mStart) return false;
  return true;
}

// --------------------------------------------------------------------
// Leituras (tolerantes).
// --------------------------------------------------------------------
export async function listClients(): Promise<FinClient[]> {
  try {
    const { data, error } = await supabase
      .from("fin_clients")
      .select("*")
      .order("status", { ascending: true })
      .order("name", { ascending: true });
    if (error) { console.warn("[finance] listClients:", error.message); return []; }
    return (data ?? []) as FinClient[];
  } catch (e) {
    console.warn("[finance] listClients:", e);
    return [];
  }
}

export async function listRevenue(): Promise<FinRevenue[]> {
  try {
    const { data, error } = await supabase
      .from("fin_revenue")
      .select("*")
      .order("received_on", { ascending: false });
    if (error) { console.warn("[finance] listRevenue:", error.message); return []; }
    return (data ?? []) as FinRevenue[];
  } catch (e) {
    console.warn("[finance] listRevenue:", e);
    return [];
  }
}

export async function listExpenses(): Promise<FinExpense[]> {
  try {
    const { data, error } = await supabase
      .from("fin_expenses")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) { console.warn("[finance] listExpenses:", error.message); return []; }
    return (data ?? []) as FinExpense[];
  } catch (e) {
    console.warn("[finance] listExpenses:", e);
    return [];
  }
}

// --------------------------------------------------------------------
// Escritas.
// --------------------------------------------------------------------
export async function createClient(input: Partial<FinClient>): Promise<FinClient> {
  const row = {
    name: (input.name ?? "").trim(),
    monthly_value: Number(input.monthly_value ?? 0),
    billing_day: input.billing_day ?? null,
    status: (input.status as ClientStatus) ?? "ativo",
    started_at: input.started_at || toISODate(new Date()),
    canceled_at: input.canceled_at ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from("fin_clients").insert(row).select().single();
  if (error) throw error;
  return data as FinClient;
}

export async function updateClient(id: string, patch: Partial<FinClient>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "monthly_value", "billing_day", "status", "started_at", "canceled_at", "notes"] as const) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  // Regra: ao virar 'cancelado' sem data, marca churn hoje; ao reativar, limpa.
  if (patch.status === "cancelado" && patch.canceled_at === undefined) {
    row.canceled_at = toISODate(new Date());
  }
  if (patch.status === "ativo" || patch.status === "atrasado") {
    if (patch.canceled_at === undefined) row.canceled_at = null;
  }
  const { error } = await supabase.from("fin_clients").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("fin_clients").delete().eq("id", id);
  if (error) throw error;
}

export async function createRevenue(input: Partial<FinRevenue>): Promise<FinRevenue> {
  const row = {
    client_id: input.client_id ?? null,
    description: (input.description ?? "").trim(),
    amount: Number(input.amount ?? 0),
    received_on: input.received_on || toISODate(new Date()),
  };
  const { data, error } = await supabase.from("fin_revenue").insert(row).select().single();
  if (error) throw error;
  return data as FinRevenue;
}

export async function deleteRevenue(id: string): Promise<void> {
  const { error } = await supabase.from("fin_revenue").delete().eq("id", id);
  if (error) throw error;
}

export async function createExpense(input: Partial<FinExpense>): Promise<FinExpense> {
  const row = {
    description: (input.description ?? "").trim(),
    category: (input.category as string) ?? "outros",
    amount: Number(input.amount ?? 0),
    recurring: input.recurring === true,
    start_date: input.start_date || toISODate(new Date()),
    end_date: input.end_date ?? null,
  };
  const { data, error } = await supabase.from("fin_expenses").insert(row).select().single();
  if (error) throw error;
  return data as FinExpense;
}

export async function updateExpense(id: string, patch: Partial<FinExpense>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["description", "category", "amount", "recurring", "start_date", "end_date"] as const) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  const { error } = await supabase.from("fin_expenses").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("fin_expenses").delete().eq("id", id);
  if (error) throw error;
}

// --------------------------------------------------------------------
// Resumo: KPIs (snapshot de hoje) + DRE do período.
// --------------------------------------------------------------------
export interface FinanceSummary {
  period: Period;
  window: { start: string; end: string };
  generatedAt: string;
  hasData: boolean;
  kpis: {
    mrr: number;
    arr: number;
    activeClients: number;
    scheduledMrr: number;      // MRR contratado de clientes que ainda vão começar
    scheduledClients: number;
    lateClients: number;
    lateValue: number;         // mensalidade contratada dos inadimplentes
    churnedClients: number;    // cancelados dentro do período
    churnedMrr: number;
    churnRate: number | null;  // churnedMrr / (mrr + churnedMrr)
    avgTicket: number | null;  // mrr / ativos
  };
  dre: {
    recurringRevenue: number;  // recorrência contratada no período
    oneOffRevenue: number;     // avulsos no período
    totalRevenue: number;
    expensesByCategory: { category: string; label: string; total: number }[];
    totalExpenses: number;
    result: number;            // receita - despesas
    margin: number | null;     // result / receita
  };
}

function catLabel(cat: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? "Outros";
}

export async function getFinanceSummary(period: Period): Promise<FinanceSummary> {
  const now = new Date();
  const win = periodWindow(period, now);
  const [clients, revenue, expenses] = await Promise.all([
    listClients(),
    listRevenue(),
    listExpenses(),
  ]);

  const hasData = clients.length > 0 || revenue.length > 0 || expenses.length > 0;
  const months = monthsInWindow(win.start, win.end);

  // ---- KPIs snapshot (mês atual) ----
  // MRR conta só quem já está ATIVO no mês corrente (início <= fim do mês).
  // Cliente ativo com início no futuro (ex.: "começa a pagar mês que vem") NÃO
  // entra no MRR de hoje — vira "a entrar" (scheduled).
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth();
  const isActiveNow = (c: FinClient) =>
    c.status === "ativo" && activeInMonth(c.started_at, c.canceled_at, nowY, nowM);
  const active = clients.filter(isActiveNow);
  const scheduled = clients.filter((c) => c.status === "ativo" && !isActiveNow(c));
  const late = clients.filter((c) => c.status === "atrasado");
  const mrr = active.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const scheduledMrr = scheduled.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const lateValue = late.reduce((s, c) => s + Number(c.monthly_value || 0), 0);

  // Churn no período: clientes cancelados com canceled_at dentro da janela.
  const churned = clients.filter(
    (c) => c.status === "cancelado" && c.canceled_at && c.canceled_at >= win.start && c.canceled_at <= win.end
  );
  const churnedMrr = churned.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const churnRate = mrr + churnedMrr > 0 ? churnedMrr / (mrr + churnedMrr) : null;

  // ---- DRE do período ----
  // Recorrência contratada: soma, mês a mês, a mensalidade dos clientes ativos
  // naquele mês (deriva de started_at/canceled_at; independe de lançamento manual).
  let recurringRevenue = 0;
  for (const { y, m } of months) {
    const mEnd = toISODate(monthEnd(y, m));
    for (const c of clients) {
      if (c.started_at > mEnd) continue;                 // ainda não começou nesse mês
      if (c.canceled_at && c.canceled_at <= mEnd) continue; // já saiu (churn) nesse mês ou antes
      recurringRevenue += Number(c.monthly_value || 0);
    }
  }

  // Avulsos no período (por data de recebimento).
  const oneOffRevenue = revenue
    .filter((r) => r.received_on >= win.start && r.received_on <= win.end)
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const totalRevenue = recurringRevenue + oneOffRevenue;

  // Despesas: recorrentes contam por mês ativo; avulsas contam se start_date na janela.
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    let total = 0;
    if (e.recurring) {
      for (const { y, m } of months) {
        if (activeInMonth(e.start_date, e.end_date, y, m)) total += Number(e.amount || 0);
      }
    } else if (e.start_date >= win.start && e.start_date <= win.end) {
      total += Number(e.amount || 0);
    }
    if (total > 0) byCat.set(e.category, (byCat.get(e.category) || 0) + total);
  }
  const expensesByCategory = Array.from(byCat.entries())
    .map(([category, total]) => ({ category, label: catLabel(category), total }))
    .sort((a, b) => b.total - a.total);
  const totalExpenses = expensesByCategory.reduce((s, c) => s + c.total, 0);

  const result = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? result / totalRevenue : null;

  return {
    period,
    window: win,
    generatedAt: now.toISOString(),
    hasData,
    kpis: {
      mrr,
      arr: mrr * 12,
      activeClients: active.length,
      scheduledMrr,
      scheduledClients: scheduled.length,
      lateClients: late.length,
      lateValue,
      churnedClients: churned.length,
      churnedMrr,
      churnRate,
      avgTicket: active.length > 0 ? mrr / active.length : null,
    },
    dre: {
      recurringRevenue,
      oneOffRevenue,
      totalRevenue,
      expensesByCategory,
      totalExpenses,
      result,
      margin,
    },
  };
}

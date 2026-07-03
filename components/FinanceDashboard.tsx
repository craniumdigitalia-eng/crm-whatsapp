'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Financeiro — gestão do próprio negócio da Cranium.
   Fluxo de caixa: MRR, clientes ativos/atrasados/churn, despesas
   (fixas/variáveis) e DRE por período (mês/trimestre/semestre/ano).
   Entrada manual. Identidade Cranium (classes .fin-*). PT-BR.
   ============================================================ */

type Period = 'mes' | 'trimestre' | 'semestre' | 'ano';
type ClientStatus = 'ativo' | 'atrasado' | 'cancelado';

interface FinClient {
  id: string;
  name: string;
  monthly_value: number;
  billing_day: number | null;
  status: ClientStatus;
  started_at: string;
  canceled_at: string | null;
  notes: string | null;
}
interface FinRevenue {
  id: string;
  client_id: string | null;
  description: string;
  amount: number;
  received_on: string;
}
interface FinExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  recurring: boolean;
  start_date: string;
  end_date: string | null;
}
interface Summary {
  period: Period;
  window: { start: string; end: string };
  hasData: boolean;
  kpis: {
    mrr: number;
    arr: number;
    activeClients: number;
    lateClients: number;
    lateValue: number;
    churnedClients: number;
    churnedMrr: number;
    churnRate: number | null;
    avgTicket: number | null;
  };
  dre: {
    recurringRevenue: number;
    oneOffRevenue: number;
    totalRevenue: number;
    expensesByCategory: { category: string; label: string; total: number }[];
    totalExpenses: number;
    result: number;
    margin: number | null;
  };
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'ano', label: 'Ano' },
];

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'infra', label: 'Infraestrutura' },
  { value: 'ferramentas', label: 'Ferramentas / SaaS' },
  { value: 'salarios', label: 'Salários / Pró-labore' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outros', label: 'Outros' },
];
const STATUS_LABELS: Record<ClientStatus, string> = {
  ativo: 'Ativo',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

const brl = (v: number | null | undefined): string =>
  v == null
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null | undefined): string =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dateBR = (iso: string | null): string =>
  !iso ? '—' : new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}
async function apiSend(url: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<Period>('mes');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clients, setClients] = useState<FinClient[]>([]);
  const [revenue, setRevenue] = useState<FinRevenue[]>([]);
  const [expenses, setExpenses] = useState<FinExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, r, e] = await Promise.all([
        apiGet<Summary>(`/api/finance/summary?period=${p}`),
        apiGet<{ clients: FinClient[] }>('/api/finance/clients'),
        apiGet<{ revenue: FinRevenue[] }>('/api/finance/revenue'),
        apiGet<{ expenses: FinExpense[] }>('/api/finance/expenses'),
      ]);
      setSummary(s);
      setClients(c.clients ?? []);
      setRevenue(r.revenue ?? []);
      setExpenses(e.expenses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => loadAll(period), [loadAll, period]);
  useEffect(() => { void loadAll(period); }, [period, loadAll]);

  const k = summary?.kpis;
  const dre = summary?.dre;

  return (
    <section className="fin" aria-busy={loading}>
      <header className="bi-head">
        <div>
          <h1 className="bi-title">Financeiro</h1>
          <p className="bi-subtitle">Fluxo de caixa, MRR e DRE da Cranium Digital</p>
        </div>
        <div className="bi-period" role="group" aria-label="Período">
          {PERIODS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`bi-period-btn${period === opt.value ? ' is-active' : ''}`}
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="bi-error" role="alert">
          Não foi possível carregar: {error}
          <button type="button" className="bi-retry" onClick={reload}>Tentar de novo</button>
        </div>
      )}
      {loading && !summary && <div className="bi-loading">Carregando financeiro…</div>}

      {summary && (
        <>
          {!summary.hasData && (
            <div className="bi-empty-banner" role="status">
              <strong>Comece cadastrando seus clientes e despesas abaixo.</strong> O MRR, o churn e o
              DRE são calculados automaticamente a partir do que você lançar. Nada é simulado.
            </div>
          )}

          {/* KPIs */}
          <div className="bi-cards">
            <Kpi label="MRR (receita recorrente)" value={brl(k!.mrr)} hint={`ARR ${brl(k!.arr)}`} />
            <Kpi label="Clientes ativos" value={String(k!.activeClients)} hint={k!.avgTicket != null ? `Ticket médio ${brl(k!.avgTicket)}` : undefined} />
            <Kpi label="Inadimplência" value={String(k!.lateClients)} hint={`${brl(k!.lateValue)} em atraso`} tone={k!.lateClients > 0 ? 'warn' : undefined} />
            <Kpi label="Churn no período" value={String(k!.churnedClients)} hint={`${brl(k!.churnedMrr)} · ${pct(k!.churnRate)}`} tone={k!.churnedClients > 0 ? 'bad' : undefined} />
          </div>

          {/* DRE */}
          <section className="bi-panel fin-dre" aria-labelledby="fin-dre-h">
            <h2 className="bi-panel-title" id="fin-dre-h">DRE do período</h2>
            <table className="fin-dre-table">
              <tbody>
                <tr><th scope="row">Receita recorrente</th><td>{brl(dre!.recurringRevenue)}</td></tr>
                <tr><th scope="row">Receita avulsa</th><td>{brl(dre!.oneOffRevenue)}</td></tr>
                <tr className="fin-dre-sub"><th scope="row">Receita total</th><td>{brl(dre!.totalRevenue)}</td></tr>
                {dre!.expensesByCategory.map((c) => (
                  <tr key={c.category} className="fin-dre-exp">
                    <th scope="row">− {c.label}</th><td>{brl(c.total)}</td>
                  </tr>
                ))}
                <tr className="fin-dre-sub"><th scope="row">Despesa total</th><td>−{brl(dre!.totalExpenses)}</td></tr>
                <tr className={`fin-dre-result ${dre!.result >= 0 ? 'is-pos' : 'is-neg'}`}>
                  <th scope="row">Resultado</th>
                  <td>{brl(dre!.result)} <span className="fin-dre-margin">({pct(dre!.margin)})</span></td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Clientes */}
          <ClientsSection clients={clients} onChange={reload} />

          {/* Despesas */}
          <ExpensesSection expenses={expenses} onChange={reload} />

          {/* Receitas avulsas */}
          <RevenueSection revenue={revenue} clients={clients} onChange={reload} />

          <p className="bi-footnote">
            Receita recorrente do DRE é derivada dos clientes ativos (contratada) em cada mês do período.
            Inadimplência é exibida como KPI, não deduzida do resultado.
          </p>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className={`bi-card${tone ? ` fin-card-${tone}` : ''}`}>
      <span className="bi-card-label">{label}</span>
      <span className="bi-card-value">{value}</span>
      {hint && <span className="bi-card-hint">{hint}</span>}
    </div>
  );
}

/* ---- Clientes ---------------------------------------------------- */
function ClientsSection({ clients, onChange }: { clients: FinClient[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [day, setDay] = useState('');
  const [started, setStarted] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await apiSend('/api/finance/clients', 'POST', {
        name: name.trim(),
        monthly_value: Number(value || 0),
        billing_day: day ? Number(day) : null,
        started_at: started,
      });
      setName(''); setValue(''); setDay(''); setStarted(todayISO());
      onChange();
    } catch (e) { alert('Erro ao adicionar: ' + (e as Error).message); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: ClientStatus) => {
    try { await apiSend(`/api/finance/clients/${id}`, 'PATCH', { status }); onChange(); }
    catch (e) { alert('Erro: ' + (e as Error).message); }
  };
  const remove = async (id: string, nm: string) => {
    if (!confirm(`Remover o cliente "${nm}"?`)) return;
    try { await apiSend(`/api/finance/clients/${id}`, 'DELETE'); onChange(); }
    catch (e) { alert('Erro: ' + (e as Error).message); }
  };

  return (
    <section className="bi-panel" aria-labelledby="fin-cli-h">
      <h2 className="bi-panel-title" id="fin-cli-h">Clientes ({clients.length})</h2>

      <div className="fin-form">
        <input className="fin-input fin-grow" placeholder="Nome do cliente" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="fin-input" type="number" min="0" placeholder="Mensalidade (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
        <input className="fin-input fin-narrow" type="number" min="1" max="31" placeholder="Dia" value={day} onChange={(e) => setDay(e.target.value)} title="Dia de vencimento" />
        <input className="fin-input" type="date" value={started} onChange={(e) => setStarted(e.target.value)} title="Início do contrato" />
        <button type="button" className="fin-btn" onClick={add} disabled={busy || !name.trim()}>Adicionar</button>
      </div>

      {clients.length > 0 && (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Cliente</th><th>Mensalidade</th><th>Status</th><th>Início</th><th>Venc.</th><th></th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="fin-strong">{c.name}</td>
                  <td>{brl(c.monthly_value)}</td>
                  <td>
                    <select className={`fin-status-select st-${c.status}`} value={c.status} onChange={(e) => setStatus(c.id, e.target.value as ClientStatus)}>
                      {(Object.keys(STATUS_LABELS) as ClientStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{dateBR(c.started_at)}</td>
                  <td>{c.billing_day ? `dia ${c.billing_day}` : '—'}</td>
                  <td><button type="button" className="fin-del" onClick={() => remove(c.id, c.name)} aria-label={`Remover ${c.name}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---- Despesas ---------------------------------------------------- */
function ExpensesSection({ expenses, onChange }: { expenses: FinExpense[]; onChange: () => void }) {
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('outros');
  const [amount, setAmount] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!desc.trim() || !(Number(amount) > 0) || busy) return;
    setBusy(true);
    try {
      await apiSend('/api/finance/expenses', 'POST', {
        description: desc.trim(), category: cat, amount: Number(amount), recurring, start_date: date,
      });
      setDesc(''); setAmount(''); setDate(todayISO());
      onChange();
    } catch (e) { alert('Erro ao adicionar: ' + (e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string, nm: string) => {
    if (!confirm(`Remover a despesa "${nm}"?`)) return;
    try { await apiSend(`/api/finance/expenses/${id}`, 'DELETE'); onChange(); }
    catch (e) { alert('Erro: ' + (e as Error).message); }
  };
  const catLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? 'Outros';

  return (
    <section className="bi-panel" aria-labelledby="fin-exp-h">
      <h2 className="bi-panel-title" id="fin-exp-h">Despesas ({expenses.length})</h2>

      <div className="fin-form">
        <input className="fin-input fin-grow" placeholder="Descrição (ex.: Vercel, salário...)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <select className="fin-input" value={cat} onChange={(e) => setCat(e.target.value)}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input className="fin-input" type="number" min="0" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="fin-check"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Fixa mensal</label>
        <input className="fin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} title={recurring ? 'Início' : 'Data'} />
        <button type="button" className="fin-btn" onClick={add} disabled={busy || !desc.trim() || !(Number(amount) > 0)}>Adicionar</button>
      </div>

      {expenses.length > 0 && (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Tipo</th><th>Desde/Data</th><th></th></tr></thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="fin-strong">{e.description}</td>
                  <td>{catLabel(e.category)}</td>
                  <td>{brl(e.amount)}{e.recurring ? '/mês' : ''}</td>
                  <td>{e.recurring ? 'Fixa' : 'Avulsa'}</td>
                  <td>{dateBR(e.start_date)}</td>
                  <td><button type="button" className="fin-del" onClick={() => remove(e.id, e.description)} aria-label={`Remover ${e.description}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---- Receitas avulsas -------------------------------------------- */
function RevenueSection({ revenue, clients, onChange }: { revenue: FinRevenue[]; clients: FinClient[]; onChange: () => void }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!desc.trim() || !(Number(amount) > 0) || busy) return;
    setBusy(true);
    try {
      await apiSend('/api/finance/revenue', 'POST', {
        description: desc.trim(), amount: Number(amount), received_on: date, client_id: clientId || null,
      });
      setDesc(''); setAmount(''); setClientId(''); setDate(todayISO());
      onChange();
    } catch (e) { alert('Erro ao adicionar: ' + (e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string, nm: string) => {
    if (!confirm(`Remover a receita "${nm}"?`)) return;
    try { await apiSend(`/api/finance/revenue/${id}`, 'DELETE'); onChange(); }
    catch (e) { alert('Erro: ' + (e as Error).message); }
  };
  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? '—' : '—');

  return (
    <section className="bi-panel" aria-labelledby="fin-rev-h">
      <h2 className="bi-panel-title" id="fin-rev-h">Receitas avulsas ({revenue.length})</h2>

      <div className="fin-form">
        <input className="fin-input fin-grow" placeholder="Descrição (ex.: setup, projeto pontual)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <select className="fin-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Sem cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="fin-input" type="number" min="0" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="fin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} title="Data do recebimento" />
        <button type="button" className="fin-btn" onClick={add} disabled={busy || !desc.trim() || !(Number(amount) > 0)}>Adicionar</button>
      </div>

      {revenue.length > 0 && (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Descrição</th><th>Cliente</th><th>Valor</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id}>
                  <td className="fin-strong">{r.description}</td>
                  <td>{clientName(r.client_id)}</td>
                  <td>{brl(r.amount)}</td>
                  <td>{dateBR(r.received_on)}</td>
                  <td><button type="button" className="fin-del" onClick={() => remove(r.id, r.description)} aria-label={`Remover ${r.description}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

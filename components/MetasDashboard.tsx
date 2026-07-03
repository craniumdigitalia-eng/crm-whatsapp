'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/* ============================================================
   Metas & Projeção de crescimento (aba própria, separada do Financeiro).
   Parte do MRR atual e projeta mês a mês: +N novos clientes/mês e
   -C saídas/mês, a um ticket configurável, até o mês-alvo.
   ============================================================ */

interface Goals {
  newPerMonth: number;
  churnPerMonth: number;
  newTicket: number;
  targetMonth: string; // YYYY-MM
}
interface SummaryKpis {
  mrr: number;
  activeClients: number;
  avgTicket: number | null;
  scheduledMrr: number;
  scheduledClients: number;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const monthLabel = (y: number, m0: number) => `${MESES[m0]}/${String(y).slice(2)}`;

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export default function MetasDashboard() {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [kpis, setKpis] = useState<SummaryKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, s] = await Promise.all([
        apiGet<{ goals: Goals }>('/api/finance/goals'),
        apiGet<{ kpis: SummaryKpis }>('/api/finance/summary?period=mes'),
      ]);
      setGoals(g.goals);
      setKpis(s.kpis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!goals || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goals),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) {
      alert('Erro ao salvar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<Goals>) => setGoals((g) => (g ? { ...g, ...patch } : g));

  // Opções de mês-alvo: dos próximos meses até +18.
  const targetOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth();
    for (let i = 0; i < 18; i++) {
      m++; if (m > 11) { m = 0; y++; }
      opts.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: monthLabel(y, m) });
    }
    return opts;
  }, []);

  // Projeção mês a mês a partir do MRR atual.
  const projection = useMemo(() => {
    if (!goals || !kpis) return [];
    const churnTicket = kpis.activeClients > 0 ? kpis.mrr / kpis.activeClients : goals.newTicket;
    const rows: { label: string; clients: number; mrr: number; delta: number }[] = [];
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth();
    rows.push({ label: `${monthLabel(y, m)} (atual)`, clients: kpis.activeClients, mrr: kpis.mrr, delta: 0 });
    const [ty, tm] = goals.targetMonth.split('-').map(Number);
    let clients = kpis.activeClients, mrr = kpis.mrr;
    let guard = 0;
    while (guard++ < 36) {
      m++; if (m > 11) { m = 0; y++; }
      if (y > ty || (y === ty && m + 1 > tm)) break;
      const prevMrr = mrr;
      clients = Math.max(0, clients + goals.newPerMonth - goals.churnPerMonth);
      mrr = Math.max(0, mrr + goals.newPerMonth * goals.newTicket - goals.churnPerMonth * churnTicket);
      rows.push({ label: monthLabel(y, m), clients, mrr, delta: mrr - prevMrr });
    }
    return rows;
  }, [goals, kpis]);

  const netMonth = goals ? goals.newPerMonth - goals.churnPerMonth : 0;
  const target = projection.length > 0 ? projection[projection.length - 1] : null;

  return (
    <section className="fin" aria-busy={loading}>
      <header className="bi-head">
        <div>
          <h1 className="bi-title">Metas</h1>
          <p className="bi-subtitle">Projeção de crescimento da carteira e do MRR</p>
        </div>
      </header>

      {error && (
        <div className="bi-error" role="alert">
          Não foi possível carregar: {error}
          <button type="button" className="bi-retry" onClick={load}>Tentar de novo</button>
        </div>
      )}
      {loading && !goals && <div className="bi-loading">Carregando metas…</div>}

      {goals && kpis && (
        <>
          {/* Parâmetros */}
          <section className="bi-panel" aria-labelledby="meta-cfg-h">
            <h2 className="bi-panel-title" id="meta-cfg-h">Parâmetros da meta</h2>
            <div className="fin-form">
              <label className="meta-field">
                <span>Novos clientes / mês</span>
                <input className="fin-input fin-narrow" type="number" min="0" value={goals.newPerMonth}
                  onChange={(e) => set({ newPerMonth: Number(e.target.value) })} />
              </label>
              <label className="meta-field">
                <span>Saídas (churn) / mês</span>
                <input className="fin-input fin-narrow" type="number" min="0" value={goals.churnPerMonth}
                  onChange={(e) => set({ churnPerMonth: Number(e.target.value) })} />
              </label>
              <label className="meta-field">
                <span>Ticket do novo cliente (R$)</span>
                <input className="fin-input" type="number" min="0" value={goals.newTicket}
                  onChange={(e) => set({ newTicket: Number(e.target.value) })} />
              </label>
              <label className="meta-field">
                <span>Projetar até</span>
                <select className="fin-input" value={goals.targetMonth}
                  onChange={(e) => set({ targetMonth: e.target.value })}>
                  {targetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <button type="button" className="fin-btn" onClick={save} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar metas'}
              </button>
              {savedAt && <span className="meta-saved">salvo {savedAt}</span>}
            </div>
            <p className="bi-note">
              Crescimento líquido de <strong>{netMonth >= 0 ? '+' : ''}{netMonth} cliente(s)/mês</strong>
              {' '}({goals.newPerMonth} entram, {goals.churnPerMonth} saem). A projeção parte do MRR atual.
            </p>
          </section>

          {/* KPIs da meta */}
          <div className="bi-cards">
            <div className="bi-card">
              <span className="bi-card-label">MRR atual</span>
              <span className="bi-card-value">{brl(kpis.mrr)}</span>
              <span className="bi-card-hint">{kpis.activeClients} clientes ativos</span>
            </div>
            <div className="bi-card fin-card-warn">
              <span className="bi-card-label">Meta de MRR ({target?.label ?? '—'})</span>
              <span className="bi-card-value">{brl(target?.mrr ?? kpis.mrr)}</span>
              <span className="bi-card-hint">{target?.clients ?? kpis.activeClients} clientes</span>
            </div>
            <div className="bi-card">
              <span className="bi-card-label">Crescimento no período</span>
              <span className="bi-card-value">{brl((target?.mrr ?? kpis.mrr) - kpis.mrr)}</span>
              <span className="bi-card-hint">a mais no MRR até a meta</span>
            </div>
            <div className="bi-card">
              <span className="bi-card-label">Já contratado (a entrar)</span>
              <span className="bi-card-value">{brl(kpis.scheduledMrr)}</span>
              <span className="bi-card-hint">{kpis.scheduledClients} cliente(s) começando</span>
            </div>
          </div>

          {/* Projeção mês a mês */}
          <section className="bi-panel" aria-labelledby="meta-proj-h">
            <h2 className="bi-panel-title" id="meta-proj-h">Projeção mês a mês</h2>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Mês</th><th>Clientes</th><th>MRR projetado</th><th>Variação</th></tr></thead>
                <tbody>
                  {projection.map((r, i) => (
                    <tr key={r.label} className={i === projection.length - 1 ? 'meta-row-target' : undefined}>
                      <td className="fin-strong">{r.label}</td>
                      <td>{r.clients}</td>
                      <td>{brl(r.mrr)}</td>
                      <td className={r.delta > 0 ? 'meta-up' : r.delta < 0 ? 'meta-down' : undefined}>
                        {i === 0 ? '—' : `${r.delta >= 0 ? '+' : ''}${brl(r.delta)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="bi-note">
              Projeção linear a partir do MRR atual. O ticket do churn usado é o ticket médio atual
              ({brl(kpis.activeClients > 0 ? kpis.mrr / kpis.activeClients : 0)}). Ajuste os parâmetros acima e salve.
            </p>
          </section>
        </>
      )}
    </section>
  );
}

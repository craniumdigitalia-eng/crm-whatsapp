'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeadStatus } from '@/src/types';
import BiLeadsTable from './BiLeadsTable';

/* ============================================================
   Métricas & BI (Story 5.6)
   Dashboard de indicadores de uma operação de leads via WhatsApp
   com qualificação por IA. Gráficos em SVG puro (sem dependência).
   Identidade Cranium (tema claro, classes .bi-*). PT-BR.
   Banco vazio -> 0 / "—" / estado vazio honesto (sem mock).
   ============================================================ */

type BiPeriod = '7d' | '30d' | '90d' | 'all';

interface FunnelStage {
  status: LeadStatus;
  label: string;
  reached: number;
  current: number;
}
interface FunnelConversion {
  from: LeadStatus;
  to: LeadStatus;
  fromLabel: string;
  toLabel: string;
  rate: number | null;
}
interface DayPoint {
  date: string;
  count: number;
}
interface SourcePoint {
  source: string;
  label: string;
  count: number;
}
interface BiMetrics {
  period: BiPeriod;
  since: string | null;
  generatedAt: string;
  hasData: boolean;
  cards: {
    totalLeads: number;
    newLeads: number;
    qualificationRate: number | null;
    winRate: number | null;
    avgCycleDays: number | null;
    avgFirstResponseMin: number | null;
    aiHandledRate: number | null;
    pipelineValue: number | null;
    pipelineCount: number;
  };
  statusCounts: Record<LeadStatus, number>;
  funnel: { stages: FunnelStage[]; conversions: FunnelConversion[] };
  leadsOverTime: DayPoint[];
  bySource: SourcePoint[];
  losses: { total: number };
  activity: {
    messagesIn: number;
    messagesOut: number;
    followupsScheduled: number;
    followupsSent: number;
    humanTransfers: number;
  };
}

const PERIOD_OPTIONS: { value: BiPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' },
];

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('nao autenticado');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---- Formatadores (null -> "—") -----------------------------------
const nf = new Intl.NumberFormat('pt-BR');
function fmtInt(n: number | null | undefined): string {
  return n == null ? '—' : nf.format(n);
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function fmtDays(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`;
}
function fmtDuration(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  return `${(h / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`;
}
function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtDayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ===================================================================
export default function BiDashboard() {
  const [period, setPeriod] = useState<BiPeriod>('30d');
  const [data, setData] = useState<BiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: BiPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const m = await apiGet<BiMetrics>(`/api/bi/metrics?period=${p}`);
      setData(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  return (
    <section className="bi" aria-busy={loading}>
      <header className="bi-head">
        <div>
          <h1 className="bi-title">Métricas &amp; BI</h1>
          <p className="bi-subtitle">Indicadores do funil de leads via WhatsApp + IA</p>
        </div>
        <div className="bi-period" role="group" aria-label="Filtro de período">
          {PERIOD_OPTIONS.map((opt) => (
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
          Não foi possível carregar as métricas: {error}
          <button type="button" className="bi-retry" onClick={() => load(period)}>
            Tentar de novo
          </button>
        </div>
      )}

      {loading && !data && <div className="bi-loading">Carregando indicadores…</div>}

      {data && (
        <>
          {!data.hasData && (
            <div className="bi-empty-banner" role="status">
              <strong>Sem dados ainda.</strong> Os indicadores aparecem automaticamente conforme os
              leads entram pelo WhatsApp e pelas campanhas. Nada é simulado.
            </div>
          )}

          <Cards d={data} />
          <Funnel funnel={data.funnel} hasData={data.hasData} />
          <div className="bi-grid-2">
            <LeadsOverTime series={data.leadsOverTime} hasData={data.hasData} />
            <BySource items={data.bySource} hasData={data.hasData} />
          </div>
          <div className="bi-grid-2">
            <Losses total={data.losses.total} newLeads={data.cards.newLeads} />
            <Activity a={data.activity} />
          </div>

          <p className="bi-footnote">
            Coorte de taxas: leads criados no período selecionado. Ciclo médio e tempo de 1ª resposta
            são estimados a partir das datas disponíveis. Atualizado em{' '}
            {new Date(data.generatedAt).toLocaleString('pt-BR')}.
          </p>
        </>
      )}

      <BiLeadsTable />
    </section>
  );
}

// ---- Cards de topo ------------------------------------------------
function Cards({ d }: { d: BiMetrics }) {
  const c = d.cards;
  const cards: { label: string; value: string; hint?: string }[] = [
    { label: 'Total de leads', value: fmtInt(c.totalLeads), hint: 'Acumulado (todo o histórico)' },
    { label: 'Novos no período', value: fmtInt(c.newLeads) },
    { label: 'Taxa de qualificação', value: fmtPct(c.qualificationRate), hint: 'Qualificados+ / novos' },
    { label: 'Taxa de conversão', value: fmtPct(c.winRate), hint: 'Fechados / novos (win rate)' },
    { label: 'Ciclo médio', value: fmtDays(c.avgCycleDays), hint: 'Criação → fechamento' },
    { label: '1ª resposta', value: fmtDuration(c.avgFirstResponseMin), hint: 'Tempo médio até responder' },
    { label: '% atendido pela IA', value: fmtPct(c.aiHandledRate), hint: 'vs. transferido p/ humano' },
    {
      label: 'Pipeline (proposta)',
      value: fmtBRL(c.pipelineValue),
      hint: `${fmtInt(c.pipelineCount)} lead(s) em proposta`,
    },
  ];
  return (
    <div className="bi-cards">
      {cards.map((card) => (
        <div className="bi-card" key={card.label}>
          <span className="bi-card-label">{card.label}</span>
          <span className="bi-card-value">{card.value}</span>
          {card.hint && <span className="bi-card-hint">{card.hint}</span>}
        </div>
      ))}
    </div>
  );
}

// ---- Funil --------------------------------------------------------
function Funnel({
  funnel,
  hasData,
}: {
  funnel: BiMetrics['funnel'];
  hasData: boolean;
}) {
  const max = Math.max(1, ...funnel.stages.map((s) => s.reached));
  return (
    <section className="bi-panel" aria-labelledby="bi-funnel-h">
      <h2 className="bi-panel-title" id="bi-funnel-h">
        Funil de conversão
      </h2>
      {!hasData ? (
        <EmptyState label="O funil se desenha conforme os leads avançam pelos estágios." />
      ) : (
        <div className="bi-funnel">
          {funnel.stages.map((s, i) => {
            const conv = i > 0 ? funnel.conversions[i - 1] : null;
            const width = `${Math.max(4, (s.reached / max) * 100)}%`;
            return (
              <div className="bi-funnel-row" key={s.status}>
                <div className="bi-funnel-meta">
                  <span className="bi-funnel-stage">{s.label}</span>
                  {conv && (
                    <span className="bi-funnel-conv" title="Conversão a partir do estágio anterior">
                      {fmtPct(conv.rate)}
                    </span>
                  )}
                </div>
                <div className="bi-funnel-track">
                  <div className="bi-funnel-bar" style={{ width }}>
                    <span className="bi-funnel-count">{fmtInt(s.reached)}</span>
                  </div>
                </div>
                <span className="bi-funnel-current">{fmtInt(s.current)} aqui</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---- Leads ao longo do tempo (área SVG) ---------------------------
function LeadsOverTime({ series, hasData }: { series: DayPoint[]; hasData: boolean }) {
  const total = useMemo(() => series.reduce((a, b) => a + b.count, 0), [series]);
  const W = 640;
  const H = 200;
  const PAD = 28;
  const max = Math.max(1, ...series.map((p) => p.count));
  const n = series.length;

  const { areaPath, linePath, ticks } = useMemo(() => {
    if (n === 0) return { areaPath: '', linePath: '', ticks: [] as { x: number; label: string }[] };
    const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1));
    const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
    let line = '';
    series.forEach((p, i) => {
      line += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.count).toFixed(1)} `;
    });
    const area = `${line}L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
    const step = Math.max(1, Math.ceil(n / 6));
    const tk: { x: number; label: string }[] = [];
    for (let i = 0; i < n; i += step) tk.push({ x: x(i), label: fmtDayLabel(series[i].date) });
    return { areaPath: area, linePath: line, ticks: tk };
  }, [series, n, max]);

  return (
    <section className="bi-panel" aria-labelledby="bi-time-h">
      <h2 className="bi-panel-title" id="bi-time-h">
        Leads ao longo do tempo
      </h2>
      {!hasData || total === 0 ? (
        <EmptyState label="Nenhum lead novo no período. A linha aparece quando os primeiros chegarem." />
      ) : (
        <figure className="bi-chart">
          <figcaption className="sr-only">
            Novos leads por dia no período: {total} no total.
          </figcaption>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="bi-svg"
            role="img"
            aria-label={`Novos leads por dia, ${total} no total`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="bi-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#bi-area)" />
            <path d={linePath} fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinejoin="round" />
            {ticks.map((t) => (
              <text key={t.x} x={t.x} y={H - 8} className="bi-svg-tick" textAnchor="middle">
                {t.label}
              </text>
            ))}
          </svg>
        </figure>
      )}
    </section>
  );
}

// ---- Por origem (barras horizontais) ------------------------------
function BySource({ items, hasData }: { items: SourcePoint[]; hasData: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="bi-panel" aria-labelledby="bi-source-h">
      <h2 className="bi-panel-title" id="bi-source-h">
        Por origem / campanha
      </h2>
      {!hasData || items.length === 0 ? (
        <EmptyState label="A atribuição aparece quando leads chegarem com origem (Meta Lead Ads, WhatsApp…)." />
      ) : (
        <table className="bi-source-table">
          <caption className="sr-only">Leads por origem no período</caption>
          <tbody>
            {items.map((it) => (
              <tr key={it.label}>
                <th scope="row" className="bi-source-name">
                  {it.label}
                </th>
                <td className="bi-source-bar-cell">
                  <div className="bi-source-bar" style={{ width: `${(it.count / max) * 100}%` }} />
                </td>
                <td className="bi-source-count">{fmtInt(it.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---- Perdas -------------------------------------------------------
function Losses({ total, newLeads }: { total: number; newLeads: number }) {
  const rate = newLeads > 0 ? total / newLeads : null;
  return (
    <section className="bi-panel" aria-labelledby="bi-loss-h">
      <h2 className="bi-panel-title" id="bi-loss-h">
        Perdas
      </h2>
      <div className="bi-mini-cards">
        <div className="bi-mini-card">
          <span className="bi-mini-value">{fmtInt(total)}</span>
          <span className="bi-mini-label">Leads perdidos</span>
        </div>
        <div className="bi-mini-card">
          <span className="bi-mini-value">{fmtPct(rate)}</span>
          <span className="bi-mini-label">Taxa de perda</span>
        </div>
      </div>
      <p className="bi-note">
        O estágio de origem de cada perda não é rastreado historicamente — exibimos o total do
        período.
      </p>
    </section>
  );
}

// ---- Atividade IA & equipe ----------------------------------------
function Activity({ a }: { a: BiMetrics['activity'] }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Mensagens recebidas', value: fmtInt(a.messagesIn) },
    { label: 'Mensagens enviadas', value: fmtInt(a.messagesOut) },
    { label: 'Follow-ups programados', value: fmtInt(a.followupsScheduled) },
    { label: 'Follow-ups enviados', value: fmtInt(a.followupsSent) },
    { label: 'Transferências p/ humano', value: fmtInt(a.humanTransfers) },
  ];
  return (
    <section className="bi-panel" aria-labelledby="bi-act-h">
      <h2 className="bi-panel-title" id="bi-act-h">
        Atividade da IA &amp; equipe
      </h2>
      <table className="bi-activity-table">
        <caption className="sr-only">Atividade no período</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="bi-empty">{label}</p>;
}

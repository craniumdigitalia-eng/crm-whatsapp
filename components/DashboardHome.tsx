'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeadStatus } from '@/src/types';

/* ============================================================
   Dashboard home (portal /)
   Visão-resumo do funil de leads. Reusa GET /api/bi/metrics (Story 5.6),
   gateado por requireUser. Sem mock: banco vazio -> 0 / "—" / estado honesto.
   Classes próprias .dash-* ; reaproveita .bi-card* para os KPIs.
   ============================================================ */

interface FunnelStage {
  status: LeadStatus;
  label: string;
  reached: number;
  current: number;
}
interface BiMetrics {
  hasData: boolean;
  generatedAt: string;
  cards: {
    totalLeads: number;
    newLeads: number;
    qualificationRate: number | null;
    winRate: number | null;
    avgFirstResponseMin: number | null;
    pipelineValue: number | null;
    pipelineCount: number;
  };
  funnel: { stages: FunnelStage[] };
  activity: {
    messagesIn: number;
    messagesOut: number;
    followupsScheduled: number;
    humanTransfers: number;
  };
}

const nf = new Intl.NumberFormat('pt-BR');
const fmtInt = (n: number | null | undefined) => (n == null ? '—' : nf.format(n));
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtDuration = (min: number | null | undefined) => {
  if (min == null) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
};
const fmtBRL = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('não autenticado');
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(b.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const SHORTCUTS: { href: string; label: string; desc: string }[] = [
  { href: '/crm', label: 'CRM / Kanban', desc: 'Funil de leads' },
  { href: '/conversas', label: 'Conversas', desc: 'Inbox WhatsApp' },
  { href: '/followups', label: 'Follow-ups', desc: 'Lembretes por lead' },
  { href: '/bi', label: 'Métricas & BI', desc: 'Indicadores completos' },
];

export default function DashboardHome({ firstName }: { firstName: string }) {
  const [data, setData] = useState<BiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<BiMetrics>('/api/bi/metrics?period=30d'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const c = data?.cards;
  const kpis = [
    { label: 'Total de leads', value: fmtInt(c?.totalLeads), hint: 'Acumulado' },
    { label: 'Novos (30 dias)', value: fmtInt(c?.newLeads) },
    { label: 'Taxa de qualificação', value: fmtPct(c?.qualificationRate) },
    { label: 'Taxa de conversão', value: fmtPct(c?.winRate) },
    { label: '1ª resposta', value: fmtDuration(c?.avgFirstResponseMin) },
    { label: 'Pipeline (proposta)', value: fmtBRL(c?.pipelineValue), hint: `${fmtInt(c?.pipelineCount)} lead(s)` },
  ];

  return (
    <section className="integ-page dash" aria-busy={loading}>
      <header className="dash-head">
        <div>
          <h1 className="integ-title">Olá, {firstName} 👋</h1>
          <p className="integ-subtitle">Resumo do seu funil de leads nos últimos 30 dias.</p>
        </div>
        <Link href="/bi" className="btn btn-ghost btn-sm">Ver métricas completas</Link>
      </header>

      {error && (
        <div className="bi-error" role="alert">
          Não foi possível carregar o resumo: {error}
          <button type="button" className="bi-retry" onClick={() => void load()}>Tentar de novo</button>
        </div>
      )}

      {data && !data.hasData && (
        <div className="bi-empty-banner" role="status">
          <strong>Sem dados ainda.</strong> O resumo se preenche conforme os leads entram pelo
          WhatsApp e pelas campanhas. Nada é simulado.
        </div>
      )}

      {/* KPIs */}
      <div className="bi-cards dash-cards">
        {kpis.map((k) => (
          <div className="bi-card" key={k.label}>
            <span className="bi-card-label">{k.label}</span>
            <span className="bi-card-value">{loading && !data ? '…' : k.value}</span>
            {k.hint && <span className="bi-card-hint">{k.hint}</span>}
          </div>
        ))}
      </div>

      <div className="dash-grid">
        {/* Funil compacto */}
        <section className="dash-panel" aria-labelledby="dash-funnel-h">
          <h2 className="dash-panel-title" id="dash-funnel-h">Funil por estágio</h2>
          {data && data.funnel.stages.length > 0 ? (
            <ul className="dash-funnel">
              {data.funnel.stages.map((s) => {
                const max = Math.max(1, ...data.funnel.stages.map((x) => x.reached));
                return (
                  <li className="dash-funnel-row" key={s.status}>
                    <span className="dash-funnel-label">{s.label}</span>
                    <span className="dash-funnel-track">
                      <span
                        className="dash-funnel-bar"
                        style={{ width: `${Math.max(4, (s.reached / max) * 100)}%` }}
                      />
                    </span>
                    <span className="dash-funnel-count">{fmtInt(s.reached)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="bi-empty">O funil aparece quando os primeiros leads chegarem.</p>
          )}
        </section>

        {/* Atalhos + atividade */}
        <section className="dash-panel" aria-labelledby="dash-quick-h">
          <h2 className="dash-panel-title" id="dash-quick-h">Atalhos</h2>
          <div className="dash-shortcuts">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href} className="dash-shortcut">
                <span className="dash-shortcut-label">{s.label}</span>
                <span className="dash-shortcut-desc">{s.desc}</span>
              </Link>
            ))}
          </div>

          {data && (
            <dl className="dash-activity">
              <div><dt>Mensagens recebidas</dt><dd>{fmtInt(data.activity.messagesIn)}</dd></div>
              <div><dt>Mensagens enviadas</dt><dd>{fmtInt(data.activity.messagesOut)}</dd></div>
              <div><dt>Follow-ups programados</dt><dd>{fmtInt(data.activity.followupsScheduled)}</dd></div>
              <div><dt>Transferências p/ humano</dt><dd>{fmtInt(data.activity.humanTransfers)}</dd></div>
            </dl>
          )}
        </section>
      </div>
    </section>
  );
}

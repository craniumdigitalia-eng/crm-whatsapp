'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS, type LeadStatus } from '@/src/types';

/* ============================================================
   Follow-up por lead (migration 008)
   Programa follow-ups especificos: "lembrar o lead X em N dias
   com esta mensagem". Complementa o follow-up automatico.
   Identidade Cranium (tema claro, classes .fup-*).
   ============================================================ */

type ScheduleStatus = 'pendente' | 'enviado' | 'cancelado' | 'erro';

interface LeadLite {
  id: string;
  name: string | null;
  phone: string;
}

// Espelha src/crm/followup-schedule.ts (FollowUpScheduleWithLead).
interface FollowUp {
  id: string;
  lead_id: string;
  scheduled_at: string;
  message: string;
  status: ScheduleStatus;
  created_at: string;
  sent_at: string | null;
  lead: LeadLite | null;
}

// Espelha o lead retornado por /api/leads (subconjunto que usamos aqui).
interface LeadRow {
  id: string;
  name: string | null;
  phone: string;
  status: LeadStatus;
}

const STATUS_PILL: Record<ScheduleStatus, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'fup-pill--pending' },
  enviado: { label: 'Enviado', cls: 'fup-pill--sent' },
  cancelado: { label: 'Cancelado', cls: 'fup-pill--cancelled' },
  erro: { label: 'Erro', cls: 'fup-pill--err' },
};

async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: opts?.body ? { 'Content-Type': 'application/json', ...opts?.headers } : opts?.headers,
  });
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

// Data/hora absoluta legivel (pt-BR).
function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Tempo relativo curto ("em 2 dias", "em 3h", "agora", "há 1 dia").
function fmtRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const future = diffMs >= 0;
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  const hour = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);

  let core: string;
  if (min < 1) core = 'agora';
  else if (min < 60) core = `${min} min`;
  else if (hour < 24) core = `${hour}h`;
  else if (day < 30) core = `${day} ${day === 1 ? 'dia' : 'dias'}`;
  else core = fmtAbsolute(iso);

  if (core === 'agora') return core;
  return future ? `em ${core}` : `há ${core}`;
}

// Converte "agora + N dias" para o formato value de <input type="datetime-local">
// (YYYY-MM-DDTHH:mm em horario LOCAL).
function plusDaysLocalValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Ajuste do fuso para extrair o horario local em ISO-sem-Z.
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function leadLabel(lead: { name: string | null; phone: string } | null): string {
  if (!lead) return 'Lead removido';
  return lead.name?.trim() ? `${lead.name} · ${lead.phone}` : lead.phone;
}

export default function FollowupsModule() {
  const [upcoming, setUpcoming] = useState<FollowUp[]>([]);
  const [history, setHistory] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Formulario de agendamento.
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [when, setWhen] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  }

  const loadFollowups = useCallback(async () => {
    try {
      const { upcoming, history } = await apiCall<{ upcoming: FollowUp[]; history: FollowUp[] }>(
        '/api/followups'
      );
      setUpcoming(upcoming);
      setHistory(history);
    } catch (e) {
      flash('err', `Falha ao carregar follow-ups: ${(e as Error).message}`);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const { leads } = await apiCall<{ leads: LeadRow[] }>('/api/leads');
      setLeads(leads);
    } catch (e) {
      flash('err', `Falha ao carregar leads: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadFollowups(), loadLeads()]);
      setLoading(false);
    })();
  }, [loadFollowups, loadLeads]);

  // Resultados do seletor de lead (filtra por nome/telefone).
  const leadResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads.slice(0, 8);
    return leads
      .filter(
        (l) =>
          (l.name ?? '').toLowerCase().includes(q) || l.phone.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, leads]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead) return flash('err', 'Escolha um lead.');
    if (!when) return flash('err', 'Escolha a data/hora.');
    if (!message.trim()) return flash('err', 'Escreva a mensagem.');

    const scheduledAt = new Date(when);
    if (isNaN(scheduledAt.getTime())) return flash('err', 'Data invalida.');
    if (scheduledAt.getTime() <= Date.now()) return flash('err', 'A data precisa ser no futuro.');

    setSaving(true);
    try {
      await apiCall('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          scheduledAt: scheduledAt.toISOString(),
          message: message.trim(),
        }),
      });
      flash('ok', 'Follow-up agendado!');
      setSelectedLead(null);
      setSearch('');
      setWhen('');
      setMessage('');
      await loadFollowups();
    } catch (err) {
      flash('err', `Nao foi possivel agendar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await apiCall(`/api/followups/${id}`, { method: 'DELETE' });
      flash('ok', 'Follow-up cancelado.');
      await loadFollowups();
    } catch (err) {
      flash('err', `Nao foi possivel cancelar: ${(err as Error).message}`);
    }
  }

  const hasLeads = leads.length > 0;

  return (
    <section className="integ-page fup-page">
      <header className="integ-head">
        <h1 className="integ-title">Follow-up</h1>
        <p className="integ-subtitle">
          Programe follow-ups especificos por lead — &ldquo;lembrar o lead X em 2 dias com esta
          mensagem&rdquo;. Complementa o follow-up automatico do agente.
        </p>
      </header>

      {msg && (
        <div className={`integ-banner ${msg.kind === 'ok' ? 'integ-banner--ok' : 'integ-banner--err'}`}>
          {msg.text}
        </div>
      )}

      <div className="fup-note" role="note">
        <strong>Quando dispara:</strong> os agendados sao enviados na rodada diaria do cron
        (12h UTC, plano Hobby da Vercel). Um follow-up marcado para hoje as 14h, por exemplo, sai
        na proxima rodada diaria. Precisao por minuto exige o plano Pro.
      </div>

      <div className="fup-grid">
        {/* ---------- Programar ---------- */}
        <div className="fup-card">
          <h2 className="fup-card-title">Programar follow-up</h2>

          {!hasLeads && !loading ? (
            <p className="fup-empty">
              Nenhum lead cadastrado ainda. Assim que chegarem leads (WhatsApp ou Meta), eles
              aparecerao aqui para voce programar follow-ups.
            </p>
          ) : (
            <form className="fup-form" onSubmit={handleSchedule}>
              {/* Seletor de lead */}
              <label className="fup-field">
                <span>Lead</span>
                {selectedLead ? (
                  <div className="fup-selected">
                    <span className="fup-selected-name">{leadLabel(selectedLead)}</span>
                    <button
                      type="button"
                      className="fup-selected-clear"
                      onClick={() => {
                        setSelectedLead(null);
                        setSearch('');
                      }}
                      aria-label="Trocar lead"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Buscar por nome ou telefone…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {leadResults.length > 0 ? (
                      <ul className="fup-results">
                        {leadResults.map((l) => (
                          <li key={l.id}>
                            <button
                              type="button"
                              className="fup-result"
                              onClick={() => setSelectedLead(l)}
                            >
                              <span className="fup-result-name">{l.name?.trim() || 'Sem nome'}</span>
                              <span className="fup-result-phone">{l.phone}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fup-hint">Nenhum lead encontrado para &ldquo;{search}&rdquo;.</p>
                    )}
                  </>
                )}
              </label>

              {/* Data/hora + atalhos */}
              <label className="fup-field">
                <span>Quando</span>
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
                <div className="fup-quick">
                  <button type="button" className="fup-chip" onClick={() => setWhen(plusDaysLocalValue(1))}>
                    +1 dia
                  </button>
                  <button type="button" className="fup-chip" onClick={() => setWhen(plusDaysLocalValue(3))}>
                    +3 dias
                  </button>
                  <button type="button" className="fup-chip" onClick={() => setWhen(plusDaysLocalValue(7))}>
                    +1 semana
                  </button>
                </div>
              </label>

              {/* Mensagem */}
              <label className="fup-field">
                <span>Mensagem</span>
                <textarea
                  rows={4}
                  placeholder="Ex: Oi! Passando para retomar nossa conversa sobre o plano…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              <div className="fup-form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Agendando…' : 'Agendar'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ---------- Listas ---------- */}
        <div className="fup-card">
          <h2 className="fup-card-title">Proximos follow-ups</h2>

          {loading ? (
            <p className="fup-empty">Carregando…</p>
          ) : upcoming.length === 0 ? (
            <p className="fup-empty">Nenhum follow-up programado.</p>
          ) : (
            <ul className="fup-list">
              {upcoming.map((f) => (
                <li key={f.id} className="fup-item">
                  <div className="fup-item-main">
                    <div className="fup-item-top">
                      <span className="fup-item-lead">{leadLabel(f.lead)}</span>
                      <span className={`fup-pill ${STATUS_PILL[f.status].cls}`}>
                        {STATUS_PILL[f.status].label}
                      </span>
                    </div>
                    <div className="fup-item-when" title={fmtAbsolute(f.scheduled_at)}>
                      {fmtRelative(f.scheduled_at)} · {fmtAbsolute(f.scheduled_at)}
                    </div>
                    <p className="fup-item-msg">{f.message}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCancel(f.id)}
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Historico (enviados/cancelados/erro) */}
          {history.length > 0 && (
            <>
              <h3 className="fup-subhead">Enviados / Histórico</h3>
              <ul className="fup-list fup-list--muted">
                {history.map((f) => (
                  <li key={f.id} className="fup-item">
                    <div className="fup-item-main">
                      <div className="fup-item-top">
                        <span className="fup-item-lead">{leadLabel(f.lead)}</span>
                        <span className={`fup-pill ${STATUS_PILL[f.status].cls}`}>
                          {STATUS_PILL[f.status].label}
                        </span>
                      </div>
                      <div className="fup-item-when" title={fmtAbsolute(f.scheduled_at)}>
                        {f.sent_at ? `Enviado ${fmtRelative(f.sent_at)}` : fmtRelative(f.scheduled_at)}
                        {' · '}
                        {fmtAbsolute(f.scheduled_at)}
                      </div>
                      <p className="fup-item-msg">{f.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

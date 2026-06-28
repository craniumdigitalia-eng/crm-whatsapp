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

// Espelha src/followup/cadence.ts (CadenceStep) — um passo da cadencia padrao.
// dueDay = dia (a partir da criacao do lead) em que o toque pode sair; hourBRT =
// hora (0-23, horario de Brasilia) minima do disparo na rodada do cron.
interface CadenceStep {
  dueDay: number;
  hourBRT: number;
  message: string;
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

  // Cadencia padrao (configuravel).
  const [cadSteps, setCadSteps] = useState<CadenceStep[]>([]);
  const [cadEnabled, setCadEnabled] = useState(true);
  const [cadDefaults, setCadDefaults] = useState<CadenceStep[]>([]);
  const [cadSaving, setCadSaving] = useState(false);

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

  const loadCadence = useCallback(async () => {
    try {
      const data = await apiCall<{ steps: CadenceStep[]; enabled: boolean; defaults: CadenceStep[] }>(
        '/api/followups/cadence'
      );
      setCadSteps(data.steps);
      setCadEnabled(data.enabled);
      setCadDefaults(data.defaults);
    } catch (e) {
      flash('err', `Falha ao carregar a cadencia: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadFollowups(), loadLeads(), loadCadence()]);
      setLoading(false);
    })();
  }, [loadFollowups, loadLeads, loadCadence]);

  // ---- Edicao local dos passos da cadencia ----
  function updateStep(i: number, patch: Partial<CadenceStep>) {
    setCadSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    // Novo toque alguns dias apos o ultimo, herdando a hora (ou 8h).
    setCadSteps((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        { dueDay: (last?.dueDay ?? 0) + 3, hourBRT: last?.hourBRT ?? 8, message: '' },
      ];
    });
  }
  function removeStep(i: number) {
    setCadSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setCadSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function restoreDefaults() {
    setCadSteps(cadDefaults.map((s) => ({ ...s })));
    setCadEnabled(true);
    flash('ok', 'Padrao restaurado nos campos. Clique em "Salvar cadencia" para aplicar.');
  }

  async function saveCadence() {
    // Validacao espelhando o servidor: ao menos 1 passo; dia >= 1; hora 0-23; mensagem nao vazia.
    const steps = cadSteps.map((s) => ({
      dueDay: Number(s.dueDay),
      hourBRT: Number(s.hourBRT),
      message: s.message.trim(),
    }));
    if (steps.length === 0) return flash('err', 'Adicione ao menos um toque a cadencia.');
    for (let i = 0; i < steps.length; i++) {
      if (!Number.isInteger(steps[i].dueDay) || steps[i].dueDay < 1) {
        return flash('err', `Toque ${i + 1}: o dia precisa ser um numero inteiro maior que zero.`);
      }
      if (!Number.isInteger(steps[i].hourBRT) || steps[i].hourBRT < 0 || steps[i].hourBRT > 23) {
        return flash('err', `Toque ${i + 1}: a hora precisa estar entre 0 e 23.`);
      }
      if (!steps[i].message) {
        return flash('err', `Toque ${i + 1}: escreva a mensagem.`);
      }
    }

    setCadSaving(true);
    try {
      const data = await apiCall<{ steps: CadenceStep[]; enabled: boolean; defaults: CadenceStep[] }>(
        '/api/followups/cadence',
        { method: 'POST', body: JSON.stringify({ steps, enabled: cadEnabled }) }
      );
      setCadSteps(data.steps);
      setCadEnabled(data.enabled);
      flash('ok', 'Cadencia salva!');
    } catch (err) {
      flash('err', `Nao foi possivel salvar a cadencia: ${(err as Error).message}`);
    } finally {
      setCadSaving(false);
    }
  }

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

      {/* ---------- Cadencia padrao (configuravel) ---------- */}
      <div className="fup-card cad-card">
        <div className="cad-head">
          <div>
            <h2 className="fup-card-title" style={{ marginBottom: 4 }}>
              Cadencia padrao
            </h2>
            <p className="cad-sub">
              Sequencia automatica de retomadas para todo lead novo que nao responde. Assim que o
              lead responde, ele sai da cadencia e o agente assume (qualifica, agenda ou encerra).
            </p>
          </div>
          <label className="cad-switch" title="Ativar ou desativar a cadencia padrao">
            <input
              type="checkbox"
              checked={cadEnabled}
              onChange={(e) => setCadEnabled(e.target.checked)}
            />
            <span className="cad-switch-track" aria-hidden />
            <span className="cad-switch-label">{cadEnabled ? 'Ativada' : 'Desativada'}</span>
          </label>
        </div>

        <div className="cad-warn" role="note">
          <strong>Como funciona:</strong> os disparos seguem o horario configurado em cada toque
          (requer o cron de hora em hora ativo). Cada toque sai quando ja se passaram
          &ldquo;Dia&rdquo; dias desde a entrada do lead, a partir da hora marcada (horario de
          Brasilia), no maximo 1 por dia. O padrao cobre ~4 meses em 3 fases (semana 1 diaria, resto
          do mes 1 a cada 3 dias, meses 2-4 a cada 6 dias). Apos o ultimo toque sem resposta, o lead
          e <strong>encerrado automaticamente</strong> (perdido).
        </div>

        {loading ? (
          <p className="fup-empty">Carregando…</p>
        ) : (
          <>
            <ol className="cad-steps">
              {cadSteps.map((step, i) => (
                <li key={i} className="cad-step">
                  <div className="cad-step-head">
                    <span className="cad-step-num">{i + 1}º toque</span>
                    <div className="cad-step-reorder">
                      <button
                        type="button"
                        className="cad-icon-btn"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        aria-label="Mover para cima"
                        title="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="cad-icon-btn"
                        onClick={() => moveStep(i, 1)}
                        disabled={i === cadSteps.length - 1}
                        aria-label="Mover para baixo"
                        title="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="cad-icon-btn cad-icon-btn--danger"
                        onClick={() => removeStep(i)}
                        aria-label="Remover passo"
                        title="Remover passo"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="cad-step-body">
                    <div className="cad-timing">
                      <label className="cad-delay">
                        <span>Dia</span>
                        <div className="cad-delay-input">
                          <input
                            type="number"
                            min={1}
                            value={step.dueDay}
                            onChange={(e) =>
                              updateStep(i, { dueDay: e.target.value === '' ? 0 : Number(e.target.value) })
                            }
                          />
                          <span>apos a entrada</span>
                        </div>
                      </label>
                      <label className="cad-delay">
                        <span>Hora (BRT)</span>
                        <div className="cad-delay-input">
                          <select
                            value={step.hourBRT}
                            onChange={(e) => updateStep(i, { hourBRT: Number(e.target.value) })}
                          >
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, '0')}h
                              </option>
                            ))}
                          </select>
                          <span>horario de Brasilia</span>
                        </div>
                      </label>
                    </div>
                    <textarea
                      className="cad-message"
                      rows={3}
                      placeholder="Mensagem do toque. Use {nome} para inserir o primeiro nome do lead."
                      value={step.message}
                      onChange={(e) => updateStep(i, { message: e.target.value })}
                    />
                  </div>
                </li>
              ))}
            </ol>

            {cadSteps.length === 0 && (
              <p className="fup-empty">Nenhum passo. Adicione o primeiro toque da cadencia.</p>
            )}

            <button type="button" className="cad-add" onClick={addStep}>
              + Adicionar passo
            </button>

            <div className="cad-actions">
              <button type="button" className="btn btn-ghost" onClick={restoreDefaults}>
                Restaurar padrao
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveCadence}
                disabled={cadSaving}
              >
                {cadSaving ? 'Salvando…' : 'Salvar cadencia'}
              </button>
            </div>
          </>
        )}
      </div>

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

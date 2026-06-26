'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Agente IA — personalizacao do atendimento (persona/abordagem)
   Os valores vivem em integrations_config; GET e aberto (requireUser),
   salvar exige admin. Identidade Cranium (classes .agent-*).
   ============================================================ */

interface ToneOption {
  value: string;
  label: string;
}

interface AgentConfig {
  personaName: string;
  personaRole: string;
  tone: string;
  companyContext: string;
  opening: string;
  qualificationGoals: string;
  escalationRules: string;
  guardrails: string;
}

interface ConfigResponse {
  config: AgentConfig;
  defaults: AgentConfig;
  toneOptions: ToneOption[];
}

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

export default function AgentConfigModule({ isAdmin }: { isAdmin: boolean }) {
  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [defaults, setDefaults] = useState<AgentConfig | null>(null);
  const [toneOptions, setToneOptions] = useState<ToneOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Previa "testar"
  const [testMsg, setTestMsg] = useState('Oi, vi o anúncio de vocês e queria saber mais sobre tráfego pago');
  const [testReply, setTestReply] = useState<{ reply: string; handoff: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  }

  const load = useCallback(async () => {
    try {
      const data = await apiCall<ConfigResponse>('/api/agente/config');
      setCfg(data.config);
      setDefaults(data.defaults);
      setToneOptions(data.toneOptions);
    } catch (e) {
      flash('err', `Falha ao carregar a config do agente: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      const data = await apiCall<{ config: AgentConfig }>('/api/agente/config', {
        method: 'POST',
        body: JSON.stringify(cfg),
      });
      setCfg(data.config);
      flash('ok', 'Configuração do agente salva. O atendimento já usa as novas regras.');
    } catch (e) {
      flash('err', `Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function resetDefaults() {
    if (!defaults) return;
    if (!confirm('Restaurar todos os campos para os valores padrão da Cranium? (só salva ao clicar em Salvar)')) return;
    setCfg({ ...defaults });
  }

  async function runTest() {
    if (!cfg || !testMsg.trim()) return;
    setTesting(true);
    setTestReply(null);
    try {
      const data = await apiCall<{ reply: string; handoff: boolean }>('/api/agente/preview', {
        method: 'POST',
        body: JSON.stringify({ message: testMsg.trim(), config: cfg }),
      });
      setTestReply(data);
    } catch (e) {
      flash('err', `Falha no teste: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  if (!cfg) {
    return (
      <section className="integ-page agent-page">
        <p className="agent-empty">Carregando configuração do agente…</p>
      </section>
    );
  }

  const toneLabel = toneOptions.find((t) => t.value === cfg.tone)?.label ?? cfg.tone;
  const disabled = !isAdmin;

  return (
    <section className="integ-page agent-page">
      <header className="integ-head">
        <h1 className="integ-title">Agente IA</h1>
        <p className="integ-subtitle">
          Personalize <strong>como a IA atende</strong> seus leads no WhatsApp: quem ela é, o tom,
          como aborda, o que precisa descobrir e quando passa para um humano. Essas regras valem
          para todos os atendimentos automáticos.
        </p>
      </header>

      {msg && (
        <div className={`integ-banner ${msg.kind === 'ok' ? 'integ-banner--ok' : 'integ-banner--err'}`}>
          {msg.text}
        </div>
      )}

      {!isAdmin && (
        <div className="agent-readonly-note">
          Você está vendo a configuração atual. Apenas administradores podem editá-la.
        </div>
      )}

      <div className="agent-grid">
        {/* ---------- Coluna do formulário ---------- */}
        <div className="agent-form">
          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Persona</legend>
            <p className="agent-card-hint">
              A IA responde em primeira pessoa, como essa pessoa — o lead sente que fala com alguém da equipe.
            </p>
            <div className="agent-row">
              <label className="agent-field">
                <span>Nome (como ela assina)</span>
                <input
                  value={cfg.personaName}
                  onChange={(e) => set('personaName', e.target.value)}
                  placeholder="Ex: Pâmella"
                />
              </label>
              <label className="agent-field">
                <span>Função / como se apresenta</span>
                <input
                  value={cfg.personaRole}
                  onChange={(e) => set('personaRole', e.target.value)}
                  placeholder="Ex: consultora da Cranium Digital"
                />
              </label>
            </div>
            <label className="agent-field">
              <span>Tom de voz</span>
              <select value={cfg.tone} onChange={(e) => set('tone', e.target.value)}>
                {toneOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Sobre a empresa</legend>
            <p className="agent-card-hint">Contexto que a IA usa para explicar quem somos e o que oferecemos.</p>
            <label className="agent-field">
              <textarea
                rows={4}
                value={cfg.companyContext}
                onChange={(e) => set('companyContext', e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Abordagem (1ª mensagem)</legend>
            <p className="agent-card-hint">Como a IA aborda o lead que acabou de chegar.</p>
            <label className="agent-field">
              <textarea
                rows={4}
                value={cfg.opening}
                onChange={(e) => set('opening', e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Qualificação</legend>
            <p className="agent-card-hint">O que a IA deve descobrir antes de passar o lead para a equipe.</p>
            <label className="agent-field">
              <textarea
                rows={7}
                value={cfg.qualificationGoals}
                onChange={(e) => set('qualificationGoals', e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Quando transferir para um humano</legend>
            <label className="agent-field">
              <textarea
                rows={4}
                value={cfg.escalationRules}
                onChange={(e) => set('escalationRules', e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="agent-card" disabled={disabled}>
            <legend className="agent-card-title">Guardrails (o que NUNCA fazer)</legend>
            <p className="agent-card-hint">Limites de segurança: nunca inventar preço/cobertura, não prometer, etc.</p>
            <label className="agent-field">
              <textarea
                rows={5}
                value={cfg.guardrails}
                onChange={(e) => set('guardrails', e.target.value)}
              />
            </label>
          </fieldset>

          {isAdmin && (
            <div className="agent-actions">
              <button className="btn btn-ghost" type="button" onClick={resetDefaults} disabled={busy}>
                Restaurar padrão
              </button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          )}
        </div>

        {/* ---------- Coluna de prévia ---------- */}
        <aside className="agent-preview">
          <div className="agent-card agent-preview-card">
            <h3 className="agent-card-title">Prévia da persona</h3>
            <div className="agent-persona-line">
              <span className="agent-persona-avatar" aria-hidden="true">
                {(cfg.personaName.trim()[0] ?? 'A').toUpperCase()}
              </span>
              <div>
                <div className="agent-persona-name">{cfg.personaName || '—'}</div>
                <div className="agent-persona-role">{cfg.personaRole || '—'}</div>
              </div>
            </div>
            <div className="agent-persona-tone">Tom: {toneLabel}</div>

            <h4 className="agent-preview-sub">Como ela aborda</h4>
            <div className="agent-bubble">{cfg.opening || '—'}</div>
          </div>

          <div className="agent-card agent-preview-card">
            <h3 className="agent-card-title">Testar resposta</h3>
            <p className="agent-card-hint">
              Envia uma mensagem de exemplo para o agente (com as edições atuais, mesmo sem salvar).
              Não grava nada nem envia WhatsApp.
            </p>
            <label className="agent-field">
              <span>Mensagem do lead</span>
              <textarea rows={2} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
            </label>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={runTest}
              disabled={testing || !isAdmin}
              title={isAdmin ? undefined : 'Apenas administradores podem testar'}
            >
              {testing ? 'Gerando…' : 'Testar agente'}
            </button>
            {!isAdmin && <p className="agent-card-hint">O teste consome a API e exige admin.</p>}

            {testReply && (
              <div className="agent-chat-preview">
                <div className="agent-bubble agent-bubble--in">{testMsg}</div>
                <div className="agent-bubble agent-bubble--out">{testReply.reply || '(sem texto)'}</div>
                {testReply.handoff && (
                  <div className="agent-handoff-note">→ O agente decidiria transferir para um humano.</div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

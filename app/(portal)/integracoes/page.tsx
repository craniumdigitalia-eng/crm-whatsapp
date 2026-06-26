'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Integrações (Story 5.14)
   Cards de conexão na identidade Cranium: Google Calendar,
   Facebook Ads (Meta Lead Ads) e WhatsApp (Evolution).
   ============================================================ */

interface MetaStatus {
  connected: boolean;
  hasPageAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  formId: string;
}

// Gera um Verify Token aleatório (sugestão para o handshake do webhook).
function genVerifyToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return 'cranium_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    // Sessao expirou — volta para o login (Story 5.2).
    window.location.href = '/login';
    throw new Error('nao autenticado');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

interface EvoStatus {
  configured: boolean;
  state: 'connected' | 'connecting' | 'disconnected' | 'unreachable';
  number?: string;
}

export default function IntegracoesPage() {
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [evo, setEvo] = useState<EvoStatus | null>(null);

  // Form de conexão Meta.
  const [pageToken, setPageToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [formId, setFormId] = useState('');

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await apiCall<MetaStatus>('/api/integrations/meta/config');
      setMeta(status);
      setFormId((prev) => prev || status.formId || '');
    } catch (e) {
      setMsg({ kind: 'err', text: `Falha ao carregar status: ${(e as Error).message}` });
    }
  }, []);

  const loadEvo = useCallback(async () => {
    try {
      const status = await apiCall<EvoStatus>('/api/integrations/evolution/status');
      setEvo(status);
    } catch {
      // Evolution opcional — silencia falha de status no painel de integracoes.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadEvo();
    setVerifyToken((prev) => prev || genVerifyToken());
  }, [loadStatus, loadEvo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiCall('/api/integrations/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_access_token: pageToken,
          app_secret: appSecret,
          verify_token: verifyToken,
          form_id: formId,
        }),
      });
      // Limpa os campos de segredo após salvar (não permanecem no client).
      setPageToken('');
      setAppSecret('');
      setMsg({ kind: 'ok', text: 'Conexão salva com sucesso.' });
      await loadStatus();
    } catch (e) {
      setMsg({ kind: 'err', text: `Erro ao salvar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setMsg(null);
    try {
      const res = await apiCall<{ imported: number; skipped: number; errors: number; fetched: number }>(
        '/api/integrations/meta/import',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form_id: formId }) }
      );
      setMsg({
        kind: 'ok',
        text: `Importação concluída: ${res.imported} novos, ${res.skipped} já existentes, ${res.errors} erros (de ${res.fetched} no formulário).`,
      });
    } catch (e) {
      setMsg({ kind: 'err', text: `Erro na importação: ${(e as Error).message}` });
    } finally {
      setImporting(false);
    }
  };

  const metaConnected = meta?.connected ?? false;

  return (
    <section className="integ-page">
      <header className="integ-head">
        <h1 className="integ-title">Integrações</h1>
        <p className="integ-subtitle">
          Conecte o portal às plataformas que alimentam seus leads e sua agenda.
        </p>
      </header>

      {msg && (
        <div className={`integ-banner integ-banner--${msg.kind}`} role="status" aria-live="polite">
          {msg.text}
        </div>
      )}

      <div className="integ-grid">

        {/* ---- Google Calendar ---- */}
        <article className="integ-card">
          <div className="integ-card-head">
            <div className="integ-icon integ-icon--google" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">Google Calendar</h2>
              <span className="integ-badge integ-badge--off">Não conectado</span>
            </div>
          </div>
          <p className="integ-card-desc">
            Sincronize reuniões e follow-ups agendados com sua agenda do Google.
          </p>
          <div className="integ-card-actions">
            <a className="btn btn-primary" href="/api/integrations/google">Conectar</a>
          </div>
        </article>

        {/* ---- WhatsApp (Evolution) ---- */}
        <article className="integ-card">
          <div className="integ-card-head">
            <div className="integ-icon integ-icon--wa" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">WhatsApp · Evolution</h2>
              <span className={`integ-badge ${evo?.state === 'connected' ? 'integ-badge--on' : 'integ-badge--off'}`}>
                {evo?.state === 'connected'
                  ? `Conectado${evo.number ? ` · +${evo.number}` : ''}`
                  : 'Não conectado'}
              </span>
            </div>
          </div>
          <p className="integ-card-desc">
            Canal de atendimento via WhatsApp. Conecte o número via QR Code e receba as mensagens no CRM.
          </p>
          <div className="integ-card-actions">
            <a className="btn btn-primary" href="/whatsapp">
              {evo?.state === 'connected' ? 'Gerenciar conexão' : 'Conectar via QR'}
            </a>
          </div>
        </article>

        {/* ---- Facebook Ads / Meta Lead Ads ---- */}
        <article className="integ-card integ-card--wide">
          <div className="integ-card-head">
            <div className="integ-icon integ-icon--meta" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/>
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">Facebook Ads · Meta Lead Ads</h2>
              <span className={`integ-badge ${metaConnected ? 'integ-badge--on' : 'integ-badge--off'}`}>
                {metaConnected ? 'Conectado' : 'Não conectado'}
              </span>
            </div>
          </div>
          <p className="integ-card-desc">
            Importe automaticamente os leads dos formulários instantâneos das suas campanhas no Facebook/Instagram.
          </p>

          <form className="integ-form" onSubmit={(e) => void handleSave(e)}>
            <div className="integ-field">
              <label htmlFor="meta-token">
                Page Access Token
                {meta?.hasPageAccessToken && <span className="integ-saved">• salvo</span>}
              </label>
              <input
                id="meta-token"
                type="password"
                value={pageToken}
                onChange={(e) => setPageToken(e.target.value)}
                placeholder={meta?.hasPageAccessToken ? '•••••••• (deixe em branco p/ manter)' : 'EAAB...'}
                autoComplete="off"
              />
            </div>

            <div className="integ-field">
              <label htmlFor="meta-form">Form ID</label>
              <input
                id="meta-form"
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="ID do formulário instantâneo"
              />
            </div>

            <div className="integ-field">
              <label htmlFor="meta-secret">
                App Secret
                {meta?.hasAppSecret && <span className="integ-saved">• salvo</span>}
              </label>
              <input
                id="meta-secret"
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={meta?.hasAppSecret ? '•••••••• (deixe em branco p/ manter)' : 'usado p/ validar o webhook'}
                autoComplete="off"
              />
            </div>

            <div className="integ-field">
              <label htmlFor="meta-verify">Verify Token (webhook)</label>
              <input
                id="meta-verify"
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="token de verificação do webhook"
              />
              <span className="integ-hint">
                Use este mesmo valor no painel do app Meta ao configurar o webhook leadgen.
              </span>
            </div>

            <div className="integ-card-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar conexão'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleImport()}
                disabled={importing || !metaConnected}
                title={metaConnected ? 'Importar leads do formulário agora' : 'Salve o token e o Form ID primeiro'}
              >
                {importing ? 'Importando…' : 'Importar leads agora'}
              </button>
            </div>
          </form>

          <div className="integ-webhook">
            <span className="integ-webhook-label">URL do webhook (leadgen):</span>
            <code className="integ-webhook-url">/api/leadgen</code>
          </div>
        </article>

      </div>
    </section>
  );
}

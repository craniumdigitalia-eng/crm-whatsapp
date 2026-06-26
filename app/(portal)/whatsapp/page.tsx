'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
   WhatsApp · Evolution (ADR-004)
   Conectar via QR Code, status em tempo real e configuracao das
   credenciais da Evolution. Identidade Cranium.
   Os endpoints sao proxied (server-side) — o browser nunca fala
   direto com a Evolution nem ve a apikey.
   ============================================================ */

interface EvoConfig {
  configured: boolean;
  url: string;
  instance: string;
  hasApiKey: boolean;
  hasWebhookToken: boolean;
}

type ConnState = 'connected' | 'connecting' | 'disconnected' | 'unreachable';

interface EvoStatus {
  configured: boolean;
  state: ConnState;
  number?: string;
  error?: string;
}

interface ConnectResult {
  base64?: string;
  code?: string;
  pairingCode?: string;
  alreadyConnected: boolean;
}

async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
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

const STATE_LABEL: Record<ConnState, string> = {
  connected: 'Conectado',
  connecting: 'Aguardando leitura do QR',
  disconnected: 'Não conectado',
  unreachable: 'Evolution inacessível',
};

export default function WhatsappPage() {
  const [cfg, setCfg] = useState<EvoConfig | null>(null);
  const [status, setStatus] = useState<EvoStatus | null>(null);
  const [qr, setQr] = useState<ConnectResult | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Form de credenciais.
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [instance, setInstance] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [saving, setSaving] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConfig = useCallback(async () => {
    const c = await apiCall<EvoConfig>('/api/integrations/evolution/config');
    setCfg(c);
    setUrl((prev) => prev || c.url || '');
    setInstance((prev) => prev || c.instance || '');
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiCall<EvoStatus>('/api/integrations/evolution/status');
      setStatus(s);
      return s;
    } catch (e) {
      setStatus({ configured: false, state: 'disconnected', error: (e as Error).message });
      return null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    void loadConfig().catch((e) => setMsg({ kind: 'err', text: (e as Error).message }));
    void loadStatus();
    return () => stopPolling();
  }, [loadConfig, loadStatus, stopPolling]);

  // Poll a cada 3s enquanto aguardamos o pareamento; para ao conectar.
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const s = await loadStatus();
      if (s?.state === 'connected') {
        stopPolling();
        setConnecting(false);
        setQr(null);
        void loadConfig();
      }
    }, 3000);
  }, [loadStatus, loadConfig, stopPolling]);

  const handleConnect = async () => {
    setConnecting(true);
    setQr(null);
    setMsg(null);
    try {
      const result = await apiCall<ConnectResult>('/api/integrations/evolution/connect', {
        method: 'POST',
      });
      if (result.alreadyConnected) {
        setMsg({ kind: 'ok', text: 'Esta instância já está conectada.' });
        await loadStatus();
        setConnecting(false);
        return;
      }
      setQr(result);
      startPolling();
    } catch (e) {
      setConnecting(false);
      setMsg({ kind: 'err', text: `Falha ao conectar: ${(e as Error).message}` });
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiCall('/api/integrations/evolution/disconnect', { method: 'POST' });
      stopPolling();
      setQr(null);
      setConnecting(false);
      setMsg({ kind: 'ok', text: 'Sessão desconectada.' });
      await loadStatus();
    } catch (e) {
      setMsg({ kind: 'err', text: `Falha ao desconectar: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiCall('/api/integrations/evolution/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          api_key: apiKey,
          instance,
          webhook_token: webhookToken,
        }),
      });
      setApiKey('');
      setWebhookToken('');
      setMsg({ kind: 'ok', text: 'Credenciais salvas.' });
      await loadConfig();
      await loadStatus();
    } catch (e) {
      setMsg({ kind: 'err', text: `Erro ao salvar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const state = status?.state ?? 'disconnected';
  const connected = state === 'connected';
  const badgeClass = connected ? 'integ-badge--on' : 'integ-badge--off';

  // URL do webhook que o usuario cola no painel da Evolution.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${origin}/api/webhook${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : '?token=SEU_TOKEN'}`;

  return (
    <section className="integ-page">
      <header className="integ-head">
        <h1 className="integ-title">WhatsApp · Evolution</h1>
        <p className="integ-subtitle">
          Conecte o número de atendimento via QR Code. As mensagens recebidas alimentam o CRM e o agente de IA.
        </p>
      </header>

      {msg && (
        <div className={`integ-banner integ-banner--${msg.kind === 'ok' ? 'ok' : 'err'}`} role="status" aria-live="polite">
          {msg.text}
        </div>
      )}

      <div className="integ-grid">
        {/* ---- Conexão / QR ---- */}
        <article className="integ-card integ-card--wide">
          <div className="integ-card-head">
            <div className="integ-icon integ-icon--wa" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">Conexão do WhatsApp</h2>
              <span className={`integ-badge ${badgeClass}`}>
                {STATE_LABEL[state]}
                {connected && status?.number ? ` · +${status.number}` : ''}
              </span>
            </div>
          </div>

          {!cfg?.configured ? (
            <p className="integ-card-desc">
              Configure a URL, a API key e a instância da Evolution no cartão abaixo para habilitar a conexão.
            </p>
          ) : connected ? (
            <>
              <p className="integ-card-desc">
                Número conectado{status?.number ? <> (<strong>+{status.number}</strong>)</> : ''}. As mensagens já estão
                sendo recebidas no CRM.
              </p>
              <div className="integ-card-actions">
                <button type="button" className="btn btn-ghost" onClick={() => void handleDisconnect()} disabled={busy}>
                  {busy ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="integ-card-desc">
                Clique em “Conectar” e leia o QR Code no WhatsApp do número de atendimento
                (Aparelhos conectados → Conectar um aparelho).
              </p>

              {qr?.base64 && (
                <div className="wa-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="wa-qr-img" src={qr.base64} alt="QR Code para parear o WhatsApp" width={264} height={264} />
                  <div className="wa-qr-hint">
                    <p>Aguardando leitura…</p>
                    {qr.pairingCode && (
                      <p>
                        Ou use o código de pareamento: <code className="integ-webhook-url">{qr.pairingCode}</code>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="integ-card-actions">
                <button type="button" className="btn btn-primary" onClick={() => void handleConnect()} disabled={connecting}>
                  {connecting ? 'Gerando QR…' : qr ? 'Gerar novo QR' : 'Conectar'}
                </button>
              </div>
            </>
          )}

          {status?.error && state === 'unreachable' && (
            <p className="integ-hint" style={{ color: '#991b1b' }}>{status.error}</p>
          )}
        </article>

        {/* ---- Credenciais ---- */}
        <article className="integ-card integ-card--wide">
          <div className="integ-card-head">
            <div className="integ-icon integ-icon--wa" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">Credenciais da Evolution</h2>
              <span className={`integ-badge ${cfg?.configured ? 'integ-badge--on' : 'integ-badge--off'}`}>
                {cfg?.configured ? 'Configurada' : 'Pendente'}
              </span>
            </div>
          </div>
          <p className="integ-card-desc">
            Salve aqui para não precisar editar o <code className="integ-webhook-url">.env</code> na mão. Os valores ficam
            no servidor (nunca expostos ao navegador).
          </p>

          <form className="integ-form" onSubmit={(e) => void handleSave(e)}>
            <div className="integ-field">
              <label htmlFor="evo-url">URL da Evolution</label>
              <input id="evo-url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                     placeholder="https://sua-evolution.up.railway.app" autoComplete="off" />
            </div>

            <div className="integ-field">
              <label htmlFor="evo-instance">Instância</label>
              <input id="evo-instance" type="text" value={instance} onChange={(e) => setInstance(e.target.value)}
                     placeholder="cranium" autoComplete="off" />
            </div>

            <div className="integ-field">
              <label htmlFor="evo-key">
                API Key {cfg?.hasApiKey && <span className="integ-saved">• salvo</span>}
              </label>
              <input id="evo-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                     placeholder={cfg?.hasApiKey ? '•••••••• (deixe em branco p/ manter)' : 'apikey global da Evolution'}
                     autoComplete="off" />
            </div>

            <div className="integ-field">
              <label htmlFor="evo-webhook">
                Token do webhook {cfg?.hasWebhookToken && <span className="integ-saved">• salvo</span>}
              </label>
              <input id="evo-webhook" type="password" value={webhookToken} onChange={(e) => setWebhookToken(e.target.value)}
                     placeholder={cfg?.hasWebhookToken ? '•••••••• (deixe em branco p/ manter)' : 'segredo p/ validar o webhook'}
                     autoComplete="off" />
              <span className="integ-hint">Use este valor no fim da URL do webhook (?token=…) no painel da Evolution.</span>
            </div>

            <div className="integ-card-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar credenciais'}
              </button>
            </div>
          </form>

          <div className="integ-webhook">
            <span className="integ-webhook-label">URL do webhook (evento messages.upsert):</span>
            <code className="integ-webhook-url">{webhookUrl}</code>
          </div>
        </article>
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Integrações
   Cards de conexão na identidade Cranium:
   - Google Calendar (OAuth real → /api/integrations/google/*)
   - Facebook Ads · Meta Lead Ads VIA MAKE (webhook /api/leadgen + secret)
   - WhatsApp · Evolution (QR)
   ============================================================ */

interface MetaStatus {
  connected: boolean;
  hasMakeSecret: boolean;
  hasPageAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  formId: string;
}

interface OpenAiStatus {
  hasKey: boolean;
  source: 'db' | 'env' | 'none';
}

interface EvoStatus {
  configured: boolean;
  state: 'connected' | 'connecting' | 'disconnected' | 'unreachable';
  number?: string;
}

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  calendarId: string;
}

// Gera um secret aleatório (sugestão para o módulo HTTP do Make).
function genSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'make_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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

// Traduz o ?google=... do callback OAuth em uma mensagem amigável.
const GOOGLE_MSGS: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  conectado: { kind: 'ok', text: 'Google Calendar conectado com sucesso.' },
  nao_configurado: {
    kind: 'err',
    text: 'Google não configurado: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.',
  },
  cancelado: { kind: 'err', text: 'Conexão com o Google cancelada.' },
  state_invalido: { kind: 'err', text: 'Falha de segurança (state). Tente conectar novamente.' },
  sem_code: { kind: 'err', text: 'O Google não retornou o código de autorização.' },
  sem_refresh: {
    kind: 'err',
    text: 'O Google não devolveu refresh_token. Revogue o acesso do app e reconecte.',
  },
  erro: { kind: 'err', text: 'Erro ao conectar com o Google. Veja os logs do servidor.' },
};

export default function IntegracoesPage() {
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [evo, setEvo] = useState<EvoStatus | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [openai, setOpenai] = useState<OpenAiStatus | null>(null);

  const [makeSecret, setMakeSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('/api/leadgen');
  const [openaiKey, setOpenaiKey] = useState('');

  const [saving, setSaving] = useState(false);
  const [savingOpenai, setSavingOpenai] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await apiCall<MetaStatus>('/api/integrations/meta/config'));
    } catch (e) {
      setMsg({ kind: 'err', text: `Falha ao carregar status do Facebook: ${(e as Error).message}` });
    }
  }, []);

  const loadEvo = useCallback(async () => {
    try {
      setEvo(await apiCall<EvoStatus>('/api/integrations/evolution/status'));
    } catch {
      // Evolution opcional — silencia falha de status.
    }
  }, []);

  const loadGoogle = useCallback(async () => {
    try {
      setGoogle(await apiCall<GoogleStatus>('/api/integrations/google/status'));
    } catch {
      // silencia — card mostra "Nao conectado".
    }
  }, []);

  const loadOpenai = useCallback(async () => {
    try {
      setOpenai(await apiCall<OpenAiStatus>('/api/integrations/openai/config'));
    } catch {
      // silencia — card mostra "Nao configurada".
    }
  }, []);

  useEffect(() => {
    void loadMeta();
    void loadEvo();
    void loadGoogle();
    void loadOpenai();
    // URL pública do webhook que o Make vai chamar.
    setWebhookUrl(`${window.location.origin}/api/leadgen`);
    // Banner do retorno do OAuth Google (?google=...).
    const params = new URLSearchParams(window.location.search);

    const g = params.get('google');
    if (g && GOOGLE_MSGS[g]) {
      setMsg(GOOGLE_MSGS[g]);
      window.history.replaceState({}, '', '/integracoes');
    }
  }, [loadMeta, loadEvo, loadGoogle, loadOpenai]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: 'ok', text: 'Copiado para a área de transferência.' });
    } catch {
      setMsg({ kind: 'err', text: 'Não consegui copiar — selecione e copie manualmente.' });
    }
  };

  const handleSaveMake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeSecret.trim()) {
      setMsg({ kind: 'err', text: 'Gere um secret antes de salvar.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await apiCall('/api/integrations/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make_secret: makeSecret.trim() }),
      });
      // Mantém o secret visível para o usuário copiar no Make.
      setMsg({ kind: 'ok', text: 'Secret salvo. Cole-o no módulo HTTP do Make.' });
      await loadMeta();
    } catch (e) {
      setMsg({ kind: 'err', text: `Erro ao salvar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpenai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openaiKey.trim()) {
      setMsg({ kind: 'err', text: 'Cole a chave antes de salvar.' });
      return;
    }
    setSavingOpenai(true);
    setMsg(null);
    try {
      await apiCall('/api/integrations/openai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: openaiKey.trim() }),
      });
      setOpenaiKey('');
      setMsg({ kind: 'ok', text: 'Chave OpenAI salva. O agente ja usa a nova chave.' });
      await loadOpenai();
    } catch (e) {
      setMsg({ kind: 'err', text: `Erro ao salvar: ${(e as Error).message}` });
    } finally {
      setSavingOpenai(false);
    }
  };

  const metaConnected = meta?.hasMakeSecret ?? false;
  const googleConnected = google?.connected ?? false;

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
              <span className={`integ-badge ${googleConnected ? 'integ-badge--on' : 'integ-badge--off'}`}>
                {googleConnected ? 'Conectado' : 'Não conectado'}
              </span>
            </div>
          </div>
          <p className="integ-card-desc">
            Sincronize reuniões e follow-ups agendados com sua agenda do Google.
          </p>
          {google && !google.configured && (
            <p className="integ-hint">
              Google não configurado. Defina <code>GOOGLE_CLIENT_ID</code> e{' '}
              <code>GOOGLE_CLIENT_SECRET</code> no <code>.env</code> (veja{' '}
              <code>docs/integracoes-google.md</code>).
            </p>
          )}
          <div className="integ-card-actions">
            <a
              className={`btn ${google?.configured ? 'btn-primary' : 'btn-ghost'}`}
              href="/api/integrations/google/auth"
            >
              {googleConnected ? 'Reconectar' : 'Conectar'}
            </a>
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

        {/* ---- Facebook Ads / Meta Lead Ads VIA MAKE ---- */}
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
            Os leads dos formulários instantâneos chegam via <strong>Make</strong>: o cenário captura o
            lead no Facebook e faz um POST nesta URL. Gere um secret, cole no Make e pronto — cada lead
            novo entra no CRM e recebe a mensagem de abertura automaticamente.
          </p>

          {/* URL do webhook que o Make deve chamar */}
          <div className="integ-webhook">
            <span className="integ-webhook-label">URL do webhook (cole no Make):</span>
            <code className="integ-webhook-url">{webhookUrl}</code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(webhookUrl)}>
              Copiar
            </button>
          </div>

          {/* Secret compartilhado com o Make */}
          <form className="integ-form" onSubmit={(e) => void handleSaveMake(e)}>
            <div className="integ-field integ-field--full">
              <label htmlFor="make-secret">
                Secret do Make
                {meta?.hasMakeSecret && <span className="integ-saved">• salvo</span>}
              </label>
              <input
                id="make-secret"
                type="text"
                value={makeSecret}
                onChange={(e) => setMakeSecret(e.target.value)}
                placeholder={
                  meta?.hasMakeSecret
                    ? '•••••••• (um secret já está salvo — gere outro p/ trocar)'
                    : 'Clique em “Gerar secret”'
                }
                autoComplete="off"
              />
              <span className="integ-hint">
                O Make envia este valor no header <code>x-make-secret</code> (ou <code>?token=</code>).
                Guarde-o: ele não é exibido novamente depois de salvo.
              </span>
            </div>

            <div className="integ-card-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMakeSecret(genSecret())}>
                Gerar secret
              </button>
              {makeSecret && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(makeSecret)}>
                  Copiar secret
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving || !makeSecret.trim()}>
                {saving ? 'Salvando…' : 'Salvar secret'}
              </button>
            </div>
          </form>

          {/* Mini-guia do cenário Make */}
          <div className="integ-guide">
            <h3 className="integ-guide-title">Como configurar no Make</h3>
            <ol className="integ-steps">
              <li>Crie um cenário e adicione o módulo <strong>Facebook Lead Ads → Watch Leads</strong> (conecte a Página e o formulário).</li>
              <li>Adicione o módulo <strong>HTTP → Make a request</strong>.</li>
              <li>Method <strong>POST</strong>, a URL acima, Body type <strong>Raw / JSON (application/json)</strong>.</li>
              <li>Header: <code>x-make-secret</code> = o secret salvo aqui.</li>
              <li>No corpo, mapeie os campos do lead (nome, telefone e cada resposta do formulário) + <code>leadgen_id</code>, <code>form_id</code>, <code>ad_id</code>, <code>campaign_id</code>.</li>
              <li>Ative o cenário. Cada novo lead cria o contato no CRM e dispara a mensagem de abertura.</li>
            </ol>
          </div>
        </article>

        {/* ---- IA (OpenAI) BYOK ---- */}
        <article className="integ-card">
          <div className="integ-card-head">
            <div className="integ-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="integ-card-titles">
              <h2 className="integ-card-name">IA (OpenAI)</h2>
              <span className={`integ-badge ${openai?.hasKey ? 'integ-badge--on' : 'integ-badge--off'}`}>
                {openai?.source === 'db'
                  ? 'Usando chave propria (salva)'
                  : openai?.source === 'env'
                    ? 'Usando chave do ambiente'
                    : 'Nao configurada'}
              </span>
            </div>
          </div>
          <p className="integ-card-desc">
            Chave de API da OpenAI usada pelo agente. Se salva aqui (BYOK), substitui a variavel
            de ambiente <code>OPENAI_API_KEY</code> sem precisar reeditar o deploy.
          </p>

          <form className="integ-form" onSubmit={(e) => void handleSaveOpenai(e)}>
            <div className="integ-field integ-field--full">
              <label htmlFor="openai-api-key">
                Chave da API (sk-...)
                {openai?.source === 'db' && <span className="integ-saved">• salva</span>}
              </label>
              <input
                id="openai-api-key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={
                  openai?.source === 'db'
                    ? 'Cole aqui para substituir a chave salva'
                    : openai?.source === 'env'
                      ? 'Cole aqui para sobrepor a chave do ambiente'
                      : 'sk-...'
                }
                autoComplete="off"
              />
              <span className="integ-hint">
                A chave nao e exibida apos salvar. Campo vazio nao apaga uma chave ja salva.
              </span>
            </div>

            <div className="integ-card-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingOpenai || !openaiKey.trim()}
              >
                {savingOpenai ? 'Salvando...' : 'Salvar chave'}
              </button>
            </div>
          </form>
        </article>

      </div>
    </section>
  );
}

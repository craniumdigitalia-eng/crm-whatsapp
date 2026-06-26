'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================
   Conversas — inbox estilo WhatsApp Web, tema escuro Cranium.
   Reaproveita as APIs de leads (lista, detalhe, reply, ações).
   ============================================================ */

/* ---- Tipos (espelham src/types.ts) ---- */

type LeadStatus =
  | 'novo'
  | 'em_atendimento'
  | 'qualificado'
  | 'proposta'
  | 'fechado'
  | 'perdido'
  | 'humano';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string;
  status: LeadStatus;
  service_interest: string | null;
  budget: string | null;
  notes: string | null;
  follow_up_count: number;
  last_direction: 'in' | 'out' | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

interface Message {
  id: string;
  lead_id: string;
  direction: 'in' | 'out';
  body: string;
  external_id: string | null;
  created_at: string;
}

/* ---- Funil ---- */

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  fechado: 'Fechado',
  perdido: 'Perdido',
  humano: 'Atend. humano',
};

const STATUS_ORDER: LeadStatus[] = [
  'novo', 'em_atendimento', 'qualificado', 'proposta', 'fechado', 'perdido', 'humano',
];

// Estágios em que a IA responde automaticamente (espelha AUTO_STATUSES).
const AI_STAGES = new Set<LeadStatus>(['novo', 'em_atendimento', 'qualificado']);

const AVATAR_COLORS = ['#7C3AED', '#5B21B6', '#6D28D9', '#4C1D95', '#8B5CF6'];

const LIST_POLL_MS = 10_000;
const CHAT_POLL_MS = 5_000;

/* ---- Helpers ---- */

function avatarColor(name: string | null, phone: string): string {
  const seed = (name ?? phone) || '?';
  return AVATAR_COLORS[seed.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Horário relativo curto para a lista (estilo WhatsApp).
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Horário do balão (hh:mm).
function bubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

// Thin wrapper de fetch: redireciona ao login em 401, lança em erro.
async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('nao autenticado');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/* ============================================================
   ConversasInbox
   ============================================================ */

export default function ConversasInbox() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [lead, setLead]               = useState<Lead | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError]     = useState<string | null>(null);

  const [acting, setActing]           = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [replyText, setReplyText]     = useState('');
  const [replying, setReplying]       = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef  = useRef<HTMLInputElement>(null);

  /* ---- Lista de conversas ---- */

  const fetchLeads = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoadingList(true);
    try {
      const data = await apiCall<{ leads: Lead[] }>('/api/leads');
      setLeads(data.leads);
      setListError(null);
    } catch (e) {
      // Erro real de API — nunca cai para dados fake. Mantém a lista atual e
      // mostra um estado de erro honesto com opção de recarregar.
      setListError(e instanceof Error ? e.message : 'Erro ao carregar conversas');
    } finally {
      if (showSpinner) setLoadingList(false);
    }
  }, []);

  // Carga inicial + polling leve da lista.
  useEffect(() => {
    void fetchLeads(true);
    const t = setInterval(() => void fetchLeads(false), LIST_POLL_MS);
    return () => clearInterval(t);
  }, [fetchLeads]);

  /* ---- Conversa aberta ---- */

  const fetchChat = useCallback(async (id: string, showSpinner = false) => {
    if (showSpinner) { setLoadingChat(true); setChatError(null); }
    try {
      const data = await apiCall<{ lead: Lead; messages: Message[] }>(`/api/leads/${id}`);
      setLead(data.lead);
      setMessages(data.messages);
      setChatError(null);
    } catch (e) {
      if (showSpinner) setChatError(e instanceof Error ? e.message : 'Erro ao carregar conversa');
    } finally {
      if (showSpinner) setLoadingChat(false);
    }
  }, []);

  // Ao selecionar uma conversa: busca + inicia polling das mensagens.
  useEffect(() => {
    if (!selectedId) {
      setLead(null);
      setMessages([]);
      setActionError(null);
      setReplyText('');
      return;
    }
    void fetchChat(selectedId, true);
    const t = setInterval(() => void fetchChat(selectedId, false), CHAT_POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, fetchChat]);

  // Rola para a última mensagem quando o histórico muda.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, selectedId]);

  // Foca o input de resposta ao abrir uma conversa.
  useEffect(() => {
    if (selectedId && lead && !loadingChat) {
      requestAnimationFrame(() => replyInputRef.current?.focus());
    }
  }, [selectedId, lead, loadingChat]);

  /* ---- Lista ordenada + filtrada ---- */

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...leads]
      .filter((l) => {
        if (!q) return true;
        return (l.name ?? '').toLowerCase().includes(q) || l.phone.toLowerCase().includes(q);
      })
      .sort((a, b) => timeMs(b.last_message_at) - timeMs(a.last_message_at));
  }, [leads, search]);

  /* ---- Prévia da última mensagem na lista ---- */

  function preview(l: Lead): string {
    // Sem o corpo da última mensagem na lista, usamos last_direction como dica.
    if (l.last_direction === 'out') return 'Você respondeu';
    if (l.last_direction === 'in')  return 'Nova mensagem recebida';
    return l.service_interest ?? 'Sem mensagens ainda';
  }

  /* ---- Ações (takeover / release / status) ---- */

  const doAction = useCallback(async (
    actionKey: string,
    path: string,
    body?: Record<string, unknown>,
    optimisticStatus?: LeadStatus,
  ) => {
    if (!selectedId) return;
    if (optimisticStatus) {
      setLead((l) => (l ? { ...l, status: optimisticStatus } : l));
      setLeads((prev) => prev.map((l) => (l.id === selectedId ? { ...l, status: optimisticStatus } : l)));
    }
    setActing(actionKey);
    setActionError(null);

    try {
      await apiCall(`/api/leads/${selectedId}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await fetchChat(selectedId, false);
      void fetchLeads(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro na ação');
    } finally {
      setActing(null);
    }
  }, [selectedId, fetchChat, fetchLeads]);

  const handleTakeover = () => void doAction('takeover', 'takeover', undefined, 'humano');
  const handleRelease  = () => void doAction('release', 'release', undefined, 'em_atendimento');
  const handleStatus   = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as LeadStatus;
    void doAction('status', 'status', { status }, status);
  };

  /* ---- Responder (atualização otimista) ---- */

  const handleReply = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedId) return;

    // Otimista: adiciona o balão e marca como humano antes do round-trip.
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      lead_id: selectedId,
      direction: 'out',
      body: text,
      external_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLead((l) => (l && l.status !== 'humano' ? { ...l, status: 'humano' } : l));
    setLeads((prev) => prev.map((l) =>
      l.id === selectedId
        ? { ...l, status: 'humano', last_direction: 'out', last_message_at: optimistic.created_at }
        : l,
    ));
    setReplyText('');
    setReplying(true);
    setActionError(null);

    try {
      await apiCall(`/api/leads/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      await fetchChat(selectedId, false);
      void fetchLeads(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao enviar resposta');
      // Remove o balão otimista que falhou.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setReplyText(text);
    } finally {
      setReplying(false);
    }
  }, [replyText, selectedId, fetchChat, fetchLeads]);

  /* ---- Render ---- */

  const isHuman = lead?.status === 'humano';
  const busy = acting !== null;
  // No mobile, o painel de chat só aparece quando há conversa selecionada.
  const shellClass = `conv-shell${selectedId ? ' conv-shell--chat-open' : ''}`;

  return (
    <div className={shellClass}>

      {/* ===== Coluna esquerda: lista de conversas ===== */}
      <aside className="conv-list" aria-label="Lista de conversas">
        <div className="conv-list-head">
          <h1 className="conv-list-title">Conversas</h1>
        </div>

        <div className="conv-search">
          <svg className="conv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="conv-search-input"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar conversas"
          />
        </div>

        <div className="conv-list-body" role="list">
          {loadingList && leads.length === 0 ? (
            <div className="conv-list-state" aria-busy="true">Carregando conversas…</div>
          ) : listError && leads.length === 0 ? (
            <div className="conv-list-state" role="alert">
              Não foi possível carregar as conversas. Tente novamente.
              <button
                className="conv-btn conv-btn--ghost"
                style={{ marginTop: 12 }}
                onClick={() => void fetchLeads(true)}
              >
                Tentar novamente
              </button>
            </div>
          ) : visibleLeads.length === 0 ? (
            <div className="conv-list-state">
              {search ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </div>
          ) : (
            visibleLeads.map((l) => {
              const active = l.id === selectedId;
              const isAI = AI_STAGES.has(l.status);
              return (
                <button
                  key={l.id}
                  type="button"
                  role="listitem"
                  className={`conv-item${active ? ' active' : ''}`}
                  onClick={() => setSelectedId(l.id)}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Conversa com ${l.name ?? l.phone}`}
                >
                  <span className="conv-avatar" style={{ background: avatarColor(l.name, l.phone) }} aria-hidden="true">
                    {initials(l.name)}
                  </span>
                  <span className="conv-item-main">
                    <span className="conv-item-top">
                      <span className="conv-item-name">{l.name ?? l.phone}</span>
                      <span className="conv-item-time">{relativeTime(l.last_message_at)}</span>
                    </span>
                    <span className="conv-item-bottom">
                      <span className="conv-item-preview">{preview(l)}</span>
                    </span>
                    <span className="conv-item-tags">
                      <span className={`conv-stage conv-stage--${l.status}`}>{STATUS_LABELS[l.status]}</span>
                      {isAI && (
                        <span className="conv-ia-pill">
                          <span className="conv-ia-dot" aria-hidden="true" />
                          IA ativa
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ===== Coluna direita: chat aberto ===== */}
      <section className="conv-chat" aria-label="Conversa selecionada">
        {!selectedId ? (
          <div className="conv-empty">
            <div className="conv-empty-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="conv-empty-title">Selecione uma conversa</h2>
            <p className="conv-empty-sub">Escolha um contato à esquerda para ver e responder as mensagens.</p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <header className="conv-chat-head">
              <button
                type="button"
                className="conv-back"
                onClick={() => setSelectedId(null)}
                aria-label="Voltar para a lista de conversas"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="conv-chat-avatar" style={{ background: avatarColor(lead?.name ?? null, lead?.phone ?? '') }} aria-hidden="true">
                {initials(lead?.name ?? null)}
              </span>
              <div className="conv-chat-id">
                <span className="conv-chat-name">{lead ? (lead.name ?? lead.phone) : '—'}</span>
                <span className="conv-chat-phone">
                  {lead?.phone}
                  {lead && <span className={`conv-stage conv-stage--${lead.status}`}>{STATUS_LABELS[lead.status]}</span>}
                </span>
              </div>

              <div className="conv-chat-actions">
                {lead && (!isHuman ? (
                  <button className="conv-btn conv-btn--primary" disabled={busy} onClick={handleTakeover}
                          aria-label="Assumir atendimento deste contato">
                    {acting === 'takeover' ? 'Assumindo…' : 'Assumir'}
                  </button>
                ) : (
                  <button className="conv-btn conv-btn--ghost" disabled={busy} onClick={handleRelease}
                          aria-label="Devolver atendimento para a IA">
                    {acting === 'release' ? 'Devolvendo…' : 'Devolver p/ IA'}
                  </button>
                ))}
                {lead && (
                  <>
                    <label htmlFor="conv-status-select" className="conv-sr-only">Mover no funil</label>
                    <select
                      id="conv-status-select"
                      className="conv-status-select"
                      value={lead.status}
                      onChange={handleStatus}
                      disabled={busy}
                      aria-label="Mover contato no funil"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </header>

            {actionError && (
              <div className="conv-error" role="alert" aria-live="assertive">{actionError}</div>
            )}

            {/* Corpo: mensagens */}
            <div className="conv-chat-body" aria-label="Histórico da conversa" aria-live="polite">
              {loadingChat && messages.length === 0 ? (
                <div className="conv-chat-state">Carregando mensagens…</div>
              ) : chatError && messages.length === 0 ? (
                <div className="conv-chat-state" role="alert">
                  {chatError}
                  <button className="conv-btn conv-btn--ghost" style={{ marginTop: 12 }}
                          onClick={() => selectedId && void fetchChat(selectedId, true)}>
                    Tentar novamente
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="conv-chat-state">Nenhuma mensagem ainda.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`conv-bubble conv-bubble--${m.direction}`}
                       aria-label={m.direction === 'in' ? 'Mensagem do contato' : 'Mensagem enviada'}>
                    <div className="conv-bubble-body">{m.body}</div>
                    <div className="conv-bubble-time">{bubbleTime(m.created_at)}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Caixa de resposta */}
            <form className="conv-reply" onSubmit={(e) => void handleReply(e)}>
              <label htmlFor="conv-reply-input" className="conv-sr-only">Responder como humano</label>
              <input
                id="conv-reply-input"
                ref={replyInputRef}
                type="text"
                className="conv-reply-input"
                placeholder="Digite uma mensagem…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={replying}
                autoComplete="off"
              />
              <button
                type="submit"
                className="conv-send"
                disabled={replying || !replyText.trim()}
                aria-label="Enviar mensagem"
              >
                {replying ? (
                  <svg className="conv-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
   Types — mirror src/types.ts (local copy para evitar
   problemas de path entre tsconfig do Next.js e src/)
   ============================================================ */

type LeadStatus =
  | 'novo'
  | 'em_atendimento'
  | 'qualificado'
  | 'proposta'
  | 'fechado'
  | 'perdido'
  | 'humano';

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

interface Lead {
  id: string;
  name: string | null;
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
}

interface Message {
  id: string;
  lead_id: string;
  direction: 'in' | 'out';
  body: string;
  external_id: string | null;
  created_at: string;
  // Story 4.3: campo 'author' ainda não existe na tabela messages.
  // Mensagens 'out' não distinguem IA vs humano até que Story 4.3 seja implementada.
}

/* ============================================================
   Props
   ============================================================ */

export interface ConversationDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
  onOptimisticUpdate?: (id: string, patch: { status?: string }) => void;
}

/* ============================================================
   Helpers
   ============================================================ */

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// Retorna todos os elementos focáveis dentro de um container.
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

// Thin wrapper: lança se a resposta não for ok.
async function apiCall<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/* ============================================================
   ConversationDrawer
   ============================================================ */

export default function ConversationDrawer({
  leadId,
  onClose,
  onLeadUpdated,
  onOptimisticUpdate,
}: ConversationDrawerProps) {
  const panelRef    = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const [lead,        setLead       ] = useState<Lead | null>(null);
  const [messages,    setMessages   ] = useState<Message[]>([]);
  const [loadingLead, setLoadingLead] = useState(false);
  const [fetchError,  setFetchError ] = useState<string | null>(null);

  // Qual ação está em-flight (impede cliques duplos).
  const [acting,      setActing     ] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [replying,  setReplying ] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', service_interest: '', budget: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  /* ---- Fetch lead + mensagens ---- */

  const fetchLead = useCallback(async (id: string) => {
    setFetchError(null);
    setLoadingLead(true);
    try {
      const data = await apiCall<{ lead: Lead; messages: Message[] }>(`/api/leads/${id}`);
      setLead(data.lead);
      setMessages(data.messages);
      // Pré-popula edit form com dados atuais.
      setEditForm({
        name:             data.lead.name            ?? '',
        service_interest: data.lead.service_interest ?? '',
        budget:           data.lead.budget           ?? '',
        notes:            data.lead.notes            ?? '',
      });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Erro ao carregar lead');
    } finally {
      setLoadingLead(false);
    }
  }, []);

  /* Abre/fecha efeito: busca lead ao abrir; reseta estado ao fechar. */
  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setMessages([]);
      setEditMode(false);
      setActionError(null);
      setReplyText('');
      return;
    }
    void fetchLead(leadId);
  }, [leadId, fetchLead]);

  /* Move foco para o botão fechar na abertura inicial (AC2). */
  useEffect(() => {
    if (leadId && !loadingLead && lead) {
      requestAnimationFrame(() => { closeBtnRef.current?.focus(); });
    }
  }, [leadId, loadingLead, lead]);

  /* Scroll para o fim ao receber novas mensagens. */
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  /* Focus trap (AC3): Tab fica contido no drawer; Esc fecha. */
  useEffect(() => {
    if (!leadId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = getFocusable(panelRef.current);
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [leadId, onClose]);

  /* ---- Ação genérica (takeover / release / status) ---- */

  const doAction = useCallback(async (
    actionKey: string,
    path: string,
    body?: Record<string, unknown>,
    optimisticPatch?: { status?: string }
  ) => {
    if (!leadId) return;
    // Atualização otimista — move o card no kanban imediatamente.
    if (optimisticPatch) onOptimisticUpdate?.(leadId, optimisticPatch);

    setActing(actionKey);
    setActionError(null);
    try {
      await apiCall(`/api/leads/${leadId}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body:    body ? JSON.stringify(body) : undefined,
      });
      // Refetch para atualizar drawer com estado real do servidor.
      await fetchLead(leadId);
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro na ação');
    } finally {
      setActing(null);
    }
  }, [leadId, fetchLead, onLeadUpdated, onOptimisticUpdate]);

  /* ---- Takeover / Release ---- */

  const handleTakeover = () =>
    void doAction('takeover', 'takeover', undefined, { status: 'humano' });

  const handleRelease = () =>
    void doAction('release', 'release', undefined, { status: 'em_atendimento' });

  /* ---- Mover funil ---- */

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    void doAction('status', 'status', { status: e.target.value }, { status: e.target.value });

  /* ---- Responder ---- */

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || !leadId) return;
    setReplying(true);
    setActionError(null);
    // Otimista: marcar como humano antes do round-trip.
    if (lead?.status !== 'humano') onOptimisticUpdate?.(leadId, { status: 'humano' });
    try {
      await apiCall(`/api/leads/${leadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setReplyText('');
      await fetchLead(leadId);
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao enviar resposta');
    } finally {
      setReplying(false);
    }
  };

  /* ---- Editar ---- */

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;
    setSaving(true);
    setActionError(null);
    try {
      await apiCall(`/api/leads/${leadId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditMode(false);
      await fetchLead(leadId);
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  /* ---- Render ---- */

  if (!leadId) return null;

  const isHuman = lead?.status === 'humano';
  const busy    = acting !== null;

  return (
    <>
      {/* Overlay — clique fora fecha */}
      <div
        className="drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel do drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-lead-name"
        className="drawer-panel"
      >

        {/* Cabeçalho */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <span id="drawer-lead-name" className="drawer-lead-name">
              {lead ? (lead.name ?? lead.phone) : '—'}
            </span>
            {lead && (
              <span className="drawer-lead-phone">{lead.phone}</span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            className="drawer-close"
            onClick={onClose}
            aria-label="Fechar conversa"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Corpo */}
        <div className="drawer-body">

          {/* Estado de carregamento inicial */}
          {loadingLead && !lead ? (
            <div className="drawer-skeleton" aria-busy="true" aria-label="Carregando conversa">
              <div className="skeleton" style={{ width: '60%', height: 16, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 6, marginTop: 8 }} />
              <div className="skeleton" style={{ height: 200, borderRadius: 12, marginTop: 24 }} />
            </div>
          ) : fetchError ? (
            /* Estado de erro ao buscar */
            <div className="drawer-fetch-error" role="alert">
              <span>{fetchError}</span>
              <button
                className="btn btn-ghost"
                onClick={() => leadId && void fetchLead(leadId)}
                style={{ marginTop: 12 }}
              >
                Tentar novamente
              </button>
            </div>
          ) : lead ? (
            <>
              {/* Metadados do lead */}
              <div className="drawer-lead-meta">
                <div className="drawer-meta-row">
                  <span className={`drawer-status-badge drawer-status-${lead.status}`}>
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                  {lead.service_interest && (
                    <span className="tag tag-service">{lead.service_interest}</span>
                  )}
                  {lead.budget && (
                    <span className="tag tag-budget">{lead.budget}</span>
                  )}
                </div>
                {lead.notes && (
                  <div className="drawer-notes">{lead.notes}</div>
                )}
              </div>

              {/* Erro de ação */}
              {actionError && (
                <div className="drawer-action-error" role="alert" aria-live="assertive">
                  {actionError}
                </div>
              )}

              {/* Barra de ações */}
              {!editMode && (
                <div className="drawer-actions">
                  {!isHuman ? (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={handleTakeover}
                      aria-label="Assumir atendimento deste lead"
                    >
                      {acting === 'takeover' ? 'Assumindo…' : 'Assumir'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={handleRelease}
                      aria-label="Devolver atendimento para o agente de IA"
                    >
                      {acting === 'release' ? 'Devolvendo…' : 'Devolver p/ IA'}
                    </button>
                  )}

                  <div className="drawer-status-wrap">
                    <label htmlFor="drawer-status-select" className="sr-only">
                      Mover lead no funil
                    </label>
                    <select
                      id="drawer-status-select"
                      className="drawer-status-select"
                      value={lead.status}
                      onChange={handleStatusChange}
                      disabled={busy}
                      aria-label="Mover lead no funil"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn btn-ghost"
                    onClick={() => setEditMode(true)}
                    aria-label="Editar dados do lead"
                  >
                    Editar
                  </button>
                </div>
              )}

              {/* Formulário de edição inline */}
              {editMode && (
                <form className="drawer-edit-form" onSubmit={(e) => void handleEdit(e)}>
                  <div className="drawer-edit-title">Editar lead</div>

                  <div className="drawer-edit-field">
                    <label htmlFor="edit-name">Nome</label>
                    <input
                      id="edit-name"
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome do lead"
                    />
                  </div>
                  <div className="drawer-edit-field">
                    <label htmlFor="edit-service">Interesse</label>
                    <input
                      id="edit-service"
                      type="text"
                      value={editForm.service_interest}
                      onChange={(e) => setEditForm(f => ({ ...f, service_interest: e.target.value }))}
                      placeholder="ex: PME · 8 vidas"
                    />
                  </div>
                  <div className="drawer-edit-field">
                    <label htmlFor="edit-budget">Orçamento</label>
                    <input
                      id="edit-budget"
                      type="text"
                      value={editForm.budget}
                      onChange={(e) => setEditForm(f => ({ ...f, budget: e.target.value }))}
                      placeholder="ex: R$ 2.400/mês"
                    />
                  </div>
                  <div className="drawer-edit-field">
                    <label htmlFor="edit-notes">Notas</label>
                    <textarea
                      id="edit-notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Observações internas"
                      rows={3}
                    />
                  </div>

                  <div className="drawer-edit-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                      aria-label="Salvar alterações do lead"
                    >
                      {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setEditMode(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Histórico de mensagens */}
              <div
                ref={messagesRef}
                className="drawer-messages"
                aria-label="Histórico de conversa"
                aria-live="polite"
                aria-atomic="false"
              >
                {messages.length === 0 ? (
                  <div className="drawer-empty-msgs">Nenhuma mensagem ainda.</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`msg-bubble msg-bubble--${msg.direction}`}
                      aria-label={msg.direction === 'in' ? 'Mensagem do lead' : 'Mensagem enviada'}
                    >
                      <div className="msg-body">{msg.body}</div>
                      <div className="msg-time">{fmtTime(msg.created_at)}</div>
                    </div>
                  ))
                )}
                {/* Nota: mensagens 'out' não distinguem IA vs humano — aguarda Story 4.3
                    (campo 'author' na tabela messages). */}
              </div>

              {/* Formulário de resposta */}
              <form className="drawer-reply" onSubmit={(e) => void handleReply(e)}>
                <label htmlFor="drawer-reply-input" className="sr-only">
                  Responder como humano
                </label>
                <input
                  id="drawer-reply-input"
                  type="text"
                  className="drawer-reply-input"
                  placeholder="Responder como humano…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={replying}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={replying || !replyText.trim()}
                  aria-label="Enviar resposta"
                >
                  {replying ? (
                    <svg className="drawer-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <line x1="22" y1="2"  x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                  Enviar
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

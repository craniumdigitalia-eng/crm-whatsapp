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
  photo_url?: string | null;
  // Origem / atribuição (Story 5.14 — Meta Lead Ads). Opcionais.
  source?: string | null;
  form_id?: string | null;
  leadgen_id?: string | null;
  ad_id?: string | null;
  campaign_id?: string | null;
  form_data?: Record<string, string> | null;
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

// Story 5.12 — etiqueta aplicável aos leads.
interface Tag {
  id: string;
  name: string;
  color: string;
}

// Story 5.13 — item de checklist do lead.
interface ChecklistItem {
  id: string;
  lead_id: string;
  text: string;
  done: boolean;
  position: number;
}

// Paleta de cores para novas etiquetas (identidade Cranium roxo/violeta + apoios).
const TAG_COLORS = ['#7C3AED', '#6D28D9', '#A78BFA', '#2563EB', '#059669', '#D97706', '#DC2626', '#475569'];

/* ---- Helpers de avatar ---- */

const AVATAR_COLORS = ['#7C3AED', '#5B21B6', '#6D28D9', '#4C1D95', '#8B5CF6'];

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

/* ---- DrawerLeadAvatar ----
   Exibe a foto de perfil do WhatsApp quando disponível; cai nas
   iniciais coloridas se photo_url estiver ausente ou a imagem falhar. */

function DrawerLeadAvatar({
  photoUrl,
  name,
  phone,
}: {
  photoUrl?: string | null;
  name: string | null;
  phone: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = avatarColor(name, phone);
  const hasPhoto = Boolean(photoUrl) && !imgFailed;

  return (
    <div
      className="drawer-lead-avatar"
      style={{ background: hasPhoto ? 'transparent' : color }}
      aria-hidden="true"
    >
      {hasPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          className="avatar-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
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

// Rótulo amigável da origem do lead (Story 5.14).
function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    meta_lead_ads: 'Facebook / Meta Lead Ads',
    whatsapp: 'WhatsApp',
  };
  return map[source] ?? source;
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
    name: '', email: '', service_interest: '', budget: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Etiquetas (Story 5.12)
  const [leadTags,      setLeadTags     ] = useState<Tag[]>([]);
  const [allTags,       setAllTags      ] = useState<Tag[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName,    setNewTagName   ] = useState('');
  const [newTagColor,   setNewTagColor  ] = useState(TAG_COLORS[0]);
  const [tagBusy,       setTagBusy      ] = useState(false);

  // Checklist (Story 5.13)
  const [checklist,    setChecklist   ] = useState<ChecklistItem[]>([]);
  const [newItemText,  setNewItemText ] = useState('');
  const [addingItem,   setAddingItem  ] = useState(false);

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
        email:            data.lead.email           ?? '',
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

  /* Busca etiquetas (do lead + catalogo) e checklist. Story 5.12 / 5.13. */
  const fetchExtras = useCallback(async (id: string) => {
    try {
      const [leadTagsRes, allTagsRes, checklistRes] = await Promise.all([
        apiCall<{ tags: Tag[] }>(`/api/leads/${id}/tags`),
        apiCall<{ tags: Tag[] }>(`/api/tags`),
        apiCall<{ items: ChecklistItem[] }>(`/api/leads/${id}/checklist`),
      ]);
      setLeadTags(leadTagsRes.tags);
      setAllTags(allTagsRes.tags);
      setChecklist(checklistRes.items);
    } catch (e) {
      // Nao-critico: etiquetas/checklist sao secundarios ao corpo da conversa.
      console.warn('[drawer] falha ao carregar etiquetas/checklist:', (e as Error).message);
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
      setLeadTags([]);
      setAllTags([]);
      setChecklist([]);
      setTagPickerOpen(false);
      setNewTagName('');
      setNewItemText('');
      return;
    }
    void fetchLead(leadId);
    void fetchExtras(leadId);
  }, [leadId, fetchLead, fetchExtras]);

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

  /* ---- Etiquetas (Story 5.12) ---- */

  // Atribui ou remove uma etiqueta existente do lead (toggle no picker).
  const toggleTag = useCallback(async (tag: Tag) => {
    if (!leadId || tagBusy) return;
    const assigned = leadTags.some((t) => t.id === tag.id);
    setTagBusy(true);
    setActionError(null);
    try {
      const res = await apiCall<{ tags: Tag[] }>(`/api/leads/${leadId}/tags`, {
        method: assigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      });
      setLeadTags(res.tags);
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao alterar etiqueta');
    } finally {
      setTagBusy(false);
    }
  }, [leadId, leadTags, tagBusy, onLeadUpdated]);

  // Remove uma etiqueta do lead direto pelo chip (sem abrir o picker).
  const removeTag = useCallback(async (tag: Tag) => {
    if (!leadId || tagBusy) return;
    setTagBusy(true);
    setActionError(null);
    try {
      const res = await apiCall<{ tags: Tag[] }>(`/api/leads/${leadId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      });
      setLeadTags(res.tags);
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao remover etiqueta');
    } finally {
      setTagBusy(false);
    }
  }, [leadId, tagBusy, onLeadUpdated]);

  // Cria uma etiqueta nova no catalogo e ja aplica ao lead.
  const handleCreateTag = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name || !leadId || tagBusy) return;
    setTagBusy(true);
    setActionError(null);
    try {
      const { tag } = await apiCall<{ tag: Tag }>(`/api/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      setAllTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
      );
      const res = await apiCall<{ tags: Tag[] }>(`/api/leads/${leadId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      });
      setLeadTags(res.tags);
      setNewTagName('');
      onLeadUpdated();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao criar etiqueta');
    } finally {
      setTagBusy(false);
    }
  }, [newTagName, newTagColor, leadId, tagBusy, onLeadUpdated]);

  /* ---- Checklist (Story 5.13) ---- */

  const handleAddItem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text || !leadId || addingItem) return;
    setAddingItem(true);
    setActionError(null);
    try {
      const { item } = await apiCall<{ item: ChecklistItem }>(`/api/leads/${leadId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setChecklist((prev) => [...prev, item]);
      setNewItemText('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao adicionar item');
    } finally {
      setAddingItem(false);
    }
  }, [newItemText, leadId, addingItem]);

  const toggleItem = useCallback(async (item: ChecklistItem) => {
    // Otimista: alterna o done localmente antes do round-trip.
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await apiCall(`/api/checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !item.done }),
      });
    } catch (e) {
      // Reverte em caso de falha.
      setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      setActionError(e instanceof Error ? e.message : 'Erro ao atualizar item');
    }
  }, []);

  const deleteItem = useCallback(async (item: ChecklistItem) => {
    const prev = checklist;
    setChecklist((cur) => cur.filter((i) => i.id !== item.id));
    try {
      await apiCall(`/api/checklist/${item.id}`, { method: 'DELETE' });
    } catch (e) {
      setChecklist(prev); // restaura
      setActionError(e instanceof Error ? e.message : 'Erro ao remover item');
    }
  }, [checklist]);

  /* ---- Render ---- */

  if (!leadId) return null;

  const doneCount = checklist.filter((i) => i.done).length;
  const checklistPct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

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
          {lead && (
            <DrawerLeadAvatar
              photoUrl={lead.photo_url}
              name={lead.name}
              phone={lead.phone}
            />
          )}
          <div className="drawer-header-info">
            <span id="drawer-lead-name" className="drawer-lead-name">
              {lead ? (lead.name ?? lead.phone) : '—'}
            </span>
            {lead && (
              <span className="drawer-lead-phone">{lead.phone}</span>
            )}
            {lead?.email && (
              <span className="drawer-lead-email">{lead.email}</span>
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
                  <div className="drawer-ai-summary" aria-label="Resumo da IA">
                    <div className="drawer-ai-summary-head">
                      <span className="drawer-ai-summary-icon" aria-hidden="true">🧠</span>
                      <span className="drawer-ai-summary-title">Resumo da IA</span>
                    </div>
                    <div className="drawer-ai-summary-body">{lead.notes}</div>
                  </div>
                )}
              </div>

              {/* Origem / Formulário (Story 5.14 — Meta Lead Ads) */}
              {(lead.source || (lead.form_data && Object.keys(lead.form_data).length > 0)) && (
                <section className="drawer-section drawer-origin" aria-label="Origem e formulário do lead">
                  <div className="drawer-section-head">
                    <span className="drawer-section-title">📋 Origem / Formulário</span>
                  </div>

                  <dl className="drawer-origin-attrs">
                    {lead.source && (
                      <div className="drawer-origin-row">
                        <dt>Origem</dt>
                        <dd>{sourceLabel(lead.source)}</dd>
                      </div>
                    )}
                    {lead.campaign_id && (
                      <div className="drawer-origin-row">
                        <dt>Campanha</dt>
                        <dd className="drawer-origin-id">{lead.campaign_id}</dd>
                      </div>
                    )}
                    {lead.ad_id && (
                      <div className="drawer-origin-row">
                        <dt>Anúncio</dt>
                        <dd className="drawer-origin-id">{lead.ad_id}</dd>
                      </div>
                    )}
                    {lead.form_id && (
                      <div className="drawer-origin-row">
                        <dt>Formulário</dt>
                        <dd className="drawer-origin-id">{lead.form_id}</dd>
                      </div>
                    )}
                  </dl>

                  {lead.form_data && Object.keys(lead.form_data).length > 0 && (
                    <div className="drawer-form-data">
                      <span className="drawer-form-data-title">Respostas do formulário</span>
                      <dl className="drawer-form-list">
                        {Object.entries(lead.form_data).map(([question, answer]) => (
                          <div key={question} className="drawer-form-row">
                            <dt>{question}</dt>
                            <dd>{answer || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </section>
              )}

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
                    <label htmlFor="edit-email">E-mail</label>
                    <input
                      id="edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@exemplo.com"
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

              {/* Etiquetas (Story 5.12) */}
              <section className="drawer-section" aria-label="Etiquetas do lead">
                <div className="drawer-section-head">
                  <span className="drawer-section-title">Etiquetas</span>
                  <button
                    type="button"
                    className="drawer-section-add"
                    onClick={() => setTagPickerOpen((o) => !o)}
                    aria-expanded={tagPickerOpen}
                    aria-label={tagPickerOpen ? 'Fechar seletor de etiquetas' : 'Adicionar etiqueta'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5"  y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>

                <div className="drawer-tags">
                  {leadTags.length === 0 ? (
                    <span className="drawer-tags-empty">Nenhuma etiqueta.</span>
                  ) : (
                    leadTags.map((t) => (
                      <span key={t.id} className="drawer-tag-chip" style={{ background: t.color }}>
                        {t.name}
                        <button
                          type="button"
                          className="drawer-tag-remove"
                          onClick={() => void removeTag(t)}
                          disabled={tagBusy}
                          aria-label={`Remover etiqueta ${t.name}`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth={3} aria-hidden="true">
                            <line x1="18" y1="6"  x2="6"  y2="18"/>
                            <line x1="6"  y1="6"  x2="18" y2="18"/>
                          </svg>
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {tagPickerOpen && (
                  <div className="tag-picker" role="group" aria-label="Escolher ou criar etiqueta">
                    {allTags.length > 0 && (
                      <div className="tag-picker-list">
                        {allTags.map((t) => {
                          const active = leadTags.some((lt) => lt.id === t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              className={`tag-picker-item${active ? ' active' : ''}`}
                              onClick={() => void toggleTag(t)}
                              disabled={tagBusy}
                              aria-pressed={active}
                            >
                              <span className="tag-picker-dot" style={{ background: t.color }} aria-hidden="true" />
                              <span className="tag-picker-name">{t.name}</span>
                              {active && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth={3} aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <form className="tag-picker-create" onSubmit={(e) => void handleCreateTag(e)}>
                      <input
                        type="text"
                        className="tag-picker-input"
                        placeholder="Nova etiqueta"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        disabled={tagBusy}
                        aria-label="Nome da nova etiqueta"
                      />
                      <div className="tag-picker-colors" role="group" aria-label="Cor da etiqueta">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`tag-color-swatch${newTagColor === c ? ' active' : ''}`}
                            style={{ background: c }}
                            onClick={() => setNewTagColor(c)}
                            aria-pressed={newTagColor === c}
                            aria-label={`Cor ${c}`}
                          />
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary tag-picker-submit"
                        disabled={tagBusy || !newTagName.trim()}
                      >
                        Criar e aplicar
                      </button>
                    </form>
                  </div>
                )}
              </section>

              {/* Checklist (Story 5.13) */}
              <section className="drawer-section" aria-label="Checklist do lead">
                <div className="drawer-section-head">
                  <span className="drawer-section-title">Checklist</span>
                  {checklist.length > 0 && (
                    <span className="checklist-count">{doneCount}/{checklist.length}</span>
                  )}
                </div>

                {checklist.length > 0 && (
                  <div
                    className="checklist-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={checklist.length}
                    aria-valuenow={doneCount}
                    aria-label={`Progresso do checklist: ${doneCount} de ${checklist.length}`}
                  >
                    <div className="checklist-progress-bar" style={{ width: `${checklistPct}%` }} />
                  </div>
                )}

                {checklist.length > 0 && (
                  <ul className="checklist-items">
                    {checklist.map((item) => (
                      <li key={item.id} className={`checklist-item${item.done ? ' done' : ''}`}>
                        <label className="checklist-label">
                          <input
                            type="checkbox"
                            className="checklist-checkbox"
                            checked={item.done}
                            onChange={() => void toggleItem(item)}
                          />
                          <span className="checklist-text">{item.text}</span>
                        </label>
                        <button
                          type="button"
                          className="checklist-remove"
                          onClick={() => void deleteItem(item)}
                          aria-label={`Remover item ${item.text}`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <line x1="18" y1="6"  x2="6"  y2="18"/>
                            <line x1="6"  y1="6"  x2="18" y2="18"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form className="checklist-add" onSubmit={(e) => void handleAddItem(e)}>
                  <input
                    type="text"
                    className="checklist-add-input"
                    placeholder="Adicionar item…"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    disabled={addingItem}
                    aria-label="Novo item do checklist"
                  />
                  <button
                    type="submit"
                    className="checklist-add-btn"
                    disabled={addingItem || !newItemText.trim()}
                    aria-label="Adicionar item ao checklist"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5"  y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </form>
              </section>

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

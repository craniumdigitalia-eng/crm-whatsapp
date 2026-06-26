'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConversationDrawer from './ConversationDrawer';

/* ============================================================
   Types
   ============================================================ */

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  service_interest: string | null;
  budget: string | null;
  notes: string | null;
  last_message_at: string | null;
  follow_up_count: number;
  last_direction?: 'in' | 'out' | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

type FilterKey = 'all' | 'ia' | 'human';

/* ============================================================
   Funil
   ============================================================ */

const STAGES: Array<{ key: string; label: string; dotClass: string }> = [
  { key: 'novo',            label: 'Novo',           dotClass: 'dot-novo' },
  { key: 'em_atendimento',  label: 'Em atendimento', dotClass: 'dot-em_atendimento' },
  { key: 'qualificado',     label: 'Qualificado',    dotClass: 'dot-qualificado' },
  { key: 'proposta',        label: 'Proposta',       dotClass: 'dot-proposta' },
  { key: 'fechado',         label: 'Fechado',        dotClass: 'dot-fechado' },
  { key: 'perdido',         label: 'Perdido',        dotClass: 'dot-perdido' },
  { key: 'humano',          label: 'Atend. humano',  dotClass: 'dot-humano' },
];

const AI_STAGES = new Set(['novo', 'em_atendimento', 'qualificado']);

/* ============================================================
   Mock de demonstração — usado quando /api/leads está indisponível
   (next dev local sem credenciais Supabase)
   ============================================================ */

const MOCK_LEADS: Lead[] = [
  {
    id: 'demo-1',
    name: 'Ana Beatriz Souza',
    phone: '+55 11 98765-4321',
    status: 'novo',
    service_interest: 'PME · 8 vidas',
    budget: 'R$ 2.400/mês',
    notes: null,
    last_message_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    follow_up_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    name: 'Carlos Eduardo Lima',
    phone: '+55 21 99234-5678',
    status: 'em_atendimento',
    service_interest: 'Plano Individual',
    budget: 'R$ 680/mês',
    notes: null,
    last_message_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    follow_up_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    name: 'Mariana Ferreira',
    phone: '+55 31 98111-2233',
    status: 'qualificado',
    service_interest: 'Adesão Entidade',
    budget: 'R$ 1.100/mês',
    notes: null,
    last_message_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    name: 'Roberto Alves Pinto',
    phone: '+55 11 97654-3210',
    status: 'proposta',
    service_interest: 'PME · 15 vidas',
    budget: 'R$ 5.200/mês',
    notes: null,
    last_message_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    name: 'Fernanda Costa',
    phone: '+55 41 98000-1111',
    status: 'fechado',
    service_interest: 'PME · 3 vidas',
    budget: 'R$ 950/mês',
    notes: null,
    last_message_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-6',
    name: 'Paulo Henrique Braga',
    phone: '+55 85 99888-7766',
    status: 'humano',
    service_interest: 'Plano Individual',
    budget: null,
    notes: null,
    last_message_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    follow_up_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/* ============================================================
   Helpers
   ============================================================ */

const AVATAR_COLORS = ['#7C3AED', '#5B21B6', '#6D28D9', '#4C1D95', '#8B5CF6'];

function avatarColor(name: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Origem real do lead virá da integração Meta Lead Ads (stories 5.10 / 5.14).
// Até lá não exibimos nenhuma origem no card — origem inventada é enganosa.

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   LeadCard sub-component
   ============================================================ */

function LeadCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: (id: string, el: HTMLElement) => void;
}) {
  const isAI  = AI_STAGES.has(lead.status);
  const color = avatarColor(lead.name);
  const time  = relativeTime(lead.last_message_at);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    onOpen(lead.id, e.currentTarget);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(lead.id, e.currentTarget);
    }
  };

  return (
    <article
      className="lead-card"
      role="listitem"
      aria-label={`Lead: ${lead.name ?? lead.phone} — clique para abrir conversa`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="lead-card-head">
        <div
          className="lead-avatar"
          style={{ background: color }}
          aria-hidden="true"
        >
          {initials(lead.name)}
        </div>
        <div className="lead-card-info">
          <div className="lead-name">{esc(lead.name ?? 'Sem nome')}</div>
          <div className="lead-phone">{esc(lead.phone)}</div>
        </div>
      </div>

      {lead.tags && lead.tags.length > 0 && (
        <div className="lead-card-tags" aria-label="Etiquetas">
          {lead.tags.map((t) => (
            <span
              key={t.id}
              className="lead-tag-chip"
              style={{ background: t.color }}
              title={t.name}
            >
              {esc(t.name)}
            </span>
          ))}
        </div>
      )}

      <div className="lead-card-meta">
        {lead.service_interest && (
          <span className="tag tag-service">{esc(lead.service_interest)}</span>
        )}
        {lead.budget && (
          <span className="tag tag-budget">{esc(lead.budget)}</span>
        )}
        {/* Origem (Meta Lead Ads) será exibida aqui quando a integração existir — stories 5.10 / 5.14. */}
      </div>

      <div className="lead-card-footer">
        {isAI && (
          <span className="ai-indicator">
            <span className="ai-pulse" aria-hidden="true" />
            IA ativa
          </span>
        )}
        <span
          className="lead-time"
          aria-label={`Última mensagem: ${time} atrás`}
        >
          {time}
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   KanbanColumn sub-component
   ============================================================ */

function KanbanColumn({
  stage,
  leads,
  onOpen,
}: {
  stage: (typeof STAGES)[number];
  leads: Lead[];
  onOpen: (id: string, el: HTMLElement) => void;
}) {
  return (
    <div className="kanban-col" data-stage={stage.key}>
      <div className="col-header">
        <span className={`col-dot ${stage.dotClass}`} aria-hidden="true" />
        <span className="col-title">{stage.label}</span>
        <span
          className="col-count"
          aria-label={`${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`}
        >
          {leads.length}
        </span>
      </div>
      <div
        className="col-body"
        role="list"
        aria-label={`Leads em ${stage.label}`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
        ))}
        <button
          className="col-add"
          aria-label={`Adicionar lead em ${stage.label}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Skeleton loading
   ============================================================ */

function KanbanSkeleton() {
  return (
    <>
      {STAGES.map((stage, i) => (
        <div key={stage.key} className="kanban-col" data-stage={stage.key}>
          <div className="col-header">
            <span className={`col-dot ${stage.dotClass}`} aria-hidden="true" />
            <span className="col-title">{stage.label}</span>
            <span className="col-count">—</span>
          </div>
          <div className="col-body">
            {Array.from({ length: i < 2 ? 2 - i : 0 }).map((_, j) => (
              <div
                key={j}
                className="skeleton skeleton-card"
                style={{ opacity: 1 - j * 0.3 }}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ============================================================
   KanbanBoard (root export)
   ============================================================ */

export default function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  // Busca textual (nome ou telefone) — debounce leve para não filtrar a cada tecla.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Filtro por etiqueta (catálogo + seleção; match ANY).
  const [tagCatalog, setTagCatalog] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagFilterRef = useRef<HTMLDivElement | null>(null);

  // Drawer state
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const loadLeads = useCallback(async () => {
    let fetched: Lead[] = [];
    let usedMock = false;

    try {
      const res = await fetch('/api/leads', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { leads?: Lead[] };
      fetched = Array.isArray(data.leads) ? data.leads : [];
      if (fetched.length === 0) throw new Error('sem leads na API');
    } catch (err) {
      console.warn('[KanbanBoard] /api/leads indisponível — usando mock:', (err as Error).message);
      fetched  = MOCK_LEADS;
      usedMock = true;
    }

    setLeads(fetched);
    setIsMock(usedMock);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLeads();
    const interval = setInterval(() => { void loadLeads(); }, 15000);
    return () => clearInterval(interval);
  }, [loadLeads]);

  /* Debounce da busca (~200ms) — evita refiltrar a lista a cada tecla. */
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* Carrega o catálogo de etiquetas para o filtro (silencioso se indisponível). */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/tags', { signal: AbortSignal.timeout(5000) });
        if (res.status === 401) { window.location.href = '/login'; return; }
        if (!res.ok) return;
        const data = await res.json() as { tags?: Tag[] };
        if (active && Array.isArray(data.tags)) setTagCatalog(data.tags);
      } catch {
        /* sem catálogo → o filtro de etiqueta simplesmente não aparece */
      }
    })();
    return () => { active = false; };
  }, []);

  /* Fecha o dropdown de etiquetas ao clicar fora ou pressionar Escape. */
  useEffect(() => {
    if (!tagMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
        setTagMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTagMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [tagMenuOpen]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }, []);

  /* Abre o drawer e registra o elemento gatilho para restaurar foco ao fechar (AC2). */
  const handleOpenLead = useCallback((id: string, el: HTMLElement) => {
    lastFocusedRef.current = el;
    setOpenLeadId(id);
  }, []);

  /* Fecha o drawer e restaura foco ao card que o abriu (AC2). */
  const handleCloseDrawer = useCallback(() => {
    setOpenLeadId(null);
    requestAnimationFrame(() => {
      lastFocusedRef.current?.focus();
      lastFocusedRef.current = null;
    });
  }, []);

  /* Atualização otimista: move o card de coluna imediatamente (sem esperar refetch). */
  const handleOptimisticUpdate = useCallback((id: string, patch: { status?: string }) => {
    setLeads(prev =>
      prev.map(l => l.id === id ? { ...l, ...patch } : l)
    );
  }, []);

  /* Filtragem combinada (AND): chip de estágio-tipo E busca textual E etiquetas. */
  const query = search.trim().toLowerCase();
  const filtered = leads.filter((lead) => {
    // Chip Todos / IA ativa / Humano
    if (filter === 'ia'    && !AI_STAGES.has(lead.status)) return false;
    if (filter === 'human' && lead.status !== 'humano')    return false;

    // Busca por nome OU telefone (case-insensitive, contém)
    if (query) {
      const name  = (lead.name ?? '').toLowerCase();
      const phone = (lead.phone ?? '').toLowerCase();
      if (!name.includes(query) && !phone.includes(query)) return false;
    }

    // Etiquetas — mostra leads com pelo menos uma das selecionadas (match ANY)
    if (selectedTagIds.length > 0) {
      const leadTagIds = (lead.tags ?? []).map(t => t.id);
      if (!selectedTagIds.some(id => leadTagIds.includes(id))) return false;
    }

    return true;
  });

  const hasActiveFilter =
    filter !== 'all' || query !== '' || selectedTagIds.length > 0;

  /* Agrupa por estágio */
  const grouped: Record<string, Lead[]> = {};
  STAGES.forEach((s) => { grouped[s.key] = []; });
  filtered.forEach((lead) => {
    const key = lead.status in grouped ? lead.status : 'novo';
    grouped[key].push(lead);
  });

  const total = leads.length;
  const shown = filtered.length;
  const mode = isMock ? 'demonstração' : 'ao vivo';
  const countLabel = loading
    ? 'Carregando…'
    : hasActiveFilter
      ? `${shown} de ${total} lead${total !== 1 ? 's' : ''} · ${mode}`
      : `${total} lead${total !== 1 ? 's' : ''} · ${mode}`;

  return (
    <>
      <section className="kanban-wrapper" aria-label="Funil de leads CRM">

        {/* Toolbar / filtros rápidos */}
        <div className="kanban-toolbar">
          <div className="kanban-toolbar-left">
            <span
              className="kanban-lead-count"
              aria-live="polite"
              aria-atomic="true"
            >
              {countLabel}
            </span>

            {(
              [
                { key: 'all',   label: 'Todos'    },
                { key: 'ia',    label: 'IA ativa'  },
                { key: 'human', label: 'Humano'    },
              ] as Array<{ key: FilterKey; label: string }>
            ).map(({ key, label }) => (
              <button
                key={key}
                className={`filter-chip${filter === key ? ' active' : ''}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}

            {/* Busca textual — nome ou telefone */}
            <div className="kanban-search" role="search">
              <svg
                className="kanban-search-icon"
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.4} aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="kanban-search-input"
                placeholder="Buscar nome ou telefone…"
                aria-label="Buscar leads por nome ou telefone"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  className="kanban-search-clear"
                  aria-label="Limpar busca"
                  onClick={() => { setSearchInput(''); setSearch(''); }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filtro por etiqueta — escondido se não há catálogo (match ANY) */}
            {tagCatalog.length > 0 && (
              <div className="kanban-tag-filter" ref={tagFilterRef}>
                <button
                  type="button"
                  className={`filter-chip${selectedTagIds.length > 0 ? ' active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={tagMenuOpen}
                  onClick={() => setTagMenuOpen((o) => !o)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  Etiquetas
                  {selectedTagIds.length > 0 && (
                    <span className="kanban-tag-filter-badge">{selectedTagIds.length}</span>
                  )}
                </button>

                {tagMenuOpen && (
                  <div
                    className="kanban-tag-menu"
                    role="group"
                    aria-label="Filtrar por etiqueta"
                  >
                    {tagCatalog.map((tag) => {
                      const checked = selectedTagIds.includes(tag.id);
                      return (
                        <label key={tag.id} className="kanban-tag-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTag(tag.id)}
                          />
                          <span
                            className="kanban-tag-swatch"
                            style={{ background: tag.color }}
                            aria-hidden="true"
                          />
                          <span className="kanban-tag-option-name">{esc(tag.name)}</span>
                        </label>
                      );
                    })}
                    {selectedTagIds.length > 0 && (
                      <button
                        type="button"
                        className="kanban-tag-clear"
                        onClick={() => setSelectedTagIds([])}
                      >
                        Limpar etiquetas
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="kanban-toolbar-right">
            <button
              className="btn btn-ghost"
              onClick={() => { void loadLeads(); }}
              aria-label="Recarregar leads"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Atualizar
            </button>

            <button className="btn btn-primary" aria-label="Adicionar novo lead">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
              Novo Lead
            </button>
          </div>
        </div>

        {/* Board */}
        <div
          className="kanban-board"
          id="kanban-board"
          role="list"
          aria-label="Colunas do funil de vendas"
          aria-busy={loading}
        >
          {loading ? (
            <KanbanSkeleton />
          ) : (
            STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                leads={grouped[stage.key]}
                onOpen={handleOpenLead}
              />
            ))
          )}
        </div>

      </section>

      {/* Drawer de conversa — fora do <section> para overlay full-screen */}
      <ConversationDrawer
        leadId={openLeadId}
        onClose={handleCloseDrawer}
        onLeadUpdated={loadLeads}
        onOptimisticUpdate={handleOptimisticUpdate}
      />
    </>
  );
}

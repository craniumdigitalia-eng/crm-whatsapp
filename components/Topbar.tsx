'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { SidebarUser } from './Sidebar';

/* ============================================================
   Types
   ============================================================ */

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  service_interest: string | null;
}

interface AgendaEvent {
  id: string;
  summary: string;
  start: string;
}

/* ============================================================
   Etapas do funil — espelho de KanbanBoard.tsx
   ============================================================ */

const STAGES = [
  { key: 'novo',           label: 'Novo' },
  { key: 'em_atendimento', label: 'Em atendimento' },
  { key: 'qualificado',    label: 'Qualificado' },
  { key: 'proposta',       label: 'Proposta' },
  { key: 'fechado',        label: 'Fechado' },
  { key: 'perdido',        label: 'Perdido' },
  { key: 'humano',         label: 'Atend. humano' },
];

/* ============================================================
   Helpers
   ============================================================ */

interface Breadcrumb {
  page: string;
  sub?: string;
}

function getBreadcrumb(pathname: string): Breadcrumb {
  if (pathname.startsWith('/crm'))       return { page: 'CRM',          sub: 'Kanban' };
  if (pathname.startsWith('/leads'))     return { page: 'Leads' };
  if (pathname.startsWith('/bi'))        return { page: 'Métricas & BI' };
  if (pathname.startsWith('/agenda'))    return { page: 'Agenda' };
  if (pathname.startsWith('/whatsapp')) return { page: 'WhatsApp' };
  if (pathname.startsWith('/config'))   return { page: 'Config' };
  return { page: 'Dashboard' };
}

// Formata ISO para "DD/MM HH:MM" para exibir no dropdown de reuniões.
function fmtEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const h   = d.getHours().toString().padStart(2, '0');
    const m   = d.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes} ${h}:${m}`;
  } catch {
    return '—';
  }
}

/* ============================================================
   Topbar
   ============================================================ */

export default function Topbar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { page, sub } = getBreadcrumb(pathname);

  // --- Avatar dropdown ---
  const [avatarOpen,  setAvatarOpen]  = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // --- Busca ---
  const [searchInput,   setSearchInput]   = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [todosLeads,    setTodosLeads]    = useState<Lead[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- Notificações ---
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [reunioes,     setReunioes]     = useState<AgendaEvent[]>([]);
  const [leadsNovos,   setLeadsNovos]   = useState<Lead[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // --- Filtro de etapa ---
  const [filtroOpen, setFiltroOpen] = useState(false);
  const filtroRef = useRef<HTMLDivElement>(null);

  /* Fecha todos os dropdowns — usado no Esc global. */
  const fecharTodos = useCallback(() => {
    setAvatarOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
    setFiltroOpen(false);
  }, []);

  /* Fecha ao pressionar Esc. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharTodos(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fecharTodos]);

  /* Fecha ao clicar fora de cada dropdown. */
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (avatarOpen && avatarRef.current && !avatarRef.current.contains(t))
        setAvatarOpen(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(t))
        setSearchOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(t))
        setNotifOpen(false);
      if (filtroOpen && filtroRef.current && !filtroRef.current.contains(t))
        setFiltroOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [avatarOpen, searchOpen, notifOpen, filtroOpen]);

  /* ---- Avatar: logout (mesma lógica de LogoutButton.tsx) ---- */

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  /* ---- Busca: debounce ~250ms ---- */

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* Busca leads via GET /api/leads quando a query mudar. */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchOpen(false);
      setTodosLeads([]);
      return;
    }
    let active = true;
    setSearchLoading(true);
    setSearchOpen(true);
    (async () => {
      try {
        const res = await fetch('/api/leads', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { leads?: Lead[] } | Lead[];
        if (active) {
          const leads = Array.isArray(data)
            ? (data as Lead[])
            : Array.isArray((data as { leads?: Lead[] }).leads)
              ? (data as { leads: Lead[] }).leads
              : [];
          setTodosLeads(leads);
        }
      } catch {
        if (active) setTodosLeads([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    })();
    return () => { active = false; };
  }, [searchQuery]);

  /* Filtra client-side por nome, telefone ou serviço. */
  const searchResults = todosLeads.filter((lead) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    const nome  = (lead.name             ?? '').toLowerCase();
    const tel   = (lead.phone            ?? '').toLowerCase();
    const serv  = (lead.service_interest ?? '').toLowerCase();
    return nome.includes(q) || tel.includes(q) || serv.includes(q);
  });

  /* ---- Notificações: fetch ao abrir (e no mount para o badge) ---- */

  const fetchNotificacoes = useCallback(async () => {
    try {
      const agora   = new Date();
      const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [resEvts, resLeads] = await Promise.allSettled([
        fetch(
          `/api/agenda/events?from=${agora.toISOString()}&to=${em7dias.toISOString()}`,
          { signal: AbortSignal.timeout(5000) }
        ),
        fetch('/api/leads', { signal: AbortSignal.timeout(5000) }),
      ]);

      if (resEvts.status === 'fulfilled' && resEvts.value.ok) {
        const d = await resEvts.value.json() as { events?: AgendaEvent[] };
        setReunioes(Array.isArray(d.events) ? d.events : []);
      }

      if (resLeads.status === 'fulfilled' && resLeads.value.ok) {
        const d = await resLeads.value.json() as { leads?: Lead[] };
        const leads = Array.isArray(d.leads) ? d.leads : [];
        setLeadsNovos(leads.filter((l) => l.status === 'novo'));
      }
    } catch {
      /* erro silencioso — badge simplesmente não aparece */
    }
  }, []);

  /* Fetch inicial para exibir o badge antes de o dropdown ser aberto. */
  useEffect(() => {
    void fetchNotificacoes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasNotif = (reunioes.length + leadsNovos.length) > 0;

  const avatarInicial = user.nome.charAt(0).toUpperCase();

  return (
    <header className="topbar">

      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        <span className="topbar-page">{page}</span>
        {sub && (
          <>
            <span className="topbar-sep" aria-hidden="true">/</span>
            <span className="topbar-sub">{sub}</span>
          </>
        )}
      </div>

      {/* Busca */}
      <div className="topbar-search tb-search-wrap" role="search" ref={searchRef}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="#94A3B8" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          placeholder="Buscar lead, telefone, serviço…"
          aria-label="Buscar leads"
          aria-expanded={searchOpen}
          aria-autocomplete="list"
          aria-controls="tb-search-results"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
        />

        {searchOpen && (
          <div
            id="tb-search-results"
            className="tb-dropdown tb-search-results"
            role="listbox"
            aria-label="Resultados da busca"
          >
            {searchLoading ? (
              <div className="tb-dropdown-info">Buscando…</div>
            ) : searchResults.length === 0 ? (
              <div className="tb-dropdown-info">
                Nenhum resultado para &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.slice(0, 8).map((lead) => (
                <button
                  key={lead.id}
                  className="tb-search-item"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchInput('');
                    router.push(`/crm?lead=${lead.id}`);
                  }}
                >
                  <span className="tb-search-item-nome">
                    {lead.name ?? 'Sem nome'}
                  </span>
                  <span className="tb-search-item-meta">
                    {lead.phone}
                    {lead.service_interest ? ` · ${lead.service_interest}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="topbar-actions">

        {/* Sino — notificações */}
        <div className="tb-action-wrap" ref={notifRef}>
          <button
            className="icon-btn"
            aria-label={
              hasNotif
                ? `Notificações (${reunioes.length + leadsNovos.length})`
                : 'Notificações'
            }
            aria-haspopup="true"
            aria-expanded={notifOpen}
            onClick={() => {
              setNotifOpen((o) => {
                if (!o) void fetchNotificacoes();
                return !o;
              });
              setAvatarOpen(false);
              setSearchOpen(false);
              setFiltroOpen(false);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {hasNotif && <span className="notif-dot" aria-hidden="true" />}
          </button>

          {notifOpen && (
            <div
              className="tb-dropdown tb-notif-dropdown"
              role="menu"
              aria-label="Notificações"
            >
              <div className="tb-dropdown-header">Notificações</div>

              {reunioes.length === 0 && leadsNovos.length === 0 ? (
                <div className="tb-dropdown-info">Tudo em dia ✓</div>
              ) : (
                <>
                  {reunioes.length > 0 && (
                    <div className="tb-notif-secao">
                      <div className="tb-notif-secao-label">Próximas reuniões</div>
                      {reunioes.slice(0, 5).map((ev) => (
                        <div key={ev.id} className="tb-notif-item">
                          <span className="tb-notif-item-titulo">{ev.summary}</span>
                          <span className="tb-notif-item-sub">
                            {fmtEventDate(ev.start)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {leadsNovos.length > 0 && (
                    <div className="tb-notif-secao">
                      <div className="tb-notif-secao-label">Leads novos</div>
                      {leadsNovos.slice(0, 5).map((lead) => (
                        <button
                          key={lead.id}
                          className="tb-notif-item tb-notif-item--btn"
                          role="menuitem"
                          onClick={() => {
                            setNotifOpen(false);
                            router.push(`/crm?lead=${lead.id}`);
                          }}
                        >
                          <span className="tb-notif-item-titulo">
                            {lead.name ?? 'Sem nome'}
                          </span>
                          <span className="tb-notif-item-sub">{lead.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Filtro de etapa */}
        <div className="tb-action-wrap" ref={filtroRef}>
          <button
            className="icon-btn"
            aria-label="Filtrar por etapa"
            aria-haspopup="true"
            aria-expanded={filtroOpen}
            onClick={() => {
              setFiltroOpen((o) => !o);
              setAvatarOpen(false);
              setNotifOpen(false);
              setSearchOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>

          {filtroOpen && (
            <div
              className="tb-dropdown tb-filtro-dropdown"
              role="menu"
              aria-label="Filtrar por etapa"
            >
              <div className="tb-dropdown-header">Filtrar por etapa</div>
              <button
                className="tb-filtro-item tb-filtro-item--todas"
                role="menuitem"
                onClick={() => {
                  setFiltroOpen(false);
                  router.push('/crm');
                }}
              >
                Todas as etapas
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage.key}
                  className="tb-filtro-item"
                  role="menuitem"
                  onClick={() => {
                    setFiltroOpen(false);
                    router.push(`/crm?stage=${stage.key}`);
                  }}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avatar — menu de perfil */}
        <div className="tb-action-wrap" ref={avatarRef}>
          <div
            className="topbar-avatar"
            tabIndex={0}
            role="button"
            aria-label={`Perfil: ${user.nome}`}
            aria-haspopup="true"
            aria-expanded={avatarOpen}
            onClick={() => {
              setAvatarOpen((o) => !o);
              setNotifOpen(false);
              setFiltroOpen(false);
              setSearchOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAvatarOpen((o) => !o);
              }
            }}
          >
            {avatarInicial}
          </div>

          {avatarOpen && (
            <div
              className="tb-dropdown tb-avatar-dropdown"
              role="menu"
              aria-label="Menu do usuário"
            >
              {/* Info do usuário */}
              <div className="tb-avatar-usuario">
                <div className="tb-avatar-usuario-nome">{user.nome}</div>
                <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '2px' }}>
                  {user.email}
                </div>
              </div>

              {/* Meu perfil → /config */}
              <Link
                href="/config"
                className="tb-avatar-item"
                role="menuitem"
                onClick={() => setAvatarOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Meu perfil
              </Link>

              {/* Sair — mesma lógica de LogoutButton.tsx */}
              <button
                type="button"
                className="tb-avatar-item tb-avatar-item--perigo"
                role="menuitem"
                disabled={loggingOut}
                onClick={handleLogout}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                {loggingOut ? 'Saindo…' : 'Sair'}
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

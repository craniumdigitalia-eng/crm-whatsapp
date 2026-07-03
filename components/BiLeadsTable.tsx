'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ConversationDrawer from './ConversationDrawer';

/* ============================================================
   Tabela de leads dentro do BI.
   Lista TODOS os leads com busca (nome/telefone/interesse), filtro
   por status e ordenação. Clicar numa linha abre o ConversationDrawer
   (mesmo do Kanban) para trabalhar o lead. Consolidado no painel de BI
   a pedido: métricas em cima, operação dos leads embaixo.
   Estado vazio honesto, sem mock.
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
  last_message_at: string | null;
  follow_up_count: number;
  last_direction?: 'in' | 'out' | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  photo_url?: string | null;
}

type SortKey = 'recent' | 'name' | 'status';

// Tempo relativo curto para a coluna "última atividade".
function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function BiLeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/leads', { signal: AbortSignal.timeout(8000) });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { leads?: Lead[]; statusLabels?: Record<string, string> };
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      if (data.statusLabels) setStatusLabels(data.statusLabels);
      setError(null);
    } catch {
      setError('Não foi possível carregar os leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 20000);
    return () => clearInterval(i);
  }, [load]);

  // Debounce da busca (~200ms).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (q) {
        const n = (l.name ?? '').toLowerCase();
        const p = (l.phone ?? '').toLowerCase();
        const s = (l.service_interest ?? '').toLowerCase();
        if (!n.includes(q) && !p.includes(q) && !s.includes(q)) return false;
      }
      return true;
    });
    const ts = (l: Lead) => new Date(l.last_message_at ?? l.created_at).getTime();
    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => ts(b) - ts(a));
    else if (sort === 'name')
      sorted.sort((a, b) => (a.name ?? a.phone).localeCompare(b.name ?? b.phone, 'pt-BR'));
    else if (sort === 'status') sorted.sort((a, b) => a.status.localeCompare(b.status));
    return sorted;
  }, [leads, search, statusFilter, sort]);

  const statusOptions = useMemo(() => Object.entries(statusLabels), [statusLabels]);

  return (
    <section className="bi-panel bi-leads" aria-labelledby="bi-leads-h">
      <div className="bi-leads-head">
        <h2 className="bi-panel-title" id="bi-leads-h">
          Todos os leads
        </h2>
        <span className="bi-leads-count">
          {filtered.length} de {leads.length}
        </span>
      </div>

      <div className="bi-leads-toolbar">
        <input
          className="bi-leads-search"
          type="search"
          placeholder="Buscar por nome, telefone ou interesse…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar leads"
        />
        <select
          className="bi-leads-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="all">Todos os status</option>
          {statusOptions.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="bi-leads-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar leads"
        >
          <option value="recent">Mais recentes</option>
          <option value="name">Nome (A-Z)</option>
          <option value="status">Status</option>
        </select>
      </div>

      {error && (
        <p className="bi-empty">
          {error}{' '}
          <button type="button" className="bi-retry" onClick={() => load()}>
            Tentar de novo
          </button>
        </p>
      )}
      {loading && leads.length === 0 && !error && <p className="bi-empty">Carregando leads…</p>}
      {!loading && !error && leads.length === 0 && (
        <p className="bi-empty">
          Nenhum lead ainda. Eles aparecem aqui automaticamente conforme chegam pelo WhatsApp e pelas
          campanhas.
        </p>
      )}
      {!error && filtered.length === 0 && leads.length > 0 && (
        <p className="bi-empty">Nenhum lead encontrado com esses filtros.</p>
      )}

      {filtered.length > 0 && (
        <div className="bi-leads-table-wrap">
          <table className="bi-leads-table">
            <thead>
              <tr>
                <th scope="col">Lead</th>
                <th scope="col">Status</th>
                <th scope="col">Interesse</th>
                <th scope="col">Última atividade</th>
                <th scope="col">Follow-ups</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="bi-leads-row"
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir conversa de ${l.name?.trim() || l.phone}`}
                  onClick={() => setOpenLeadId(l.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenLeadId(l.id);
                    }
                  }}
                >
                  <td className="bi-leads-name-cell">
                    <span className="bi-leads-name">{l.name?.trim() || 'Sem nome'}</span>
                    <span className="bi-leads-phone">{l.phone}</span>
                  </td>
                  <td>
                    <span className="bi-lead-badge">
                      <span className={`bi-dot dot-${l.status}`} aria-hidden="true" />
                      {statusLabels[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className="bi-leads-interest">{l.service_interest?.trim() || '—'}</td>
                  <td className="bi-leads-when">{fmtWhen(l.last_message_at)}</td>
                  <td className="bi-leads-fu">{l.follow_up_count > 0 ? l.follow_up_count : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConversationDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} onLeadUpdated={load} />
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/* ============================================================
   Grupos — lista todos os grupos de WhatsApp da Cranium (Evolution),
   com nº de membros e as demandas (abertas/total) de cada grupo.
   Busca por nome. Identidade Cranium. PT-BR.
   ============================================================ */

interface Group {
  jid: string;
  name: string;
  size: number;
  demandsOpen: number;
  demandsTotal: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'G';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export default function GruposList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ groups: Group[] }>('/api/groups');
      setGroups(data.groups ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const totalMembros = useMemo(() => groups.reduce((s, g) => s + g.size, 0), [groups]);

  return (
    <section className="fin" aria-busy={loading}>
      <header className="bi-head">
        <div>
          <h1 className="bi-title">Grupos</h1>
          <p className="bi-subtitle">Todos os grupos de WhatsApp da Cranium</p>
        </div>
        <button type="button" className="bi-period-btn" onClick={() => load()}>Atualizar</button>
      </header>

      {error && (
        <div className="bi-error" role="alert">
          Não foi possível carregar os grupos: {error}
          <button type="button" className="bi-retry" onClick={() => load()}>Tentar de novo</button>
        </div>
      )}
      {loading && groups.length === 0 && !error && <div className="bi-loading">Carregando grupos…</div>}

      {!error && groups.length > 0 && (
        <>
          <div className="grp-toolbar">
            <input
              className="bi-leads-search"
              type="search"
              placeholder="Buscar grupo pelo nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar grupo"
            />
            <span className="grp-count">
              {filtered.length} de {groups.length} grupos · {totalMembros} membros no total
            </span>
          </div>

          <div className="grp-grid">
            {filtered.map((g) => (
              <div className="grp-card" key={g.jid}>
                <div className="grp-avatar" aria-hidden="true">{initials(g.name)}</div>
                <div className="grp-info">
                  <span className="grp-name">{g.name}</span>
                  <span className="grp-sub">{g.size} membro{g.size === 1 ? '' : 's'}</span>
                </div>
                {g.demandsOpen > 0 ? (
                  <span className="grp-demands grp-demands--open" title={`${g.demandsTotal} demanda(s) no total`}>
                    {g.demandsOpen} aberta{g.demandsOpen === 1 ? '' : 's'}
                  </span>
                ) : g.demandsTotal > 0 ? (
                  <span className="grp-demands" title="Todas concluídas ou em andamento">
                    {g.demandsTotal} demanda{g.demandsTotal === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            ))}
            {filtered.length === 0 && <p className="bi-empty">Nenhum grupo encontrado com esse nome.</p>}
          </div>
        </>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="bi-empty-banner" role="status">
          <strong>Nenhum grupo encontrado.</strong> Confirme que o WhatsApp está conectado (aba WhatsApp)
          e que o número participa de grupos.
        </div>
      )}
    </section>
  );
}

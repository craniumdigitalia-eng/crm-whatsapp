'use client';

import { useCallback, useEffect, useState } from 'react';

/* ============================================================
   Quadro de Demandas (kanban) — demandas postadas nos grupos de
   WhatsApp (gatilho "demanda"), resumidas e classificadas pela IA.
   Colunas: Aberta -> Em andamento -> Concluída. PT-BR.
   ============================================================ */

type DemandStatus = 'aberta' | 'andamento' | 'concluida';

interface Demand {
  id: string;
  group_jid: string;
  group_name: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  category: string;
  summary: string;
  original_text: string | null;
  status: DemandStatus;
  created_at: string;
}

const COLUMNS: { key: DemandStatus; label: string }[] = [
  { key: 'aberta', label: 'Aberta' },
  { key: 'andamento', label: 'Em andamento' },
  { key: 'concluida', label: 'Concluída' },
];

function fmtWhen(iso: string): string {
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

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}
async function apiSend(url: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
}

export default function DemandasBoard() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ demands: Demand[] }>('/api/demands');
      setDemands(data.demands ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 20000);
    return () => clearInterval(i);
  }, [load]);

  const move = async (d: Demand, status: DemandStatus) => {
    setDemands((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x))); // otimista
    try { await apiSend(`/api/demands/${d.id}`, 'PATCH', { status }); } catch { void load(); }
  };
  const remove = async (d: Demand) => {
    if (!confirm('Remover esta demanda do quadro?')) return;
    setDemands((prev) => prev.filter((x) => x.id !== d.id));
    try { await apiSend(`/api/demands/${d.id}`, 'DELETE'); } catch { void load(); }
  };

  return (
    <section className="fin" aria-busy={loading}>
      <header className="bi-head">
        <div>
          <h1 className="bi-title">Demandas</h1>
          <p className="bi-subtitle">Pedidos dos clientes nos grupos de WhatsApp (gatilho: &quot;demanda&quot;)</p>
        </div>
        <button type="button" className="bi-period-btn" onClick={() => load()}>Atualizar</button>
      </header>

      {error && (
        <div className="bi-error" role="alert">
          Não foi possível carregar: {error}
          <button type="button" className="bi-retry" onClick={() => load()}>Tentar de novo</button>
        </div>
      )}
      {loading && demands.length === 0 && !error && <div className="bi-loading">Carregando demandas…</div>}
      {!loading && !error && demands.length === 0 && (
        <div className="bi-empty-banner" role="status">
          <strong>Nenhuma demanda ainda.</strong> Quando um cliente escrever &quot;demanda&quot; num grupo,
          a IA resume, classifica e o card aparece aqui automaticamente.
        </div>
      )}

      <div className="dem-board">
        {COLUMNS.map((col) => {
          const cards = demands.filter((d) => d.status === col.key);
          return (
            <div className="dem-col" key={col.key}>
              <div className={`dem-col-head dem-head-${col.key}`}>
                <span>{col.label}</span>
                <span className="dem-col-count">{cards.length}</span>
              </div>
              <div className="dem-col-body">
                {cards.map((d) => (
                  <div className="dem-card" key={d.id}>
                    <div className="dem-card-top">
                      <span className="dem-cat">{d.category}</span>
                      <button className="fin-del" onClick={() => remove(d)} aria-label="Remover demanda">×</button>
                    </div>
                    <p className="dem-summary">{d.summary}</p>
                    <div className="dem-meta">
                      <span className="dem-group">{d.group_name || 'Grupo'}</span>
                      {d.sender_name && <span className="dem-sender">· {d.sender_name}</span>}
                      <span className="dem-when">· {fmtWhen(d.created_at)}</span>
                    </div>
                    <div className="dem-actions">
                      {col.key !== 'aberta' && (
                        <button className="dem-move" onClick={() => move(d, prevStatus(col.key))}>← {colLabel(prevStatus(col.key))}</button>
                      )}
                      {col.key !== 'concluida' && (
                        <button className="dem-move dem-move--fwd" onClick={() => move(d, nextStatus(col.key))}>{colLabel(nextStatus(col.key))} →</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function nextStatus(s: DemandStatus): DemandStatus {
  return s === 'aberta' ? 'andamento' : 'concluida';
}
function prevStatus(s: DemandStatus): DemandStatus {
  return s === 'concluida' ? 'andamento' : 'aberta';
}
function colLabel(s: DemandStatus): string {
  return COLUMNS.find((c) => c.key === s)?.label ?? s;
}

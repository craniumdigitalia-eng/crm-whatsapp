'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================
   Grupos — inbox estilo WhatsApp, só de grupos. Usa as MESMAS
   classes visuais da aba Conversas (conv-*) para ficar idêntico
   (roxo/violeta Cranium). Histórico guardado a partir de agora.
   ============================================================ */

interface Group {
  jid: string;
  name: string;
  size: number;
  demandsOpen: number;
  lastBody: string | null;
  lastAt: string | null;
  lastDirection: string | null;
}
interface GMessage {
  id: string;
  direction: 'in' | 'out';
  sender_name: string | null;
  body: string;
  created_at: string;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? 'G') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
const AVATAR_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#7C3AED,#2D0F52)', color: '#fff', fontWeight: 700, fontSize: 14,
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nao autenticado'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export default function GruposInbox() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selJid, setSelJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<GMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const loadGroups = useCallback(async () => {
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
  useEffect(() => {
    void loadGroups();
    const i = setInterval(() => void loadGroups(), 15000);
    return () => clearInterval(i);
  }, [loadGroups]);

  const loadMessages = useCallback(async (jid: string, spin = true) => {
    if (spin) setLoadingMsgs(true);
    try {
      const data = await apiGet<{ messages: GMessage[] }>(`/api/groups/messages?jid=${encodeURIComponent(jid)}`);
      setMessages(data.messages ?? []);
    } catch { /* silencioso */ } finally { setLoadingMsgs(false); }
  }, []);
  useEffect(() => {
    if (!selJid) return;
    void loadMessages(selJid);
    const i = setInterval(() => void loadMessages(selJid, false), 10000);
    return () => clearInterval(i);
  }, [selJid, loadMessages]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const selected = groups.find((g) => g.jid === selJid) ?? null;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text || !selJid || sending) return;
    setSending(true);
    const optimistic: GMessage = { id: `tmp-${Date.now()}`, direction: 'out', sender_name: 'Você', body: text, created_at: new Date().toISOString() };
    setMessages((p) => [...p, optimistic]);
    setReply('');
    try {
      const res = await fetch('/api/groups/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: selJid, text }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      await loadMessages(selJid, false);
      void loadGroups();
    } catch (err) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      setReply(text);
      alert('Erro ao enviar: ' + (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/groups/refresh', { method: 'POST' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      await loadGroups();
    } catch { /* silencioso */ } finally { setRefreshing(false); }
  };

  const shellClass = `conv-shell${selJid ? ' conv-shell--chat-open' : ''}`;

  return (
    <div className={shellClass}>
      {/* Lista de grupos */}
      <aside className="conv-list" aria-label="Lista de grupos">
        <div className="conv-list-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="conv-list-title">Grupos</h1>
          <button type="button" className="conv-btn conv-btn--ghost" onClick={refresh} disabled={refreshing} title="Buscar grupos novos na Evolution (pode demorar)">
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
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
            placeholder="Buscar grupo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar grupo"
          />
        </div>

        <div className="conv-list-body" role="list">
          {loading && groups.length === 0 ? (
            <div className="conv-list-state" aria-busy="true">Carregando grupos…</div>
          ) : error && groups.length === 0 ? (
            <div className="conv-list-state" role="alert">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="conv-list-state">{search ? 'Nenhum grupo encontrado.' : 'Nenhum grupo.'}</div>
          ) : (
            filtered.map((g) => {
              const active = g.jid === selJid;
              return (
                <button
                  key={g.jid}
                  type="button"
                  role="listitem"
                  className={`conv-item${active ? ' active' : ''}`}
                  onClick={() => setSelJid(g.jid)}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Grupo ${g.name}`}
                >
                  <div className="conv-avatar" style={AVATAR_STYLE} aria-hidden="true">{initials(g.name)}</div>
                  <span className="conv-item-main">
                    <span className="conv-item-top">
                      <span className="conv-item-name">{g.name}</span>
                      <span className="conv-item-time">{relTime(g.lastAt)}</span>
                    </span>
                    <span className="conv-item-bottom">
                      <span className="conv-item-preview">
                        {g.lastBody ? (g.lastDirection === 'out' ? 'Você: ' : '') + g.lastBody : `${g.size} membros`}
                      </span>
                    </span>
                    {g.demandsOpen > 0 && (
                      <span className="conv-item-tags">
                        <span className="conv-ia-pill"><span className="conv-ia-dot" aria-hidden="true" />{g.demandsOpen} demanda{g.demandsOpen === 1 ? '' : 's'}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Conversa do grupo */}
      <section className="conv-chat" aria-label="Grupo selecionado">
        {!selected ? (
          <div className="conv-empty">Selecione um grupo para ver as mensagens.</div>
        ) : (
          <>
            <header className="conv-chat-head">
              <button type="button" className="conv-back" onClick={() => setSelJid(null)} aria-label="Voltar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="conv-avatar conv-chat-avatar" style={AVATAR_STYLE} aria-hidden="true">{initials(selected.name)}</div>
              <div className="conv-chat-id">
                <span className="conv-chat-name">{selected.name}</span>
                <span className="conv-chat-phone">{selected.size} membros</span>
              </div>
            </header>

            <div className="conv-chat-body" ref={bodyRef} aria-label="Mensagens do grupo" aria-live="polite">
              {loadingMsgs && messages.length === 0 ? (
                <div className="conv-chat-state">Carregando…</div>
              ) : messages.length === 0 ? (
                <div className="conv-chat-state">
                  Sem mensagens ainda. As mensagens deste grupo aparecem aqui conforme chegam.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`conv-bubble conv-bubble--${m.direction}`}>
                    {m.direction === 'in' && m.sender_name && (
                      <div className="conv-bubble-sender">{m.sender_name}</div>
                    )}
                    <div className="conv-bubble-body">{m.body}</div>
                    <div className="conv-bubble-time">{hhmm(m.created_at)}</div>
                  </div>
                ))
              )}
            </div>

            <form className="conv-reply" onSubmit={send}>
              <input
                className="conv-reply-input"
                placeholder="Escreva uma mensagem para o grupo…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={sending}
              />
              <button type="submit" className="conv-send" disabled={sending || !reply.trim()}>
                {sending ? '...' : 'Enviar'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

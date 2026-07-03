'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================
   Grupos — inbox estilo WhatsApp, só de grupos. Lista de grupos à
   esquerda, conversa do grupo à direita (mensagens + responder).
   O histórico é o que guardamos daqui pra frente (a Evolution não
   persiste histórico de grupo). PT-BR.
   ============================================================ */

interface Group {
  jid: string;
  name: string;
  size: number;
  demandsOpen: number;
  demandsTotal: number;
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
    } catch {
      /* silencioso */
    } finally {
      setLoadingMsgs(false);
    }
  }, []);
  useEffect(() => {
    if (!selJid) return;
    void loadMessages(selJid);
    const i = setInterval(() => void loadMessages(selJid, false), 10000);
    return () => clearInterval(i);
  }, [selJid, loadMessages]);

  // Rola pro fim quando as mensagens mudam.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const selected = groups.find((g) => g.jid === selJid) ?? null;

  const send = async () => {
    const text = reply.trim();
    if (!text || !selJid || sending) return;
    setSending(true);
    const optimistic: GMessage = {
      id: `tmp-${Date.now()}`,
      direction: 'out',
      sender_name: 'Você',
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setReply('');
    try {
      const res = await fetch('/api/groups/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: selJid, text }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      await loadMessages(selJid, false);
      void loadGroups();
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      setReply(text);
      alert('Erro ao enviar: ' + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`grp-inbox${selJid ? ' has-selection' : ''}`}>
      {/* Lista de grupos */}
      <aside className="grp-list">
        <div className="grp-list-head">
          <h1 className="grp-list-title">Grupos</h1>
          <input
            className="bi-leads-search"
            type="search"
            placeholder="Buscar grupo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar grupo"
          />
        </div>
        {error && <div className="conv-error" role="alert">{error}</div>}
        {loading && groups.length === 0 && <div className="grp-list-state">Carregando grupos…</div>}
        <div className="grp-list-rows">
          {filtered.map((g) => (
            <button
              key={g.jid}
              className={`grp-row${g.jid === selJid ? ' is-active' : ''}`}
              type="button"
              onClick={() => setSelJid(g.jid)}
            >
              <div className="grp-avatar" aria-hidden="true">{initials(g.name)}</div>
              <div className="grp-row-main">
                <div className="grp-row-top">
                  <span className="grp-row-name">{g.name}</span>
                  <span className="grp-row-time">{relTime(g.lastAt)}</span>
                </div>
                <div className="grp-row-bottom">
                  <span className="grp-row-preview">
                    {g.lastBody ? (g.lastDirection === 'out' ? 'Você: ' : '') + g.lastBody : `${g.size} membros`}
                  </span>
                  {g.demandsOpen > 0 && <span className="grp-row-badge">{g.demandsOpen}</span>}
                </div>
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && <div className="grp-list-state">Nenhum grupo.</div>}
        </div>
      </aside>

      {/* Conversa do grupo */}
      <main className="grp-chat">
        {!selected ? (
          <div className="grp-chat-empty">Selecione um grupo para ver as mensagens.</div>
        ) : (
          <>
            <header className="conv-chat-head">
              <button type="button" className="conv-back" onClick={() => setSelJid(null)} aria-label="Voltar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="grp-avatar" aria-hidden="true">{initials(selected.name)}</div>
              <div className="conv-chat-id">
                <span className="conv-chat-name">{selected.name}</span>
                <span className="conv-chat-phone">{selected.size} membros</span>
              </div>
            </header>

            <div className="conv-chat-body grp-chat-body" ref={bodyRef} aria-label="Mensagens do grupo">
              {loadingMsgs && messages.length === 0 ? (
                <div className="conv-chat-state">Carregando…</div>
              ) : messages.length === 0 ? (
                <div className="conv-chat-state">
                  Sem mensagens ainda. As mensagens deste grupo aparecem aqui conforme chegam
                  (o histórico começa a partir de agora).
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`grp-bubble ${m.direction === 'out' ? 'grp-bubble--out' : 'grp-bubble--in'}`}>
                    {m.direction === 'in' && m.sender_name && (
                      <span className="grp-bubble-sender">{m.sender_name}</span>
                    )}
                    <span className="grp-bubble-text">{m.body}</span>
                    <span className="grp-bubble-time">{hhmm(m.created_at)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="grp-composer">
              <input
                className="grp-composer-input"
                placeholder="Escreva uma mensagem para o grupo…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                disabled={sending}
              />
              <button className="fin-btn" type="button" onClick={send} disabled={sending || !reply.trim()}>
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </main>
    </section>
  );
}

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
  pictureUrl?: string | null;
  demandsOpen: number;
  lastBody: string | null;
  lastAt: string | null;
  lastDirection: string | null;
}
interface GMessage {
  id: string;
  external_id?: string | null;
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

// Avatar do grupo: foto real se disponivel, fallback para iniciais se URL vazia ou com erro.
function GroupAvatar({ group, style, className }: { group: Group; style?: React.CSSProperties; className?: string }) {
  const [imgError, setImgError] = useState(false);
  // Reseta o erro quando a pictureUrl mudar (ex: apos refresh).
  useEffect(() => { setImgError(false); }, [group.pictureUrl]);

  if (group.pictureUrl && !imgError) {
    return (
      <img
        src={group.pictureUrl}
        alt={`Foto do grupo ${group.name}`}
        className={className}
        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={`conv-avatar${className ? ` ${className}` : ''}`} style={{ ...AVATAR_STYLE, ...style }} aria-hidden="true">
      {initials(group.name)}
    </div>
  );
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
  // Aviso de exclusao: 'all' (apagou pra todos), 'crmOnly' (so no CRM), null (nenhum).
  const [deleteNotice, setDeleteNotice] = useState<'all' | 'crmOnly' | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Carrega a lista de grupos. Evita piscar: so atualiza o estado se o conteudo mudou
  // (compara pelo lastAt + jid da ultima mensagem de cada grupo).
  const loadGroups = useCallback(async (spin = false) => {
    try {
      const data = await apiGet<{ groups: Group[] }>('/api/groups');
      const incoming = data.groups ?? [];
      setGroups((prev) => {
        // Compara fingerprint simples: jids + lastAt de cada grupo, nessa ordem.
        const fp = (arr: Group[]) => arr.map((g) => `${g.jid}:${g.lastAt ?? ''}`).join('|');
        if (fp(prev) === fp(incoming)) return prev; // sem mudanca, evita re-render
        return incoming;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao carregar');
    } finally {
      if (spin) setLoading(false);
    }
  }, []);

  // Carga inicial (com spinner) e polling a cada 10s.
  useEffect(() => {
    setLoading(true);
    void loadGroups(true);
    const i = setInterval(() => void loadGroups(false), 10_000);
    return () => clearInterval(i);
  }, [loadGroups]);

  // Carrega o historico da conversa aberta. spin=false para polling silencioso.
  const loadMessages = useCallback(async (jid: string, spin = true) => {
    if (spin) setLoadingMsgs(true);
    try {
      const data = await apiGet<{ messages: GMessage[] }>(`/api/groups/messages?jid=${encodeURIComponent(jid)}`);
      const incoming = data.messages ?? [];
      setMessages((prev) => {
        // Evita re-render se nenhuma mensagem nova chegou (compara pelo id do ultimo item).
        const lastPrev = prev[prev.length - 1]?.id;
        const lastNew = incoming[incoming.length - 1]?.id;
        if (lastPrev === lastNew && prev.length === incoming.length) return prev;
        return incoming;
      });
    } catch { /* silencioso */ } finally { setLoadingMsgs(false); }
  }, []);

  // Polling da conversa aberta a cada 5s; reinicia quando o grupo muda.
  useEffect(() => {
    if (!selJid) return;
    void loadMessages(selJid);
    const i = setInterval(() => void loadMessages(selJid, false), 5_000);
    return () => clearInterval(i);
  }, [selJid, loadMessages]);

  // Scroll automatico ao chegar novas mensagens.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  // Esconde o aviso de exclusao apos 4s.
  useEffect(() => {
    if (!deleteNotice) return;
    const t = setTimeout(() => setDeleteNotice(null), 4000);
    return () => clearTimeout(t);
  }, [deleteNotice]);

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
      void loadGroups(false);
    } catch (err) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      setReply(text);
      alert('Erro ao enviar: ' + (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Apaga uma mensagem. Remocao otimista imediata; avisa se foi so no CRM.
  const deleteMessage = async (msg: GMessage) => {
    setMessages((p) => p.filter((m) => m.id !== msg.id));
    try {
      const res = await fetch('/api/groups/messages', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json().catch(() => ({})) as { crmOnly?: boolean };
      if (json.crmOnly) {
        setDeleteNotice('crmOnly');
      } else {
        setDeleteNotice('all');
      }
    } catch {
      // Silencioso: a mensagem ja foi removida da UI (otimista).
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/groups/refresh', { method: 'POST' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      await loadGroups(false);
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
                  <GroupAvatar group={g} />
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
              <GroupAvatar group={selected} className="conv-chat-avatar" />
              <div className="conv-chat-id">
                <span className="conv-chat-name">{selected.name}</span>
                <span className="conv-chat-phone">{selected.size} membros</span>
              </div>
            </header>

            {/* Aviso de exclusao: aparece 4s e some automaticamente */}
            {deleteNotice && (
              <div
                role="status"
                style={{
                  padding: '6px 12px', margin: '4px 12px', borderRadius: 6,
                  background: deleteNotice === 'crmOnly' ? '#FEF3C7' : '#D1FAE5',
                  color: deleteNotice === 'crmOnly' ? '#92400E' : '#065F46',
                  fontSize: 12, textAlign: 'center',
                }}
              >
                {deleteNotice === 'crmOnly'
                  ? 'Mensagem removida apenas aqui. O WhatsApp nao permite apagar mensagem de terceiros.'
                  : 'Mensagem apagada para todos.'}
              </div>
            )}

            <div className="conv-chat-body" ref={bodyRef} aria-label="Mensagens do grupo" aria-live="polite">
              {loadingMsgs && messages.length === 0 ? (
                <div className="conv-chat-state">Carregando…</div>
              ) : messages.length === 0 ? (
                <div className="conv-chat-state">
                  Sem mensagens ainda. As mensagens deste grupo aparecem aqui conforme chegam.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`conv-bubble conv-bubble--${m.direction}`} style={{ position: 'relative' }}>
                    {m.direction === 'in' && m.sender_name && (
                      <div className="conv-bubble-sender">{m.sender_name}</div>
                    )}
                    <div className="conv-bubble-body">{m.body}</div>
                    <div className="conv-bubble-time">{hhmm(m.created_at)}</div>
                    {/* Botao de apagar: aparece ao passar o mouse (hover via CSS conv-bubble:hover .conv-delete-btn) */}
                    <button
                      type="button"
                      className="conv-delete-btn"
                      title={m.direction === 'out' ? 'Apagar para todos' : 'Remover daqui'}
                      aria-label="Apagar mensagem"
                      onClick={() => { void deleteMessage(m); }}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 4,
                        padding: '2px 5px', cursor: 'pointer', fontSize: 11,
                        opacity: 0, transition: 'opacity 0.15s',
                        color: '#fff',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0'; }}
                    >
                      apagar
                    </button>
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

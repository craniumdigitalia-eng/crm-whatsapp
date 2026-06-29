'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
   Módulo de Agenda (Story 5.7)
   Calendário mensal e semanal ligado ao Google Calendar via
   /api/agenda/events. Criar, editar e excluir eventos com
   vínculo opcional a leads.
   Estilos: classes agd-* em styles/globals.css.
   ============================================================ */

// ---------- tipos ----------

interface AgendaEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  meetLink?: string;
  htmlLink?: string;
  attendees?: string[];
  leadId?: string;
  leadName?: string;
  colorId?: string; // "1"–"11" — paleta oficial do Google Calendar
}

interface LeadOption {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

type ModalState =
  | { mode: 'create'; date: Date }
  | { mode: 'edit'; event: AgendaEvent }
  | null;

// ---------- constantes ----------

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Horas exibidas na visão semanal (7h–22h)
const HORAS = Array.from({ length: 16 }, (_, i) => i + 7);

const PX_POR_HORA = 90; // altura de cada hora em pixels (visão semanal)

// Paleta oficial do Google Calendar (colorId "1"–"11")
const COR_AGENDA: Record<string, { nome: string; hex: string }> = {
  '1':  { nome: 'Lavanda',    hex: '#7986CB' },
  '2':  { nome: 'Sálvia',     hex: '#33B679' },
  '3':  { nome: 'Uva',        hex: '#8E24AA' },
  '4':  { nome: 'Flamingo',   hex: '#E67C73' },
  '5':  { nome: 'Banana',     hex: '#F6BF26' },
  '6':  { nome: 'Tangerina',  hex: '#F4511E' },
  '7':  { nome: 'Pavão',      hex: '#039BE5' },
  '8':  { nome: 'Grafite',    hex: '#616161' },
  '9':  { nome: 'Mirtilo',    hex: '#3F51B5' },
  '10': { nome: 'Manjericão', hex: '#0B8043' },
  '11': { nome: 'Tomate',     hex: '#D50000' },
};

// cor padrão: Mirtilo (id 9) — mesmo azul que a IA usa no agendamento
const COR_PADRAO = '9';

// resolve o hex de um evento; eventos sem colorId recebem o padrão
function corDoEvento(ev: AgendaEvent): string {
  return COR_AGENDA[ev.colorId ?? COR_PADRAO]?.hex ?? COR_AGENDA[COR_PADRAO].hex;
}

// ---------- helpers de data ----------

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

function formatPeriodLabel(view: 'month' | 'week', current: Date): string {
  if (view === 'month') {
    return `${MESES[current.getMonth()]} ${current.getFullYear()}`;
  }
  const ws = startOfWeek(current);
  const we = addDays(ws, 6);
  if (ws.getMonth() === we.getMonth()) {
    return `${ws.getDate()}–${we.getDate()} de ${MESES[ws.getMonth()]} ${ws.getFullYear()}`;
  }
  return (
    `${ws.getDate()} ${MESES[ws.getMonth()].slice(0, 3)} – ` +
    `${we.getDate()} ${MESES[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`
  );
}

// Retorna os 42 dias do grid mensal (6 semanas × 7 dias)
function monthCells(current: Date): Date[] {
  const first = startOfMonth(current);
  const last = endOfMonth(current);
  const cells: Date[] = [];
  for (let i = first.getDay(); i > 0; i--) cells.push(addDays(first, -i));
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) cells.push(new Date(d));
  while (cells.length < 42) cells.push(addDays(last, cells.length - (last.getDate() + first.getDay() - 1)));
  return cells;
}

// Retorna os 7 dias da semana visível
function weekCells(current: Date): Date[] {
  const ws = startOfWeek(current);
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

// Filtra eventos de um dia específico
function eventsOnDay(events: AgendaEvent[], day: Date): AgendaEvent[] {
  return events.filter(ev => sameDay(new Date(ev.start), day));
}

// ---------- algoritmo de colunas para eventos sobrepostos ----------

interface ColInfo {
  col: number;       // índice da coluna (0-based)
  totalCols: number; // nº de colunas no cluster
}

// verifica sobreposição estrita de horário (eventos adjacentes não colidem)
function sobrepoem(a: AgendaEvent, b: AgendaEvent): boolean {
  return new Date(a.start).getTime() < new Date(b.end).getTime()
      && new Date(b.start).getTime() < new Date(a.end).getTime();
}

// distribui eventos em colunas lado a lado (estilo Google Calendar)
// retorna mapa id → { col, totalCols }
function distribuirColunas(eventos: AgendaEvent[]): Map<string, ColInfo> {
  if (eventos.length === 0) return new Map();

  // ordena por início; empate: evento mais longo vai primeiro
  const sorted = [...eventos].sort((a, b) => {
    const d = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (d !== 0) return d;
    return (new Date(b.end).getTime() - new Date(b.start).getTime())
         - (new Date(a.end).getTime() - new Date(a.start).getTime());
  });

  // agrupa em clusters por sobreposição transitiva
  const visitados = new Set<string>();
  const clusters: AgendaEvent[][] = [];

  for (const ev of sorted) {
    if (visitados.has(ev.id)) continue;
    const cluster: AgendaEvent[] = [ev];
    visitados.add(ev.id);
    let i = 0;
    while (i < cluster.length) {
      for (const outro of sorted) {
        if (!visitados.has(outro.id) && sobrepoem(cluster[i], outro)) {
          cluster.push(outro);
          visitados.add(outro.id);
        }
      }
      i++;
    }
    clusters.push(cluster);
  }

  const mapa = new Map<string, ColInfo>();

  for (const cluster of clusters) {
    // atribui cada evento à primeira coluna sem colisão
    const colunas: AgendaEvent[][] = [];
    for (const ev of cluster) {
      let alocado = false;
      for (let c = 0; c < colunas.length; c++) {
        if (!colunas[c].some(outro => sobrepoem(ev, outro))) {
          colunas[c].push(ev);
          mapa.set(ev.id, { col: c, totalCols: 0 }); // totalCols ajustado abaixo
          alocado = true;
          break;
        }
      }
      if (!alocado) {
        mapa.set(ev.id, { col: colunas.length, totalCols: 0 });
        colunas.push([ev]);
      }
    }
    // propaga o nº de colunas do cluster para todos os seus eventos
    const total = colunas.length;
    for (const ev of cluster) {
      const info = mapa.get(ev.id)!;
      mapa.set(ev.id, { col: info.col, totalCols: total });
    }
  }

  return mapa;
}

function padTime(n: number): string {
  return String(n).padStart(2, '0');
}

function eventToTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${padTime(d.getHours())}:${padTime(d.getMinutes())}`;
}

// ---------- fetch utilitário ----------

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('não autenticado');
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(b.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------- AgendaModule ----------

export default function AgendaModule() {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [current, setCurrent] = useState<Date>(() => new Date());

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const leadsCarregados = useRef(false);

  // estado do formulário do modal
  const [formSummary, setFormSummary] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('10:00');
  const [formDesc, setFormDesc] = useState('');
  const [formLeadId, setFormLeadId] = useState('');
  const [formAttendees, setFormAttendees] = useState('');
  const [formColorId, setFormColorId] = useState(COR_PADRAO);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- busca de eventos ---

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let from: Date, to: Date;
      if (view === 'month') {
        from = addDays(startOfMonth(current), -6);
        to = addDays(endOfMonth(current), 6);
      } else {
        from = startOfWeek(current);
        to = addDays(from, 6);
      }
      const data = await apiFetch<{ events: AgendaEvent[] }>(
        `/api/agenda/events?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setEvents(data.events ?? []);
    } catch (e) {
      const msg = (e as Error).message ?? 'Erro ao carregar eventos';
      // detecta erros de credencial / calendário não conectado
      const lower = msg.toLowerCase();
      if (
        lower.includes('calendar') ||
        lower.includes('oauth') ||
        lower.includes('credential') ||
        lower.includes('token') ||
        lower.includes('google') ||
        lower.includes('sem credencial')
      ) {
        setError('Google Calendar não conectado — conecte na aba Integrações.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [view, current]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // --- navegação de período ---

  function navPrev() {
    setCurrent(prev => {
      if (view === 'month') return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      return addDays(prev, -7);
    });
  }

  function navNext() {
    setCurrent(prev => {
      if (view === 'month') return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      return addDays(prev, 7);
    });
  }

  function navToday() {
    setCurrent(new Date());
  }

  // --- carrega lista de leads (lazy, uma vez) ---

  async function ensureLeads() {
    if (leadsCarregados.current) return;
    setLeadsLoading(true);
    try {
      const data = await apiFetch<{ leads: LeadOption[] } | LeadOption[]>('/api/leads');
      const arr: LeadOption[] = Array.isArray(data)
        ? data
        : ((data as { leads: LeadOption[] }).leads ?? []);
      setLeads(arr);
      leadsCarregados.current = true;
    } catch {
      // silencioso — seletor fica sem opções
    } finally {
      setLeadsLoading(false);
    }
  }

  // --- abre modal de criação ---

  function openCreate(day: Date) {
    setModal({ mode: 'create', date: day });
    setFormSummary('');
    setFormDate(isoDate(day));
    setFormStart('09:00');
    setFormEnd('10:00');
    setFormDesc('');
    setFormLeadId('');
    setFormAttendees('');
    setFormColorId(COR_PADRAO);
    setFormError(null);
    void ensureLeads();
  }

  // --- abre modal de edição ---

  function openEdit(ev: AgendaEvent) {
    const startDate = new Date(ev.start);
    const endDate = new Date(ev.end);
    setModal({ mode: 'edit', event: ev });
    setFormSummary(ev.summary);
    setFormDate(isoDate(startDate));
    setFormStart(ev.allDay ? '09:00' : `${padTime(startDate.getHours())}:${padTime(startDate.getMinutes())}`);
    setFormEnd(ev.allDay ? '10:00' : `${padTime(endDate.getHours())}:${padTime(endDate.getMinutes())}`);
    setFormDesc(ev.description ?? '');
    setFormLeadId(ev.leadId ?? '');
    setFormAttendees((ev.attendees ?? []).join(', '));
    setFormColorId(ev.colorId ?? COR_PADRAO);
    setFormError(null);
    void ensureLeads();
  }

  function closeModal() {
    if (saving || deleting) return;
    setModal(null);
  }

  // --- salvar evento ---

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formSummary.trim()) {
      setFormError('Informe um título para o evento.');
      return;
    }
    if (!formDate) {
      setFormError('Informe a data do evento.');
      return;
    }

    const startISO = new Date(`${formDate}T${formStart}:00`).toISOString();
    const endISO = new Date(`${formDate}T${formEnd}:00`).toISOString();

    if (new Date(startISO) >= new Date(endISO)) {
      setFormError('O horário de início deve ser anterior ao de fim.');
      return;
    }

    const attendeesList = formAttendees
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const body = {
      summary: formSummary.trim(),
      start: startISO,
      end: endISO,
      colorId: formColorId,
      ...(formDesc.trim() ? { description: formDesc.trim() } : {}),
      ...(attendeesList.length ? { attendees: attendeesList } : {}),
      ...(formLeadId ? { leadId: formLeadId } : {}),
    };

    setSaving(true);
    setFormError(null);
    try {
      if (modal?.mode === 'create') {
        await apiFetch('/api/agenda/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else if (modal?.mode === 'edit') {
        await apiFetch(`/api/agenda/events/${modal.event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setModal(null);
      void loadEvents();
    } catch (err) {
      setFormError((err as Error).message ?? 'Falha ao salvar evento.');
    } finally {
      setSaving(false);
    }
  }

  // --- excluir evento ---

  async function handleDelete() {
    if (modal?.mode !== 'edit') return;
    if (!window.confirm(`Excluir "${modal.event.summary}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setFormError(null);
    try {
      await apiFetch(`/api/agenda/events/${modal.event.id}`, { method: 'DELETE' });
      setModal(null);
      void loadEvents();
    } catch (err) {
      setFormError((err as Error).message ?? 'Falha ao excluir evento.');
    } finally {
      setDeleting(false);
    }
  }

  // fecha modal ao clicar no overlay
  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeModal();
  }

  // atualiza convidados ao selecionar lead
  function onLeadChange(leadId: string) {
    setFormLeadId(leadId);
    if (leadId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead?.email && !formAttendees.includes(lead.email)) {
        setFormAttendees(prev => (prev.trim() ? `${prev.trim()}, ${lead.email}` : (lead.email ?? '')));
      }
    }
  }

  // --- remarcar evento por arraste (drag-to-reschedule) ---

  async function handleReschedule(id: string, newStart: string, newEnd: string) {
    // guarda original para revert em caso de falha da API
    const original = events.find(ev => ev.id === id);
    if (!original) return;

    // atualização otimista — mostra no novo lugar imediatamente
    setEvents(prev => prev.map(ev =>
      ev.id === id ? { ...ev, start: newStart, end: newEnd } : ev,
    ));

    try {
      await apiFetch(`/api/agenda/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: newStart, end: newEnd }),
      });
    } catch (err) {
      // revert — restaura posição original
      setEvents(prev => prev.map(ev =>
        ev.id === id ? { ...ev, start: original.start, end: original.end } : ev,
      ));
      throw err; // propaga para o grid exibir o toast de aviso
    }
  }

  const cells = view === 'month' ? monthCells(current) : weekCells(current);
  const periodLabel = formatPeriodLabel(view, current);
  const selectedLead = modal ? leads.find(l => l.id === formLeadId) : undefined;

  return (
    <section className="agd-page">

      {/* ── Cabeçalho ── */}
      <header className="agd-header">
        <div className="agd-header-left">
          <h1 className="agd-title">Agenda</h1>
          <p className="agd-subtitle">Reuniões e compromissos sincronizados com o Google Calendar.</p>
        </div>

        <div className="agd-header-actions">
          {/* toggle mês / semana */}
          <div className="agd-view-toggle" role="group" aria-label="Visão do calendário">
            <button
              className={`agd-view-btn${view === 'month' ? ' active' : ''}`}
              onClick={() => setView('month')}
              aria-pressed={view === 'month'}
            >
              Mês
            </button>
            <button
              className={`agd-view-btn${view === 'week' ? ' active' : ''}`}
              onClick={() => setView('week')}
              aria-pressed={view === 'week'}
            >
              Semana
            </button>
          </div>

          <button
            className="btn btn-ghost btn-sm agd-refresh-btn"
            onClick={() => void loadEvents()}
            disabled={loading}
            aria-label="Atualizar calendário"
            title="Atualizar"
          >
            <svg
              width="13" height="13"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              className={loading ? 'agd-spin' : undefined}
            >
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => openCreate(new Date())}
            aria-label="Criar novo evento"
          >
            <svg
              width="13" height="13"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo evento
          </button>
        </div>
      </header>

      {/* ── Navegação de período ── */}
      <nav className="agd-nav" aria-label="Navegação de período">
        <button className="agd-nav-btn" onClick={navPrev} aria-label="Período anterior">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <button className="agd-nav-today" onClick={navToday}>Hoje</button>

        <button className="agd-nav-btn" onClick={navNext} aria-label="Próximo período">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <h2 className="agd-period-label">{periodLabel}</h2>
      </nav>

      {/* ── Banner de erro ── */}
      {error && !loading && (
        <div className="agd-error-banner" role="alert" aria-live="polite">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Calendário ── */}
      {view === 'month' ? (
        <MonthGrid
          cells={cells}
          events={events}
          currentMonth={current.getMonth()}
          onDayClick={openCreate}
          onEventClick={openEdit}
          onEventReschedule={handleReschedule}
        />
      ) : (
        <WeekGrid
          cells={cells}
          events={events}
          onSlotClick={openCreate}
          onEventClick={openEdit}
          onEventReschedule={handleReschedule}
        />
      )}

      {/* ── Modal criar / editar ── */}
      {modal && (
        <div
          className="agd-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={modal.mode === 'create' ? 'Criar evento' : 'Editar evento'}
          onClick={onOverlayClick}
        >
          <div className="agd-modal">
            <div className="agd-modal-header">
              <h3 className="agd-modal-title">
                {modal.mode === 'create' ? 'Novo evento' : 'Editar evento'}
              </h3>
              <button
                className="agd-modal-close"
                onClick={closeModal}
                aria-label="Fechar modal"
                disabled={saving || deleting}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form className="agd-modal-form" onSubmit={handleSave} noValidate>

              {/* Título */}
              <div className="agd-field">
                <label htmlFor="agd-summary">Título</label>
                <input
                  id="agd-summary"
                  value={formSummary}
                  onChange={e => setFormSummary(e.target.value)}
                  placeholder="Ex.: Reunião estratégica com cliente"
                  required
                  autoFocus
                  disabled={saving || deleting}
                />
              </div>

              {/* Data + horários em linha */}
              <div className="agd-field-row">
                <div className="agd-field agd-field--flex2">
                  <label htmlFor="agd-date">Data</label>
                  <input
                    id="agd-date"
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    disabled={saving || deleting}
                  />
                </div>
                <div className="agd-field">
                  <label htmlFor="agd-start">Início</label>
                  <input
                    id="agd-start"
                    type="time"
                    value={formStart}
                    onChange={e => setFormStart(e.target.value)}
                    required
                    disabled={saving || deleting}
                  />
                </div>
                <div className="agd-field">
                  <label htmlFor="agd-end">Fim</label>
                  <input
                    id="agd-end"
                    type="time"
                    value={formEnd}
                    onChange={e => setFormEnd(e.target.value)}
                    required
                    disabled={saving || deleting}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="agd-field">
                <label htmlFor="agd-desc">Descrição</label>
                <textarea
                  id="agd-desc"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={2}
                  placeholder="Detalhes ou pauta do evento…"
                  disabled={saving || deleting}
                />
              </div>

              {/* Cor do evento */}
              <div className="agd-field">
                <label>Cor</label>
                <SeletorCor
                  valor={formColorId}
                  onChange={setFormColorId}
                  disabled={saving || deleting}
                />
              </div>

              {/* Seletor de lead */}
              <div className="agd-field">
                <label htmlFor="agd-lead">Lead vinculado</label>
                <select
                  id="agd-lead"
                  value={formLeadId}
                  onChange={e => onLeadChange(e.target.value)}
                  disabled={leadsLoading || saving || deleting}
                >
                  <option value="">— sem vínculo —</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.phone ? ` (${l.phone})` : ''}
                    </option>
                  ))}
                </select>
                {selectedLead?.email && (
                  <span className="agd-field-hint">E-mail: {selectedLead.email}</span>
                )}
              </div>

              {/* Convidados */}
              <div className="agd-field">
                <label htmlFor="agd-attendees">Convidados</label>
                <input
                  id="agd-attendees"
                  type="text"
                  value={formAttendees}
                  onChange={e => setFormAttendees(e.target.value)}
                  placeholder="email@exemplo.com, outro@exemplo.com"
                  disabled={saving || deleting}
                />
                <span className="agd-field-hint">Separe múltiplos e-mails por vírgula.</span>
              </div>

              {/* Link do Google Meet (somente edição) */}
              {modal.mode === 'edit' && modal.event.meetLink && (
                <div className="agd-meet-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14"/>
                    <rect x="1" y="6" width="14" height="12" rx="2"/>
                  </svg>
                  <a href={modal.event.meetLink} target="_blank" rel="noopener noreferrer">
                    Entrar no Google Meet
                  </a>
                </div>
              )}

              {/* Erro de formulário */}
              {formError && (
                <div className="agd-form-error" role="alert">{formError}</div>
              )}

              {/* Ações do modal */}
              <div className="agd-modal-actions">
                {modal.mode === 'edit' && (
                  <button
                    type="button"
                    className="btn agd-btn-delete btn-sm"
                    onClick={handleDelete}
                    disabled={saving || deleting}
                  >
                    {deleting ? 'Excluindo…' : 'Excluir'}
                  </button>
                )}
                <div className="agd-modal-actions-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={closeModal}
                    disabled={saving || deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving || deleting}
                  >
                    {saving ? 'Salvando…' : modal.mode === 'create' ? 'Criar evento' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- SeletorCor ----------

interface SeletorCorProps {
  valor: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function SeletorCor({ valor, onChange, disabled }: SeletorCorProps) {
  return (
    <div className="agd-color-picker" role="group" aria-label="Cor do evento">
      {Object.entries(COR_AGENDA).map(([id, { nome, hex }]) => (
        <button
          key={id}
          type="button"
          className={`agd-color-swatch${valor === id ? ' active' : ''}`}
          style={{ background: hex }}
          aria-label={nome}
          aria-pressed={valor === id}
          onClick={() => onChange(id)}
          disabled={disabled}
          title={nome}
        />
      ))}
    </div>
  );
}

// ---------- MonthGrid ----------

interface MonthGridProps {
  cells: Date[];
  events: AgendaEvent[];
  currentMonth: number;
  onDayClick: (day: Date) => void;
  onEventClick: (ev: AgendaEvent) => void;
  onEventReschedule: (id: string, newStart: string, newEnd: string) => Promise<void>;
}

function MonthGrid({ cells, events, currentMonth, onDayClick, onEventClick, onEventReschedule }: MonthGridProps) {
  // suprime o click sintético que o browser dispara após pointerup de arraste
  const suppressClick = useRef(false);

  // estado mutável do drag (sem causar re-renders a cada move)
  const dragRef = useRef<{
    id: string;
    ev: AgendaEvent;
    startX: number;
    startY: number;
    dragging: boolean; // true após ultrapassar o threshold de 5 px
  } | null>(null);

  // índice da célula alvo durante o arraste
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);

  // toast de erro exibido quando o PATCH falha e a posição é revertida
  const [dragToast, setDragToast] = useState<string | null>(null);

  useEffect(() => {
    if (!dragToast) return;
    const t = setTimeout(() => setDragToast(null), 4000);
    return () => clearTimeout(t);
  }, [dragToast]);

  // --- handlers de drag ---

  function handleChipPointerDown(e: React.PointerEvent, ev: AgendaEvent) {
    e.stopPropagation(); // não propaga para a célula (evitaria abrir modal de criar)
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: ev.id,
      ev,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };
  }

  function handleChipPointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;
    if (!dr.dragging) {
      if (Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 5) return;
      dr.dragging = true;
    }
    // localiza a célula sob o ponteiro via DOM
    // (setPointerCapture não interfere em elementsFromPoint)
    const hit = document.elementsFromPoint(e.clientX, e.clientY);
    const cellEl = hit.find(
      (el): el is HTMLElement => !!(el as HTMLElement).dataset?.cellIndex,
    ) as HTMLElement | undefined;
    if (cellEl) {
      const idx = parseInt(cellEl.dataset.cellIndex ?? '-1', 10);
      if (idx >= 0) setDragTargetIdx(idx);
    }
  }

  async function handleChipPointerUp(e: React.PointerEvent) {
    const dr = dragRef.current;
    dragRef.current = null;
    if (!dr?.dragging) {
      setDragTargetIdx(null);
      return;
    }
    e.stopPropagation();
    suppressClick.current = true;
    const targetIdx = dragTargetIdx;
    setDragTargetIdx(null);
    if (targetIdx === null) return;
    const targetDay = cells[targetIdx];
    if (!targetDay) return;
    // mantém horário e duração originais; muda apenas a data
    const origStart  = new Date(dr.ev.start);
    const origEnd    = new Date(dr.ev.end);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const newStart   = new Date(targetDay);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    try {
      await onEventReschedule(dr.id, newStart.toISOString(), newEnd.toISOString());
    } catch (err) {
      setDragToast((err as Error).message ?? 'Falha ao mover. Posição original restaurada.');
    }
  }

  function handleChipClick(e: React.MouseEvent, ev: AgendaEvent) {
    e.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return; // era arraste — não abre modal
    }
    onEventClick(ev);
  }

  return (
    <div className="agd-month-wrap">
      {/* toast de erro de arraste */}
      {dragToast && (
        <div className="agd-drag-toast" role="alert" aria-live="assertive">
          {dragToast}
        </div>
      )}

      {/* nomes dos dias da semana */}
      <div className="agd-month-header" aria-hidden="true">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="agd-month-day-name">{d}</div>
        ))}
      </div>

      {/* grid de células */}
      <div className="agd-month-grid" role="grid" aria-label="Calendário mensal">
        {cells.map((day, i) => {
          const dayEvents  = eventsOnDay(events, day);
          const otherMonth = day.getMonth() !== currentMonth;
          const isDragTarget = dragTargetIdx === i && dragRef.current !== null;
          return (
            <div
              key={i}
              data-cell-index={i}
              className={[
                'agd-month-cell',
                otherMonth   ? 'agd-month-cell--other'       : '',
                isToday(day) ? 'agd-month-cell--today'       : '',
                isDragTarget ? 'agd-month-cell--drag-target' : '',
              ].filter(Boolean).join(' ')}
              role="gridcell"
              tabIndex={0}
              aria-label={`${day.getDate()} de ${MESES[day.getMonth()]}${dayEvents.length ? `, ${dayEvents.length} evento${dayEvents.length > 1 ? 's' : ''}` : ''}`}
              onClick={() => onDayClick(day)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(day); } }}
            >
              <span className="agd-month-date">{day.getDate()}</span>
              <div className="agd-month-events">
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    className="agd-event-chip"
                    style={{ '--agd-ev-bg': corDoEvento(ev) } as React.CSSProperties}
                    onClick={e => handleChipClick(e, ev)}
                    onPointerDown={e => handleChipPointerDown(e, ev)}
                    onPointerMove={handleChipPointerMove}
                    onPointerUp={handleChipPointerUp}
                    aria-label={`Evento: ${ev.summary}`}
                    title={ev.summary}
                  >
                    {!ev.allDay && (
                      <span className="agd-event-chip-time">{eventToTimeStr(ev.start)}</span>
                    )}
                    <span className="agd-event-chip-title">{ev.summary}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="agd-event-more">+{dayEvents.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- WeekGrid ----------

interface WeekGridProps {
  cells: Date[];
  events: AgendaEvent[];
  onSlotClick: (day: Date) => void;
  onEventClick: (ev: AgendaEvent) => void;
  onEventReschedule: (id: string, newStart: string, newEnd: string) => Promise<void>;
}

function WeekGrid({ cells, events, onSlotClick, onEventClick, onEventReschedule }: WeekGridProps) {
  const SLOT_START_MIN = HORAS[0] * 60;
  const SLOT_END_MIN   = (HORAS[HORAS.length - 1] + 1) * 60;
  const PX_POR_MIN     = PX_POR_HORA / 60;
  const totalHeight    = HORAS.length * PX_POR_HORA;

  // ref para o container do corpo da grade (usado para calcular posições durante drag)
  const bodyRef = useRef<HTMLDivElement>(null);

  // suprime o click sintético que o browser dispara após pointerup de arraste
  const suppressClick = useRef(false);

  // estado mutável do drag — sem causar re-renders a cada move do ponteiro
  const dragRef = useRef<{
    id: string;
    ev: AgendaEvent;
    durationMin: number;    // duração original em minutos (constante durante drag)
    height: number;         // altura em px (constante durante drag)
    pointerOffsetY: number; // onde dentro do evento o ponteiro foi pressionado
    startX: number;
    startY: number;
    dragging: boolean;      // true após ultrapassar o threshold de 5 px
    gutterWidth: number;    // largura do eixo de horas em px
    colWidth: number;       // largura de cada coluna de dia em px
    bodyTop: number;        // top do corpo da grade (viewport)
    bodyLeft: number;       // left do corpo da grade (viewport)
  } | null>(null);

  // preview visual do evento na posição-alvo durante o arraste
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    dayIndex: number; // coluna-alvo (0-6)
    top: number;      // px a partir do topo da coluna
    height: number;
    color: string;
    title: string;
  } | null>(null);

  // toast de erro exibido quando o PATCH falha e a posição é revertida
  const [dragToast, setDragToast] = useState<string | null>(null);

  useEffect(() => {
    if (!dragToast) return;
    const t = setTimeout(() => setDragToast(null), 4000);
    return () => clearTimeout(t);
  }, [dragToast]);

  // --- handlers de drag ---

  function handleEventPointerDown(
    e: React.PointerEvent,
    ev: AgendaEvent,
    top: number,
    height: number,
  ) {
    e.stopPropagation(); // não propaga para a coluna de dia (evita abrir modal de criar)
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: ev.id,
      ev,
      durationMin: (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000,
      height,
      pointerOffsetY: e.clientY - el.getBoundingClientRect().top,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      gutterWidth: 0,
      colWidth: 0,
      bodyTop: 0,
      bodyLeft: 0,
    };
  }

  function handleEventPointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;

    // threshold de 5 px antes de ativar o arraste
    if (!dr.dragging) {
      if (Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 5) return;
      dr.dragging = true;
      const body = bodyRef.current;
      if (!body) { dragRef.current = null; return; }
      const rect     = body.getBoundingClientRect();
      dr.bodyTop     = rect.top;
      dr.bodyLeft    = rect.left;
      const gutterEl = body.querySelector<HTMLElement>('.agd-week-time-axis');
      dr.gutterWidth = gutterEl?.offsetWidth ?? 52;
      dr.colWidth    = (rect.width - dr.gutterWidth) / cells.length;
    }

    // coluna-alvo pela posição horizontal do ponteiro
    const relX      = e.clientX - dr.bodyLeft - dr.gutterWidth;
    const newDayIdx = Math.max(0, Math.min(cells.length - 1, Math.floor(relX / dr.colWidth)));

    // posição vertical com snap de 15 minutos
    const relY       = e.clientY - dr.bodyTop - dr.pointerOffsetY;
    const snappedMin = Math.round((relY / PX_POR_MIN) / 15) * 15;
    const cappedMin  = Math.max(0, Math.min(
      SLOT_END_MIN - SLOT_START_MIN - dr.durationMin,
      snappedMin,
    ));

    setDragPreview({
      id:       dr.id,
      dayIndex: newDayIdx,
      top:      cappedMin * PX_POR_MIN,
      height:   dr.height,
      color:    corDoEvento(dr.ev),
      title:    dr.ev.summary,
    });
  }

  async function handleEventPointerUp(e: React.PointerEvent) {
    const dr = dragRef.current;
    dragRef.current = null;

    if (!dr?.dragging) {
      // foi clique — deixa o click sintético do botão disparar normalmente
      setDragPreview(null);
      return;
    }

    e.stopPropagation();
    suppressClick.current = true;

    const preview = dragPreview;
    setDragPreview(null);
    if (!preview) return;

    // computa novo start/end mantendo a duração original
    const targetDay   = cells[preview.dayIndex];
    const totalMinAbs = SLOT_START_MIN + preview.top / PX_POR_MIN;
    const newStart    = new Date(targetDay);
    newStart.setHours(Math.floor(totalMinAbs / 60), totalMinAbs % 60, 0, 0);
    const newEnd = new Date(newStart.getTime() + dr.durationMin * 60000);

    try {
      await onEventReschedule(dr.id, newStart.toISOString(), newEnd.toISOString());
    } catch (err) {
      setDragToast((err as Error).message ?? 'Falha ao mover. Posição original restaurada.');
    }
  }

  function handleEventClick(e: React.MouseEvent, ev: AgendaEvent) {
    e.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return; // era arraste — não abre modal
    }
    onEventClick(ev);
  }

  return (
    <div className="agd-week-wrap">
      {/* toast de erro de arraste (fora do grid do corpo para não afetar auto-placement) */}
      {dragToast && (
        <div className="agd-drag-toast" role="alert" aria-live="assertive">
          {dragToast}
        </div>
      )}

      {/* cabeçalho com nomes dos dias */}
      <div className="agd-week-header">
        <div className="agd-week-gutter" aria-hidden="true"/>
        {cells.map((day, i) => (
          <div
            key={i}
            className={`agd-week-head-cell${isToday(day) ? ' agd-week-head-cell--today' : ''}`}
          >
            <span className="agd-week-head-dow">{DIAS_SEMANA[day.getDay()]}</span>
            <span className={`agd-week-head-date${isToday(day) ? ' agd-week-head-date--today' : ''}`}>
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* corpo: eixo de horas + colunas de dias */}
      <div className="agd-week-body" ref={bodyRef}>
        {/* eixo de horas */}
        <div
          className="agd-week-time-axis"
          aria-hidden="true"
          style={{ height: `${totalHeight}px` }}
        >
          {HORAS.map(h => (
            <div
              key={h}
              className="agd-week-time-slot"
              style={{ height: `${PX_POR_HORA}px` }}
            >
              {`${padTime(h)}:00`}
            </div>
          ))}
        </div>

        {/* coluna de cada dia */}
        {cells.map((day, i) => {
          const dayEvents = eventsOnDay(events, day).filter(ev => !ev.allDay);
          // calcula layout lado a lado para eventos sobrepostos
          const colLayout = distribuirColunas(dayEvents);

          return (
            <div
              key={i}
              className={`agd-week-day-col${isToday(day) ? ' agd-week-day-col--today' : ''}`}
              style={{ height: `${totalHeight}px` }}
              role="button"
              tabIndex={0}
              aria-label={`Criar evento em ${day.getDate()} de ${MESES[day.getMonth()]}`}
              onClick={() => onSlotClick(day)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(day); } }}
            >
              {/* linhas horizontais de hora */}
              {HORAS.map(h => (
                <div
                  key={h}
                  className="agd-week-hour-line"
                  style={{ top: `${(h - HORAS[0]) * PX_POR_HORA}px` }}
                  aria-hidden="true"
                />
              ))}

              {/* preview do evento sendo arrastado — aparece nesta coluna se for o alvo */}
              {dragPreview?.dayIndex === i && (
                <div
                  className="agd-week-event agd-week-event--drag-preview"
                  style={{
                    top:    `${dragPreview.top}px`,
                    height: `${dragPreview.height}px`,
                    left:   '2px',
                    right:  '2px',
                    '--agd-ev-bg': dragPreview.color,
                    pointerEvents: 'none',
                  } as React.CSSProperties}
                  aria-hidden="true"
                >
                  <span className="agd-week-event-title">{dragPreview.title}</span>
                </div>
              )}

              {/* eventos posicionados lado a lado quando sobrepostos */}
              {dayEvents.map(ev => {
                const startDate    = new Date(ev.start);
                const endDate      = new Date(ev.end);
                const startMin     = startDate.getHours() * 60 + startDate.getMinutes();
                const endMin       = endDate.getHours() * 60 + endDate.getMinutes();
                const clampedStart = Math.max(startMin, SLOT_START_MIN);
                const clampedEnd   = Math.min(endMin, SLOT_END_MIN);
                const top          = (clampedStart - SLOT_START_MIN) * PX_POR_MIN;
                const height       = Math.max((clampedEnd - clampedStart) * PX_POR_MIN, 22);
                const startLabel   = `${padTime(startDate.getHours())}:${padTime(startDate.getMinutes())}`;
                const { col, totalCols } = colLayout.get(ev.id) ?? { col: 0, totalCols: 1 };
                const leftPct    = (col / totalCols) * 100;
                const rightPct   = ((totalCols - col - 1) / totalCols) * 100;
                const isDragging = dragPreview?.id === ev.id;

                return (
                  <button
                    key={ev.id}
                    className={`agd-week-event${isDragging ? ' agd-week-event--dragging' : ''}`}
                    style={{
                      top:    `${top}px`,
                      height: `${height}px`,
                      left:   `calc(${leftPct.toFixed(3)}% + 2px)`,
                      right:  `calc(${rightPct.toFixed(3)}% + 2px)`,
                      '--agd-ev-bg': corDoEvento(ev),
                      cursor: isDragging ? 'grabbing' : 'grab',
                    } as React.CSSProperties}
                    onClick={e => handleEventClick(e, ev)}
                    onPointerDown={e => handleEventPointerDown(e, ev, top, height)}
                    onPointerMove={handleEventPointerMove}
                    onPointerUp={handleEventPointerUp}
                    aria-label={`${ev.summary} — ${startLabel}`}
                    title={`${ev.summary} (${startLabel})`}
                  >
                    <span className="agd-week-event-title">{ev.summary}</span>
                    {height > 36 && (
                      <span className="agd-week-event-time">{startLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

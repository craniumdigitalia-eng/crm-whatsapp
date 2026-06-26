// portal.js — Cranium CRM · Kanban de leads
// Busca leads em GET /api/leads; fallback para mock embutido se a API falhar.

'use strict';

/* ============================================================
   Config do funil
   ============================================================ */

const STAGES = [
  { key: 'novo',            label: 'Novo',           dotClass: 'dot-novo' },
  { key: 'em_atendimento',  label: 'Em atendimento', dotClass: 'dot-em_atendimento' },
  { key: 'qualificado',     label: 'Qualificado',    dotClass: 'dot-qualificado' },
  { key: 'proposta',        label: 'Proposta',       dotClass: 'dot-proposta' },
  { key: 'fechado',         label: 'Fechado',        dotClass: 'dot-fechado' },
  { key: 'perdido',         label: 'Perdido',        dotClass: 'dot-perdido' },
  { key: 'humano',          label: 'Atend. humano',  dotClass: 'dot-humano' },
];

/* Estágios em que a IA atende automaticamente */
const AI_STAGES = new Set(['novo', 'em_atendimento', 'qualificado']);

/* ============================================================
   Mock de demonstração (6 leads reais de demo)
   ============================================================ */

const MOCK_LEADS = [
  {
    id: 'demo-1',
    name: 'Ana Beatriz Souza',
    phone: '+55 11 98765-4321',
    status: 'novo',
    service_interest: 'PME · 8 vidas',
    budget: 'R$ 2.400/mês',
    last_message_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    follow_up_count: 0,
  },
  {
    id: 'demo-2',
    name: 'Carlos Eduardo Lima',
    phone: '+55 21 99234-5678',
    status: 'em_atendimento',
    service_interest: 'Plano Individual',
    budget: 'R$ 680/mês',
    last_message_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    follow_up_count: 1,
  },
  {
    id: 'demo-3',
    name: 'Mariana Ferreira',
    phone: '+55 31 98111-2233',
    status: 'qualificado',
    service_interest: 'Adesão Entidade',
    budget: 'R$ 1.100/mês',
    last_message_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 2,
  },
  {
    id: 'demo-4',
    name: 'Roberto Alves Pinto',
    phone: '+55 11 97654-3210',
    status: 'proposta',
    service_interest: 'PME · 15 vidas',
    budget: 'R$ 5.200/mês',
    last_message_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 3,
  },
  {
    id: 'demo-5',
    name: 'Fernanda Costa',
    phone: '+55 41 98000-1111',
    status: 'fechado',
    service_interest: 'PME · 3 vidas',
    budget: 'R$ 950/mês',
    last_message_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    follow_up_count: 0,
  },
  {
    id: 'demo-6',
    name: 'Paulo Henrique Braga',
    phone: '+55 85 99888-7766',
    status: 'humano',
    service_interest: 'Plano Individual',
    budget: null,
    last_message_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    follow_up_count: 1,
  },
];

/* ============================================================
   Helpers
   ============================================================ */

const AVATAR_COLORS = [
  '#7C3AED', '#5B21B6', '#6D28D9', '#4C1D95', '#8B5CF6',
];

function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return 'agora';
  if (diff < 3600)   return `${Math.floor(diff / 60)}min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* Infere origem do lead de forma visual (demo) */
const SOURCES = ['WhatsApp', 'Site', 'Indicação', 'Instagram', 'Google'];
function originTag(lead) {
  // hash simples do id pra deixar consistente entre renders
  let h = 0;
  for (let i = 0; i < (lead.id || '').length; i++) h = (h * 31 + lead.id.charCodeAt(i)) & 0xffffffff;
  return SOURCES[Math.abs(h) % SOURCES.length];
}

/* ============================================================
   Build DOM: card de lead
   ============================================================ */

function buildLeadCard(lead) {
  const el = document.createElement('article');
  el.className = 'lead-card';
  el.setAttribute('role', 'listitem');
  el.setAttribute('aria-label', `Lead: ${lead.name || lead.phone}`);
  el.setAttribute('tabindex', '0');
  el.dataset.leadId = lead.id;

  const isAI = AI_STAGES.has(lead.status);
  const src   = originTag(lead);

  el.innerHTML = `
    <div class="lead-card-head">
      <div
        class="lead-avatar"
        style="background: ${avatarColor(lead.name)}"
        aria-hidden="true"
      >${initials(lead.name)}</div>
      <div class="lead-card-info">
        <div class="lead-name">${esc(lead.name || 'Sem nome')}</div>
        <div class="lead-phone">${esc(lead.phone)}</div>
      </div>
    </div>

    <div class="lead-card-meta">
      ${lead.service_interest
        ? `<span class="tag tag-service">${esc(lead.service_interest)}</span>`
        : ''}
      ${lead.budget
        ? `<span class="tag tag-budget">${esc(lead.budget)}</span>`
        : ''}
      <span class="tag tag-source">${esc(src)}</span>
    </div>

    <div class="lead-card-footer">
      ${isAI
        ? '<span class="ai-indicator"><span class="ai-pulse" aria-hidden="true"></span>IA ativa</span>'
        : ''}
      <span class="lead-time" aria-label="Última mensagem: ${relativeTime(lead.last_message_at)} atrás">
        ${relativeTime(lead.last_message_at)}
      </span>
    </div>
  `;

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });

  return el;
}

/* ============================================================
   Build DOM: coluna do kanban
   ============================================================ */

function buildColumn(stage, leads) {
  const col = document.createElement('div');
  col.className = 'kanban-col';
  col.setAttribute('data-stage', stage.key);

  col.innerHTML = `
    <div class="col-header">
      <span class="col-dot ${stage.dotClass}" aria-hidden="true"></span>
      <span class="col-title">${esc(stage.label)}</span>
      <span
        class="col-count"
        aria-label="${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}"
      >${leads.length}</span>
    </div>
    <div
      class="col-body"
      role="list"
      aria-label="Leads em ${esc(stage.label)}"
    ></div>
  `;

  const body = col.querySelector('.col-body');
  leads.forEach(lead => body.appendChild(buildLeadCard(lead)));

  const addBtn = document.createElement('button');
  addBtn.className = 'col-add';
  addBtn.setAttribute('aria-label', `Adicionar lead em ${stage.label}`);
  addBtn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5"  y1="12" x2="19" y2="12"/>
    </svg>
    Adicionar
  `;
  body.appendChild(addBtn);

  return col;
}

/* ============================================================
   Skeleton (enquanto carrega)
   ============================================================ */

function renderSkeleton(board) {
  STAGES.forEach((stage, i) => {
    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.setAttribute('data-stage', stage.key);

    const skeletons = i === 0 ? 2 : i === 1 ? 1 : 0;
    let cardsHtml = '';
    for (let j = 0; j < skeletons; j++) {
      cardsHtml += `<div class="skeleton skeleton-card" style="opacity:${1 - j * 0.3}"></div>`;
    }

    col.innerHTML = `
      <div class="col-header">
        <span class="col-dot ${stage.dotClass}" aria-hidden="true"></span>
        <span class="col-title">${esc(stage.label)}</span>
        <span class="col-count">—</span>
      </div>
      <div class="col-body">${cardsHtml}</div>
    `;
    board.appendChild(col);
  });
}

/* ============================================================
   Fetch + render
   ============================================================ */

async function loadLeads() {
  const board     = document.getElementById('kanban-board');
  const countLabel = document.getElementById('lead-count-label');

  board.innerHTML = '';
  renderSkeleton(board);
  countLabel.textContent = 'Carregando…';

  let leads    = [];
  let usedMock = false;

  try {
    const res = await fetch('/api/leads', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    leads = Array.isArray(data.leads) ? data.leads : [];
    if (leads.length === 0) throw new Error('sem leads na API');
  } catch (err) {
    console.warn('[portal] /api/leads indisponível — usando mock:', err.message);
    leads    = MOCK_LEADS;
    usedMock = true;
  }

  /* Agrupa por estágio */
  const grouped = {};
  STAGES.forEach(s => { grouped[s.key] = []; });
  leads.forEach(lead => {
    const key = (lead.status in grouped) ? lead.status : 'novo';
    grouped[key].push(lead);
  });

  /* Renderiza colunas */
  board.innerHTML = '';
  STAGES.forEach(stage => board.appendChild(buildColumn(stage, grouped[stage.key])));

  /* Atualiza contagem */
  const total = leads.length;
  countLabel.textContent = usedMock
    ? `${total} leads · demonstração`
    : `${total} lead${total !== 1 ? 's' : ''} · ao vivo`;

  /* Atualiza badge na nav */
  const navBadge = document.querySelector('.nav-item[data-module="crm"] .nav-badge');
  if (navBadge) navBadge.textContent = String(total);
}

/* ============================================================
   Sidebar: troca de módulo (visual apenas — preview)
   ============================================================ */

function initSidebarNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i => {
        i.classList.remove('active');
        i.removeAttribute('aria-current');
      });
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    });
  });
}

/* ============================================================
   Search filter (client-side)
   ============================================================ */

function initSearch() {
  const input = document.querySelector('.topbar-search input');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.lead-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
}

/* ============================================================
   Init
   ============================================================ */

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  loadLeads();
  initSidebarNav();
  initSearch();
});

/* Expõe loadLeads para o botão de atualizar */
window.loadLeads = loadLeads;

// Ordem das colunas do funil.
const ORDER = ["novo", "em_atendimento", "qualificado", "proposta", "fechado", "perdido", "humano"];
let STATUS_LABELS = {};
let currentLeadId = null;

const board = document.getElementById("board");
const drawer = document.getElementById("drawer");

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

function fmtTime(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadBoard() {
  const { leads, statusLabels } = await api("/api/leads");
  STATUS_LABELS = statusLabels;
  board.innerHTML = "";

  const byStatus = {};
  ORDER.forEach((s) => (byStatus[s] = []));
  leads.forEach((l) => (byStatus[l.status] || (byStatus[l.status] = [])).push(l));

  for (const status of ORDER) {
    const col = document.createElement("div");
    col.className = "column";
    const items = byStatus[status] || [];
    col.innerHTML = `<h3>${STATUS_LABELS[status] || status} <span class="count">(${items.length})</span></h3>`;
    items.forEach((l) => col.appendChild(card(l)));
    board.appendChild(col);
  }
}

function card(l) {
  const el = document.createElement("div");
  el.className = "card";
  const waiting = l.last_direction === "out" && l.follow_up_count > 0;
  el.innerHTML = `
    <div class="name">${l.name || l.phone}</div>
    <div class="sub">${l.phone} · ${fmtTime(l.last_message_at)}</div>
    ${l.service_interest ? `<div class="svc">▸ ${escapeHtml(l.service_interest)}</div>` : ""}
    ${waiting ? `<div class="fu">⏳ ${l.follow_up_count} retomada(s) enviada(s)</div>` : ""}
  `;
  el.onclick = () => openLead(l.id);
  return el;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function openLead(id) {
  currentLeadId = id;
  const { lead, messages } = await api(`/api/leads/${id}`);

  document.getElementById("d-name").textContent = lead.name || lead.phone;
  document.getElementById("d-phone").textContent = lead.phone;
  document.getElementById("d-status").textContent = STATUS_LABELS[lead.status] || lead.status;
  document.getElementById("d-service").textContent = lead.service_interest || "";
  document.getElementById("d-budget").textContent = lead.budget ? "💰 " + lead.budget : "";

  const notes = document.getElementById("d-notes");
  if (lead.notes) { notes.textContent = "📝 " + lead.notes; notes.classList.remove("hidden"); }
  else notes.classList.add("hidden");

  // Select de status.
  const sel = document.getElementById("d-status-select");
  sel.innerHTML = ORDER.map((s) => `<option value="${s}" ${s === lead.status ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("");

  // Mensagens.
  const box = document.getElementById("d-messages");
  box.innerHTML = "";
  messages.forEach((m) => {
    const b = document.createElement("div");
    b.className = "bubble " + m.direction;
    b.innerHTML = `${escapeHtml(m.body)}<span class="t">${fmtTime(m.created_at)}</span>`;
    box.appendChild(b);
  });
  box.scrollTop = box.scrollHeight;

  drawer.classList.remove("hidden");
}

// Eventos
document.getElementById("refresh").onclick = loadBoard;
document.getElementById("d-close").onclick = () => { drawer.classList.add("hidden"); currentLeadId = null; };

document.querySelectorAll("[data-act]").forEach((btn) => {
  btn.onclick = async () => {
    if (!currentLeadId) return;
    await api(`/api/leads/${currentLeadId}/${btn.dataset.act}`, { method: "POST" });
    await openLead(currentLeadId);
    await loadBoard();
  };
});

document.getElementById("d-status-select").onchange = async (e) => {
  if (!currentLeadId) return;
  await api(`/api/leads/${currentLeadId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: e.target.value }),
  });
  await loadBoard();
  await openLead(currentLeadId);
};

document.getElementById("d-reply").onsubmit = async (e) => {
  e.preventDefault();
  const input = document.getElementById("d-reply-text");
  const text = input.value.trim();
  if (!text || !currentLeadId) return;
  input.value = "";
  await api(`/api/leads/${currentLeadId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  await openLead(currentLeadId);
  await loadBoard();
};

// Auto-refresh do board a cada 15s.
loadBoard();
setInterval(loadBoard, 15000);

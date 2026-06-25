import { Router } from "express";
import {
  listLeads,
  getLead,
  getMessages,
  addMessage,
  setStatus,
  updateLeadFields,
} from "../crm/leads";
import { sendText } from "../whatsapp/evolution";
import { STATUS_LABELS, LeadStatus } from "../types";

export const apiRouter = Router();

// Lista todos os leads (para o kanban).
apiRouter.get("/leads", (_req, res) => {
  res.json({ leads: listLeads(), statusLabels: STATUS_LABELS });
});

// Detalhe do lead + conversa.
apiRouter.get("/leads/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
  res.json({ lead, messages: getMessages(id) });
});

// Envia mensagem manual (humano respondendo). Coloca o lead em atendimento humano.
apiRouter.post("/leads/:id/reply", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).json({ error: "texto vazio" });

  try {
    await sendText(lead.phone, text);
    addMessage(id, "out", text);
    if (lead.status !== "humano") setStatus(id, "humano");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Altera o estagio do lead no funil.
apiRouter.post("/leads/:id/status", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
  const status = req.body?.status as LeadStatus;
  if (!status || !(status in STATUS_LABELS)) {
    return res.status(400).json({ error: "status invalido" });
  }
  setStatus(id, status);
  res.json({ ok: true });
});

// Assume o atendimento (pausa o agente).
apiRouter.post("/leads/:id/takeover", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!getLead(id)) return res.status(404).json({ error: "lead nao encontrado" });
  setStatus(id, "humano");
  res.json({ ok: true });
});

// Devolve o atendimento para o agente de IA.
apiRouter.post("/leads/:id/release", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!getLead(id)) return res.status(404).json({ error: "lead nao encontrado" });
  setStatus(id, "em_atendimento");
  res.json({ ok: true });
});

// Edita campos de qualificacao manualmente.
apiRouter.post("/leads/:id/edit", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!getLead(id)) return res.status(404).json({ error: "lead nao encontrado" });
  const { name, service_interest, budget, notes } = req.body ?? {};
  updateLeadFields(id, { name, service_interest, budget, notes });
  res.json({ ok: true });
});

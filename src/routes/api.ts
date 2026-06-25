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
apiRouter.get("/leads", async (_req, res) => {
  try {
    res.json({ leads: await listLeads(), statusLabels: STATUS_LABELS });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Detalhe do lead + conversa.
apiRouter.get("/leads/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const lead = await getLead(id);
    if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
    const messages = await getMessages(id);
    res.json({ lead, messages });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Envia mensagem manual (humano respondendo). Coloca o lead em atendimento humano.
apiRouter.post("/leads/:id/reply", async (req, res) => {
  const id = req.params.id;
  try {
    const lead = await getLead(id);
    if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
    const text = (req.body?.text ?? "").toString().trim();
    if (!text) return res.status(400).json({ error: "texto vazio" });

    await sendText(lead.phone, text);
    await addMessage(id, "out", text);
    if (lead.status !== "humano") await setStatus(id, "humano");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Altera o estagio do lead no funil.
apiRouter.post("/leads/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const lead = await getLead(id);
    if (!lead) return res.status(404).json({ error: "lead nao encontrado" });
    const status = req.body?.status as LeadStatus;
    if (!status || !(status in STATUS_LABELS)) {
      return res.status(400).json({ error: "status invalido" });
    }
    await setStatus(id, status);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Assume o atendimento (pausa o agente).
apiRouter.post("/leads/:id/takeover", async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await getLead(id))) return res.status(404).json({ error: "lead nao encontrado" });
    await setStatus(id, "humano");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Devolve o atendimento para o agente de IA.
apiRouter.post("/leads/:id/release", async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await getLead(id))) return res.status(404).json({ error: "lead nao encontrado" });
    await setStatus(id, "em_atendimento");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Edita campos de qualificacao manualmente.
apiRouter.post("/leads/:id/edit", async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await getLead(id))) return res.status(404).json({ error: "lead nao encontrado" });
    const { name, service_interest, budget, notes } = req.body ?? {};
    await updateLeadFields(id, { name, service_interest, budget, notes });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

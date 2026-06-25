import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLead, addMessage, setStatus } from "../../../src/crm/leads";
// sendText: apos Story 3.1, rota internamente via MAKE_SEND_URL quando definido.
import { sendText } from "../../../src/whatsapp/evolution";
import { guardMethod, requireId } from "../../_lib/validate";
import { ok, notFound, badRequest, serverError } from "../../_lib/response";

// POST /api/leads/:id/reply — envia mensagem manual (humano respondendo).
// Coloca o lead em atendimento humano e pausa o agente de IA.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;
  const id = requireId(req);
  if (!id) return badRequest(res, "id invalido");
  try {
    const lead = await getLead(id);
    if (!lead) return notFound(res, "lead nao encontrado");
    const text = (req.body?.text ?? "").toString().trim();
    if (!text) return badRequest(res, "texto vazio");
    await sendText(lead.phone, text);
    await addMessage(id, "out", text);
    if (lead.status !== "humano") await setStatus(id, "humano");
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}

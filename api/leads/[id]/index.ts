import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLead, getMessages } from "../../../src/crm/leads";
import { guardMethod, requireId } from "../../_lib/validate";
import { notFound, badRequest, serverError } from "../../_lib/response";

// GET /api/leads/:id — detalhe do lead + historico de conversa.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "GET")) return;
  const id = requireId(req);
  if (!id) return badRequest(res, "id invalido");
  try {
    const lead = await getLead(id);
    if (!lead) return notFound(res, "lead nao encontrado");
    const messages = await getMessages(id);
    res.status(200).json({ lead, messages });
  } catch (e) {
    return serverError(res, e);
  }
}

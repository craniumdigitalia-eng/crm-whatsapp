import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLead, setStatus } from "../../../src/crm/leads";
import { guardMethod, requireId } from "../../_lib/validate";
import { ok, notFound, badRequest, serverError } from "../../_lib/response";

// POST /api/leads/:id/release — devolve o atendimento para o agente de IA.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;
  const id = requireId(req);
  if (!id) return badRequest(res, "id invalido");
  try {
    if (!(await getLead(id))) return notFound(res, "lead nao encontrado");
    await setStatus(id, "em_atendimento");
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}

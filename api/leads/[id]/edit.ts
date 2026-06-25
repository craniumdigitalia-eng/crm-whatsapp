import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLead, updateLeadFields } from "../../../src/crm/leads";
import { guardMethod, requireId } from "../../_lib/validate";
import { ok, notFound, badRequest, serverError } from "../../_lib/response";

// POST /api/leads/:id/edit — edita campos de qualificacao manualmente.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;
  const id = requireId(req);
  if (!id) return badRequest(res, "id invalido");
  try {
    if (!(await getLead(id))) return notFound(res, "lead nao encontrado");
    const { name, service_interest, budget, notes } = req.body ?? {};
    await updateLeadFields(id, { name, service_interest, budget, notes });
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}

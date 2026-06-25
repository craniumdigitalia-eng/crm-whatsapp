import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLead, setStatus } from "../../../src/crm/leads";
import { guardMethod, requireId, validateStatus } from "../../_lib/validate";
import { ok, notFound, badRequest, serverError } from "../../_lib/response";

// POST /api/leads/:id/status — altera o estagio do lead no funil.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;
  const id = requireId(req);
  if (!id) return badRequest(res, "id invalido");
  try {
    const lead = await getLead(id);
    if (!lead) return notFound(res, "lead nao encontrado");
    const status = req.body?.status;
    if (!validateStatus(status)) return badRequest(res, "status invalido");
    await setStatus(id, status);
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}

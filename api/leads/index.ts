import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listLeads } from "../../src/crm/leads";
import { STATUS_LABELS } from "../../src/types";
import { guardMethod } from "../_lib/validate";
import { ok, serverError } from "../_lib/response";

// GET /api/leads — lista todos os leads para o kanban.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "GET")) return;
  try {
    res.status(200).json({ leads: await listLeads(), statusLabels: STATUS_LABELS });
  } catch (e) {
    return serverError(res, e);
  }
}

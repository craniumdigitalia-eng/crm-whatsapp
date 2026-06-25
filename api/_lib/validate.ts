import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_LABELS } from "../../src/types";
import type { LeadStatus } from "../../src/types";

// Retorna false e envia 405 se o metodo da requisicao nao for o esperado.
export function guardMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string
): boolean {
  if (req.method !== allowed) {
    res.status(405).json({ error: `metodo nao permitido: use ${allowed}` });
    return false;
  }
  return true;
}

// Extrai req.query.id como string.
// No Vercel, parametros dinamicos chegam via req.query — o tipo e string | string[].
export function requireId(req: VercelRequest): string | null {
  const id = req.query.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function validateStatus(s: unknown): s is LeadStatus {
  return typeof s === "string" && s in STATUS_LABELS;
}

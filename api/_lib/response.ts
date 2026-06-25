import type { VercelResponse } from "@vercel/node";

// Helpers de resposta compartilhados entre todos os handlers em api/.
// Eliminam o try/catch e os res.status().json() inline repetidos em cada funcao.

export const ok = (res: VercelResponse, data: object = { ok: true }) =>
  res.status(200).json(data);

export const notFound = (res: VercelResponse, msg = "nao encontrado") =>
  res.status(404).json({ error: msg });

export const badRequest = (res: VercelResponse, msg: string) =>
  res.status(400).json({ error: msg });

export const serverError = (res: VercelResponse, e: unknown) => {
  console.error("[api]", e);
  return res.status(500).json({ error: e instanceof Error ? e.message : "erro interno" });
};

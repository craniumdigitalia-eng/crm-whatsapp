import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guardMethod } from "./_lib/validate";

// GET /api/health — liveness check. Equivalente ao app.get("/health") do Express.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "GET")) return;
  res.status(200).json({ ok: true });
}

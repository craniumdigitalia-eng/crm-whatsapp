import crypto from "crypto";
import { config } from "../config";

// =====================================================================
// Assinatura HMAC dos links de email (migration 007 — QA E0/E3).
// Protege:
//   - click: a URL de destino é assinada; o /track/click recusa redirects
//     não assinados (anti open-redirect / phishing).
//   - unsubscribe: o link de descadastro é assinado; só descadastra com
//     assinatura válida (evita abuso de terceiros).
// Mesmo segredo para os dois. Use EMAIL_TRACK_SECRET em produção; o fallback
// reaproveita segredos estáveis já existentes do servidor.
// =====================================================================

function secret(): string {
  return (
    config.emailTrackSecret ||
    config.cronSecret ||
    config.supabaseServiceRoleKey ||
    "dev-insecure-email-secret"
  );
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("hex");
}

// Assina uma sequência de partes (juntadas por "|"). A ordem importa.
export function sign(parts: string[]): string {
  return hmac(parts.join("|"));
}

// Verifica a assinatura em tempo constante (evita timing attack).
export function verify(parts: string[], sig: string | null | undefined): boolean {
  if (!sig) return false;
  const expected = sign(parts);
  // Comprimentos diferentes => timingSafeEqual lança; compara cedo.
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Domínios de assinatura (prefixos) — separam clicks de descadastros para que
// uma assinatura de um nunca sirva no outro.
export function signClick(campaignId: string, email: string, url: string): string {
  return sign(["click", campaignId, email, url]);
}
export function verifyClick(
  campaignId: string,
  email: string,
  url: string,
  sig: string | null
): boolean {
  return verify(["click", campaignId, email, url], sig);
}

export function signUnsub(campaignId: string, email: string): string {
  return sign(["unsub", campaignId, email]);
}
export function verifyUnsub(campaignId: string, email: string, sig: string | null): boolean {
  return verify(["unsub", campaignId, email], sig);
}

import { supabase } from "../db";

// =====================================================================
// Throttle por janela fixa usando a tabela `public.rate_limits` no Supabase.
//
// Funciona em serverless stateless: o estado (contagem) fica no banco, nao
// em memoria. Uma invocacao de Lambda/Vercel conta igual a qualquer outra.
//
// Logica de janela fixa:
//   - Cada (key, janela) tem uma linha na tabela.
//   - A janela e identificada por floor(epoch_segundos / janela_segundos).
//   - UPSERT atomico: se ja existe a linha da janela atual, incrementa count;
//     se nao existe (nova janela), insere com count=1.
//   - Rejeita se count (pos-incremento) > limit.
//
// Nao tem Redis, nao tem estado em memoria — simples e confiavel em serverless.
// Desvantagem conhecida: burst no inicio da janela e possivel (comportamento normal
// de janela fixa); para ingress de custo alto (webhook) e suficiente.
//
// Migration: supabase/migrations/016-rate-limit.sql
// =====================================================================

export interface RateLimitResult {
  // true = request dentro do limite, pode prosseguir.
  allowed: boolean;
  // Quantas requests foram contadas na janela atual (pos-incremento).
  count: number;
  // Limite configurado para esta chave.
  limit: number;
}

// Opcoes de throttle.
export interface ThrottleOptions {
  // Chave unica: combina rota + identificador (ex: "webhook:1.2.3.4").
  key: string;
  // Numero maximo de requests permitidas por janela.
  limit: number;
  // Duracao da janela em segundos (default: 60).
  windowSec?: number;
}

// Verifica e incrementa o contador. Se falhar (banco indisponivel), retorna
// allowed=true para nao derrubar o servico por erro de infra de rate limit.
export async function throttle(opts: ThrottleOptions): Promise<RateLimitResult> {
  const windowSec = opts.windowSec ?? 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = new Date((nowSec - (nowSec % windowSec)) * 1000).toISOString();

  try {
    // UPSERT atomico: incrementa count se a linha ja existe para (key, window_start),
    // ou insere com count=1 se for uma nova janela. O banco garante atomicidade.
    const { data, error } = await supabase.rpc("upsert_rate_limit", {
      p_key: opts.key,
      p_window_start: windowStart,
    });

    if (error) {
      // Falha de infra: fail-open (nao derruba o servico).
      console.warn("[rate-limit] erro ao verificar throttle:", error.message);
      return { allowed: true, count: 0, limit: opts.limit };
    }

    const count = (data as number) ?? 1;
    return { allowed: count <= opts.limit, count, limit: opts.limit };
  } catch (e) {
    // Qualquer excecao de rede ou banco: fail-open com log.
    console.warn("[rate-limit] excecao no throttle:", (e as Error).message);
    return { allowed: true, count: 0, limit: opts.limit };
  }
}

// Extrai o IP do cliente de um Request do Next.js App Router.
// Tenta os headers de proxy mais comuns (Vercel, Cloudflare, etc.).
// Retorna "unknown" se nao conseguir determinar.
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

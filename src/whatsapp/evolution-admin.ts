import { getEvolutionConfig, type EvolutionConfig } from "../crm/integrations";

// =====================================================================
// Gerenciamento da instancia Evolution (conectar via QR, status, logout).
// Story Evolution — usado pelos endpoints proxied app/api/integrations/evolution/*.
// O browser NUNCA fala direto com a Evolution: estes helpers rodam no server e
// resolvem url/apikey via getEvolutionConfig (env + integrations_config).
// =====================================================================

// Erro de configuracao ausente — vira 409 "Evolution nao configurada" no endpoint,
// em vez de um 500 generico. Distingue "falta config" de "Evolution fora do ar".
export class EvolutionConfigError extends Error {
  constructor(message = "Evolution nao configurada (defina EVOLUTION_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE)") {
    super(message);
    this.name = "EvolutionConfigError";
  }
}

// Erro ao falar com a Evolution (rede, 4xx/5xx da API). Vira 502 no endpoint.
export class EvolutionApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "EvolutionApiError";
    this.status = status;
  }
}

async function resolveConfig(): Promise<EvolutionConfig> {
  const cfg = await getEvolutionConfig();
  if (!cfg.url || !cfg.apiKey || !cfg.instance) throw new EvolutionConfigError();
  return cfg;
}

// fetch com timeout — uma Evolution fora do ar nao pode pendurar a Vercel function.
async function evoFetch(cfg: EvolutionConfig, path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: { apikey: cfg.apiKey, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (e) {
    throw new EvolutionApiError(
      `nao foi possivel contatar a Evolution em ${cfg.url}: ${(e as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface ConnectResult {
  // Data URL "data:image/png;base64,..." do QR code (quando aplicavel).
  base64?: string;
  // Codigo do QR / pairing code alternativo (digitar no celular).
  code?: string;
  pairingCode?: string;
  // Estado ja conectado: a Evolution responde sem QR quando a instancia esta "open".
  alreadyConnected: boolean;
}

// Extrai QR/base64 de respostas com formatos diferentes:
// - GET /instance/connect  -> { base64, code, pairingCode }
// - POST /instance/create  -> { qrcode: { base64, code, pairingCode } }
function extractQr(body: any): Omit<ConnectResult, "alreadyConnected"> {
  const qr = body?.qrcode ?? body ?? {};
  return {
    base64: qr.base64 ?? undefined,
    code: qr.code ?? undefined,
    pairingCode: qr.pairingCode ?? body?.pairingCode ?? undefined,
  };
}

// Conecta a instancia e devolve o QR para parear. Se a instancia ainda nao existe
// na Evolution (404), cria com qrcode=true e devolve o QR da criacao.
export async function connectInstance(): Promise<ConnectResult> {
  const cfg = await resolveConfig();

  // 1) Tenta conectar uma instancia ja existente.
  const res = await evoFetch(cfg, `/instance/connect/${encodeURIComponent(cfg.instance)}`);

  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    const qr = extractQr(body);
    // Quando ja esta conectada, a Evolution responde { instance: { state: "open" } } sem QR.
    const alreadyConnected = !qr.base64 && (body?.instance?.state === "open" || body?.state === "open");
    return { ...qr, alreadyConnected };
  }

  // 2) Instancia inexistente -> cria (com QR). Outros erros: propaga.
  if (res.status === 404) {
    const created = await evoFetch(cfg, "/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: cfg.instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });
    if (!created.ok) {
      const txt = await created.text().catch(() => "");
      throw new EvolutionApiError(`falha ao criar instancia (${created.status}): ${txt}`);
    }
    const body = await created.json().catch(() => ({}));
    return { ...extractQr(body), alreadyConnected: false };
  }

  const txt = await res.text().catch(() => "");
  throw new EvolutionApiError(`falha ao conectar (${res.status}): ${txt}`);
}

export type ConnectionState = "connected" | "connecting" | "disconnected";

export interface StatusResult {
  state: ConnectionState;
  // Numero conectado (somente digitos), quando a instancia esta "open".
  number?: string;
  profileName?: string;
}

function mapState(raw: string | undefined): ConnectionState {
  if (raw === "open") return "connected";
  if (raw === "connecting") return "connecting";
  return "disconnected";
}

// Tenta extrair o numero/profile da instancia conectada (best-effort — varia por versao).
async function fetchNumber(cfg: EvolutionConfig): Promise<{ number?: string; profileName?: string }> {
  try {
    const res = await evoFetch(
      cfg,
      `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`
    );
    if (!res.ok) return {};
    const body = await res.json().catch(() => null);
    const list = Array.isArray(body) ? body : [body];
    for (const item of list) {
      // v2: item direto; versoes antigas: item.instance.
      const inst = item?.instance ?? item ?? {};
      const owner: string = inst.ownerJid ?? inst.owner ?? inst.number ?? "";
      if (owner) {
        return {
          number: String(owner).split("@")[0] || undefined,
          profileName: inst.profileName ?? inst.profileName ?? undefined,
        };
      }
    }
  } catch {
    // best-effort: ignora falha ao buscar numero.
  }
  return {};
}

// Estado da conexao da instancia. 404 (instancia nao criada) => "disconnected".
export async function instanceStatus(): Promise<StatusResult> {
  const cfg = await resolveConfig();
  const res = await evoFetch(cfg, `/instance/connectionState/${encodeURIComponent(cfg.instance)}`);

  if (res.status === 404) return { state: "disconnected" };
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new EvolutionApiError(`falha ao consultar status (${res.status}): ${txt}`);
  }

  const body = await res.json().catch(() => ({}));
  const state = mapState(body?.instance?.state ?? body?.state);
  if (state !== "connected") return { state };

  const extra = await fetchNumber(cfg);
  return { state, ...extra };
}

// Desconecta (logout) a instancia — derruba a sessao do WhatsApp pareado.
export async function logoutInstance(): Promise<void> {
  const cfg = await resolveConfig();
  const res = await evoFetch(cfg, `/instance/logout/${encodeURIComponent(cfg.instance)}`, {
    method: "DELETE",
  });
  // 404 = ja desconectada/inexistente: tratamos como sucesso idempotente.
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => "");
    throw new EvolutionApiError(`falha ao desconectar (${res.status}): ${txt}`);
  }
}

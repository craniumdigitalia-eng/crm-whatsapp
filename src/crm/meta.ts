import crypto from "crypto";
import { getOrCreateLead, findLeadByPhone, findLeadByLeadgenId, setLeadAttribution, updateLeadFields } from "./leads";

// Extrai o e-mail das respostas do formulario do Meta (campo "email"/"e-mail" ou
// qualquer valor que pareca um e-mail). Retorna undefined se nao achar.
function emailFromFormData(formData: Record<string, string>): string | undefined {
  for (const [k, v] of Object.entries(formData)) {
    const val = (v ?? "").trim();
    if (!val) continue;
    if (/e-?mail/i.test(k) && val.includes("@")) return val;
  }
  // Fallback: primeiro valor que tenha cara de e-mail.
  for (const v of Object.values(formData)) {
    const val = (v ?? "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return val;
  }
  return undefined;
}
import { MetaConfig } from "./integrations";
import { Lead } from "../types";

// =====================================================================
// Meta / Facebook Lead Ads — integracao com a Graph API (Story 5.14).
//
// Dois caminhos de entrada:
//   1. Importacao sob demanda:  GET /{form_id}/leads        (meta/import)
//   2. Webhook leadgen (tempo real): busca GET /{leadgen_id} (app/api/leadgen)
//
// Ambos terminam em upsertMetaLead(), idempotente por leadgen_id.
// =====================================================================

// Lead cru retornado pela Graph API.
export interface MetaRawLead {
  id: string; // = leadgen_id
  created_time?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: Array<{ name: string; values: string[] }>;
}

const GRAPH = "https://graph.facebook.com";

// --- Parsing dos campos do formulario -------------------------------

// Normaliza um nome de campo para casar PT/EN com/sem acento e separadores.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
    .replace(/[^a-z0-9]/g, "");
}

// Nomes de campo comuns para telefone e nome (Meta usa chaves padronizadas).
const PHONE_KEYS = ["phonenumber", "phone", "telefone", "celular", "whatsapp", "tel"];
const NAME_KEYS = ["fullname", "name", "nome", "nomecompleto", "seunome"];
const FIRST_KEYS = ["firstname", "primeironome"];
const LAST_KEYS = ["lastname", "sobrenome", "ultimonome"];

function joinValues(values: string[] | undefined): string {
  return (values ?? []).filter(Boolean).join(" ").trim();
}

// So digitos (+ inicial). Mantem o numero como veio se nao reconhecer formato.
function cleanPhone(raw: string): string {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned || trimmed;
}

export interface ParsedMetaLead {
  name?: string;
  phone?: string;
  // Mapa "rotulo do campo" -> "resposta" (todas as respostas, para form_data).
  formData: Record<string, string>;
}

// Extrai nome, telefone e o mapa completo de respostas do field_data.
export function parseFieldData(
  fieldData: Array<{ name: string; values: string[] }> | undefined
): ParsedMetaLead {
  const formData: Record<string, string> = {};
  let name: string | undefined;
  let phone: string | undefined;
  let first: string | undefined;
  let last: string | undefined;

  for (const field of fieldData ?? []) {
    const value = joinValues(field.values);
    if (!field.name) continue;
    formData[field.name] = value; // preserva o rotulo original do formulario
    const key = norm(field.name);
    if (!phone && PHONE_KEYS.includes(key)) phone = cleanPhone(value);
    else if (!name && NAME_KEYS.includes(key)) name = value;
    else if (FIRST_KEYS.includes(key)) first = value;
    else if (LAST_KEYS.includes(key)) last = value;
  }

  // Monta nome a partir de first/last quando nao ha um campo "nome completo".
  if (!name) {
    const combined = [first, last].filter(Boolean).join(" ").trim();
    if (combined) name = combined;
  }

  return { name: name || undefined, phone: phone || undefined, formData };
}

// --- Payload do Make (caminho principal) ----------------------------
//
// O lead chega pelo formulario instantaneo do Meta, capturado pelo conector
// "Facebook Lead Ads" do Make, que faz POST /api/leadgen. O Make pode mandar:
//   a) o lead cru do Meta com `field_data` (array {name, values}); ou
//   b) um objeto plano onde cada resposta vira um campo do JSON (mapeado no cenario).
// Suportamos os dois. Extraimos nome, telefone, atribuicao e TODAS as respostas (form_data).

export interface ParsedMakeLead {
  name?: string;
  phone?: string;
  leadgenId?: string;
  formId?: string;
  adId?: string;
  campaignId?: string;
  formData: Record<string, string>;
}

// Chaves de atribuicao/metadados — NAO entram em form_data (nao sao respostas do lead).
const ATTR_KEYS = new Set([
  "id",
  "leadgen_id",
  "lead_id",
  "created_time",
  "form_id",
  "formid",
  "form_name",
  "ad_id",
  "adid",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaignid",
  "campaign_name",
  "page_id",
  "platform",
  "is_organic",
  "source",
  "secret",
  "token",
]);

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export function parseMakeLead(body: unknown): ParsedMakeLead {
  const b = (body ?? {}) as Record<string, unknown>;
  const leadgenId = asString(b.leadgen_id ?? b.lead_id ?? b.id);
  const formId = asString(b.form_id ?? (b as Record<string, unknown>).formId);
  const adId = asString(b.ad_id ?? (b as Record<string, unknown>).adId);
  const campaignId = asString(b.campaign_id ?? (b as Record<string, unknown>).campaignId);

  // (a) Make enviou o lead cru do Meta (field_data array) — reusa o parser do Meta.
  if (Array.isArray((b as { field_data?: unknown }).field_data)) {
    const parsed = parseFieldData((b as { field_data: Array<{ name: string; values: string[] }> }).field_data);
    return { name: parsed.name, phone: parsed.phone, leadgenId, formId, adId, campaignId, formData: parsed.formData };
  }

  // (b) Objeto plano: cada campo escalar (exceto metadados) e uma resposta do formulario.
  const formData: Record<string, string> = {};
  let name: string | undefined;
  let phone: string | undefined;
  let first: string | undefined;
  let last: string | undefined;

  for (const [rawKey, rawVal] of Object.entries(b)) {
    if (rawVal === null || rawVal === undefined) continue;
    if (typeof rawVal === "object") continue; // ignora arrays/objetos aninhados de metadados
    const value = String(rawVal).trim();
    if (!value) continue;
    if (ATTR_KEYS.has(rawKey.toLowerCase())) continue;
    formData[rawKey] = value; // preserva o rotulo original
    const key = norm(rawKey);
    if (!phone && PHONE_KEYS.includes(key)) phone = cleanPhone(value);
    else if (!name && NAME_KEYS.includes(key)) name = value;
    else if (FIRST_KEYS.includes(key)) first = value;
    else if (LAST_KEYS.includes(key)) last = value;
  }

  if (!name) {
    const combined = [first, last].filter(Boolean).join(" ").trim();
    if (combined) name = combined;
  }

  return { name, phone, leadgenId, formId, adId, campaignId, formData };
}

// Cria/atualiza um lead a partir do payload do Make. Idempotente por leadgen_id
// (quando houver) e, em seguida, por telefone (mesmo contato que ja conversou).
export async function upsertMakeLead(parsed: ParsedMakeLead): Promise<UpsertResult> {
  if (parsed.leadgenId) {
    const existing = await findLeadByLeadgenId(parsed.leadgenId);
    if (existing) return { lead: existing, created: false };
  }

  // Sem telefone, usa marcador sintetico (phone e NOT NULL/unique); o dedupe real e o leadgen_id.
  const phone =
    parsed.phone || (parsed.leadgenId ? `meta:${parsed.leadgenId}` : `meta:${crypto.randomUUID()}`);

  const existingByPhone = await findLeadByPhone(phone);
  const lead = await getOrCreateLead(phone, parsed.name);

  await setLeadAttribution(lead.id, {
    source: "meta_lead_ads",
    form_id: parsed.formId ?? null,
    leadgen_id: parsed.leadgenId ?? null,
    ad_id: parsed.adId ?? null,
    campaign_id: parsed.campaignId ?? null,
    form_data: parsed.formData,
  });

  // Salva o e-mail do formulario no lead (se veio e o lead ainda nao tem). Isso
  // ja dispara a entrada na lista automatica de e-mail (via updateLeadFields).
  const email = emailFromFormData(parsed.formData);
  if (email && !lead.email) {
    await updateLeadFields(lead.id, { email, name: parsed.name });
    lead.email = email;
  }

  return { lead, created: !existingByPhone };
}

// --- Chamadas a Graph API -------------------------------------------

// Erro tipado para o route handler distinguir credencial ausente de falha da API.
export class MetaError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "MetaError";
  }
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${GRAPH}/${path}?${qs}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new MetaError(`falha de rede ao chamar a Graph API: ${(e as Error).message}`, 502);
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; type?: string; code?: number };
  } & T;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Graph API respondeu ${res.status}`;
    // 190 = token invalido/expirado; 100 = parametro/permissao.
    throw new MetaError(`Graph API: ${msg}`, res.status === 200 ? 400 : res.status);
  }
  return json;
}

// Campos pedidos a Graph API em cada lead.
const LEAD_FIELDS = "id,created_time,ad_id,adset_id,campaign_id,form_id,field_data";

// Busca os leads de um formulario instantaneo. Pagina automaticamente (limit).
export async function fetchFormLeads(
  cfg: MetaConfig,
  formId: string,
  limit = 100
): Promise<MetaRawLead[]> {
  if (!cfg.pageAccessToken) throw new MetaError("Page Access Token ausente", 400);
  if (!formId) throw new MetaError("Form ID ausente", 400);

  const out: MetaRawLead[] = [];
  let after: string | undefined;
  // Trava de seguranca: no maximo 50 paginas por importacao (5k leads @100).
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string> = {
      access_token: cfg.pageAccessToken,
      fields: LEAD_FIELDS,
      limit: String(limit),
    };
    if (after) params.after = after;
    const data = await graphGet<{
      data: MetaRawLead[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`${cfg.graphVersion}/${formId}/leads`, params);
    out.push(...(data.data ?? []));
    after = data.paging?.next ? data.paging?.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}

// Busca um unico lead pelo leadgen_id (usado pelo webhook em tempo real).
export async function fetchSingleLead(cfg: MetaConfig, leadgenId: string): Promise<MetaRawLead> {
  if (!cfg.pageAccessToken) throw new MetaError("Page Access Token ausente", 400);
  return graphGet<MetaRawLead>(`${cfg.graphVersion}/${leadgenId}`, {
    access_token: cfg.pageAccessToken,
    fields: LEAD_FIELDS,
  });
}

// --- Upsert no CRM ---------------------------------------------------

export interface UpsertResult {
  lead: Lead;
  created: boolean; // false = lead ja existia (dedupe por leadgen_id ou telefone)
}

// Cria/atualiza um lead a partir de um MetaRawLead. Idempotente por leadgen_id.
export async function upsertMetaLead(raw: MetaRawLead): Promise<UpsertResult> {
  const leadgenId = raw.id;

  // 1) Dedupe: ja importamos este leadgen_id? -> nao-op, retorna o existente.
  if (leadgenId) {
    const existing = await findLeadByLeadgenId(leadgenId);
    if (existing) return { lead: existing, created: false };
  }

  const parsed = parseFieldData(raw.field_data);

  // 2) Resolve o telefone. Sem telefone no formulario, usa um marcador
  //    sintetico (a coluna phone e NOT NULL e unique) — o dedupe real e o leadgen_id.
  const phone = parsed.phone || (leadgenId ? `meta:${leadgenId}` : `meta:${crypto.randomUUID()}`);

  // getOrCreateLead pode encontrar um lead ja existente pelo telefone
  // (ex.: mesmo contato que ja conversou no WhatsApp) — nesse caso anexamos a atribuicao.
  const existingByPhone = await findLeadByPhone(phone);
  const lead = await getOrCreateLead(phone, parsed.name);

  await setLeadAttribution(lead.id, {
    source: "meta_lead_ads",
    form_id: raw.form_id ?? null,
    leadgen_id: leadgenId ?? null,
    ad_id: raw.ad_id ?? null,
    campaign_id: raw.campaign_id ?? null,
    form_data: parsed.formData,
  });

  // Salva o e-mail do formulario no lead (se veio e o lead ainda nao tem). Isso
  // ja dispara a entrada na lista automatica de e-mail (via updateLeadFields).
  const email = emailFromFormData(parsed.formData);
  if (email && !lead.email) {
    await updateLeadFields(lead.id, { email, name: parsed.name });
    lead.email = email;
  }

  return { lead, created: !existingByPhone };
}

// Importa um lote de leads crus, idempotente. Retorna contadores.
export async function importLeads(raws: MetaRawLead[]): Promise<{
  imported: number;
  skipped: number;
  errors: number;
}> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  for (const raw of raws) {
    try {
      const { created } = await upsertMetaLead(raw);
      if (created) imported++;
      else skipped++;
    } catch (e) {
      errors++;
      console.error(`[meta] falha ao importar leadgen ${raw.id}:`, (e as Error).message);
    }
  }
  return { imported, skipped, errors };
}

// --- Verificacao de assinatura do webhook ---------------------------

// Valida o header X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o App Secret).
// rawBody deve ser o corpo EXATO recebido (string), nao re-serializado.
export function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!appSecret) {
    // Sem App Secret configurado nao da pra validar — recusa por seguranca.
    console.warn("[meta] verifySignature: META_APP_SECRET ausente — recusando webhook");
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);
  const hmac = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  // timingSafeEqual exige buffers do mesmo tamanho.
  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Extrai os leadgen_ids de um payload de webhook leadgen do Meta.
export interface LeadgenChange {
  leadgenId: string;
  formId?: string;
  pageId?: string;
  adId?: string;
}

export function parseLeadgenPayload(body: unknown): LeadgenChange[] {
  const out: LeadgenChange[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const c = change as { field?: string; value?: Record<string, unknown> };
      if (c.field !== "leadgen" || !c.value) continue;
      const v = c.value;
      const leadgenId = typeof v.leadgen_id === "string" ? v.leadgen_id : String(v.leadgen_id ?? "");
      if (!leadgenId) continue;
      out.push({
        leadgenId,
        formId: typeof v.form_id === "string" ? v.form_id : undefined,
        pageId: typeof v.page_id === "string" ? v.page_id : undefined,
        adId: typeof v.ad_id === "string" ? v.ad_id : undefined,
      });
    }
  }
  return out;
}

import { supabase } from "../db";
import { LeadStatus } from "../types";
import { config } from "../config";
import { getEmailProvider } from "./email-provider";
import { signClick, signUnsub } from "./email-sign";

// =====================================================================
// Domínio Email Marketing (migration 007).
// Listas/contatos, templates, campanhas + resolução de destinatários,
// envio (motor plugável) e tracking (open/click). Tudo server-side via
// service_role (src/db.ts) — nunca exposto direto ao client.
// =====================================================================

// ---------- Tipos ----------

export interface EmailList {
  id: string;
  name: string;
  created_at: string;
}

export interface EmailContact {
  id: string;
  list_id: string;
  email: string;
  name: string | null;
  unsubscribed: boolean;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  html: string | null;
  created_at: string;
  updated_at: string;
}

// Público-alvo da campanha. Discriminado por `type`:
//   leads → leads do CRM filtrados por estágio e/ou etiqueta (precisam ter email)
//   list  → todos os contatos (não descadastrados) de uma lista
export type Audience =
  | { type: "leads"; filters?: { status?: LeadStatus[]; tags?: string[] } }
  | { type: "list"; list_id: string };

export type CampaignStatus = "rascunho" | "enviando" | "enviada" | "erro";

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string | null;
  template_id: string | null;
  html: string | null;
  audience: Audience | null;
  status: CampaignStatus;
  sent_count: number;
  created_at: string;
  sent_at: string | null;
}

export type EmailEventType = "sent" | "open" | "click" | "bounce" | "unsubscribe";

export interface Recipient {
  email: string;
  name: string | null;
}

export interface CampaignStats {
  sent: number;
  open: number;
  click: number;
  bounce: number;
  unsubscribe: number;
}

const LIST_COLS = "id,name,created_at";
const CONTACT_COLS = "id,list_id,email,name,unsubscribed,created_at";
const TEMPLATE_COLS = "id,name,subject,html,created_at,updated_at";
const CAMPAIGN_COLS =
  "id,name,subject,template_id,html,audience,status,sent_count,created_at,sent_at";

// Validação simples de email (suficiente para descartar lixo de CSV).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

// ---------- Listas ----------

export async function listLists(): Promise<EmailList[]> {
  const { data, error } = await supabase
    .from("email_lists")
    .select(LIST_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailList[];
}

export async function getList(id: string): Promise<EmailList | undefined> {
  const { data } = await supabase.from("email_lists").select(LIST_COLS).eq("id", id).maybeSingle();
  return (data as EmailList) ?? undefined;
}

export async function createList(name: string): Promise<EmailList> {
  const { data, error } = await supabase
    .from("email_lists")
    .insert({ name })
    .select(LIST_COLS)
    .single();
  if (error) throw error;
  return data as EmailList;
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase.from("email_lists").delete().eq("id", id);
  if (error) throw error;
}

// Mapa list_id -> total de contatos (para a UI mostrar a contagem por lista).
export async function getListCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("email_contacts").select("list_id");
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ list_id: string }>) {
    map[row.list_id] = (map[row.list_id] ?? 0) + 1;
  }
  return map;
}

// ---------- Contatos ----------

export async function listContacts(listId: string): Promise<EmailContact[]> {
  const { data, error } = await supabase
    .from("email_contacts")
    .select(CONTACT_COLS)
    .eq("list_id", listId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailContact[];
}

// Insere contatos numa lista. Idempotente: (list_id, lower(email)) é único,
// então duplicatas são ignoradas. Retorna quantos foram efetivamente inseridos.
export async function addContacts(
  listId: string,
  contacts: Array<{ email: string; name?: string | null }>
): Promise<number> {
  // Filtra/normaliza e deduplica por email dentro do próprio lote.
  const seen = new Set<string>();
  const rows: Array<{ list_id: string; email: string; name: string | null }> = [];
  for (const c of contacts) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    rows.push({ list_id: listId, email, name: c.name?.trim() || null });
  }
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from("email_contacts")
    .upsert(rows, { onConflict: "list_id,email", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("email_contacts").delete().eq("id", id);
  if (error) throw error;
}

// Descadastro (opt-out) — QA E0. Idempotente. Faz as duas coisas:
//   1) grava na supressão GLOBAL (email_unsubscribes) — nunca mais recebe campanha;
//   2) marca unsubscribed=true nos contatos daquele email (reflete na UI das listas).
// campaignId/reason são opcionais (rastreabilidade do opt-out).
export async function suppressEmail(
  email: string,
  campaignId?: string | null,
  reason?: string
): Promise<void> {
  const norm = email.trim().toLowerCase();
  if (!norm) return;

  // 1) supressão global (PK email — upsert idempotente).
  const { error: supErr } = await supabase
    .from("email_unsubscribes")
    .upsert(
      { email: norm, campaign_id: campaignId ?? null, reason: reason ?? null },
      { onConflict: "email", ignoreDuplicates: true }
    );
  if (supErr) throw supErr;

  // 2) reflete nos contatos das listas (não-crítico se falhar).
  const { error: cErr } = await supabase
    .from("email_contacts")
    .update({ unsubscribed: true })
    .eq("email", norm);
  if (cErr) {
    console.error(`[email] suppressEmail: falha ao marcar contatos de ${norm}:`, cErr.message);
  }
}

// Compat: mantém o nome antigo apontando para o fluxo completo de supressão.
export async function unsubscribeEmail(email: string): Promise<void> {
  return suppressEmail(email);
}

// Subconjunto dos emails (já normalizados em minúsculas) que estão na supressão
// global. Usado para excluir descadastrados de QUALQUER público antes do envio.
export async function getSuppressedSet(emails: string[]): Promise<Set<string>> {
  const norm = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (norm.length === 0) return new Set();
  const { data, error } = await supabase
    .from("email_unsubscribes")
    .select("email")
    .in("email", norm);
  if (error) throw error;
  return new Set(((data ?? []) as Array<{ email: string }>).map((r) => r.email.toLowerCase()));
}

// Parser de CSV simples (sem dependência externa). Aceita:
//   - cabeçalho opcional com colunas "email" e "name" (em qualquer ordem);
//   - sem cabeçalho: 1ª coluna = email, 2ª (opcional) = name;
//   - separador vírgula ou ponto-e-vírgula; aspas simples ao redor do campo.
// Linhas sem email válido são descartadas.
export function parseCsv(text: string): Array<{ email: string; name: string | null }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const splitRow = (line: string): string[] =>
    line.split(/[,;]/).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim());

  // Detecta cabeçalho: primeira linha contém a palavra "email".
  let emailIdx = 0;
  let nameIdx = 1;
  let start = 0;
  const firstCells = splitRow(lines[0]).map((c) => c.toLowerCase());
  if (firstCells.some((c) => c === "email" || c === "e-mail")) {
    emailIdx = firstCells.findIndex((c) => c === "email" || c === "e-mail");
    const ni = firstCells.findIndex((c) => c === "name" || c === "nome");
    nameIdx = ni >= 0 ? ni : -1;
    start = 1;
  }

  const out: Array<{ email: string; name: string | null }> = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const email = (cells[emailIdx] ?? "").toLowerCase();
    if (!isValidEmail(email)) continue;
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? "").trim() || null : null;
    out.push({ email, name });
  }
  return out;
}

// ---------- Templates ----------

export async function listTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select(TEMPLATE_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}

export async function getTemplate(id: string): Promise<EmailTemplate | undefined> {
  const { data } = await supabase
    .from("email_templates")
    .select(TEMPLATE_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as EmailTemplate) ?? undefined;
}

export async function createTemplate(fields: {
  name: string;
  subject?: string;
  html?: string;
}): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: fields.name,
      subject: fields.subject ?? null,
      html: fields.html ?? null,
    })
    .select(TEMPLATE_COLS)
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateTemplate(
  id: string,
  fields: Partial<Pick<EmailTemplate, "name" | "subject" | "html">>
): Promise<EmailTemplate | undefined> {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.subject !== undefined) patch.subject = fields.subject;
  if (fields.html !== undefined) patch.html = fields.html;
  if (Object.keys(patch).length === 0) return getTemplate(id);
  const { data, error } = await supabase
    .from("email_templates")
    .update(patch)
    .eq("id", id)
    .select(TEMPLATE_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as EmailTemplate) ?? undefined;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Campanhas ----------

export async function listCampaigns(): Promise<EmailCampaign[]> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .select(CAMPAIGN_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailCampaign[];
}

export async function getCampaign(id: string): Promise<EmailCampaign | undefined> {
  const { data } = await supabase
    .from("email_campaigns")
    .select(CAMPAIGN_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as EmailCampaign) ?? undefined;
}

export async function createCampaign(fields: {
  name: string;
  subject?: string;
  template_id?: string | null;
  html?: string;
  audience?: Audience | null;
}): Promise<EmailCampaign> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: fields.name,
      subject: fields.subject ?? null,
      template_id: fields.template_id ?? null,
      html: fields.html ?? null,
      audience: fields.audience ?? null,
      status: "rascunho",
    })
    .select(CAMPAIGN_COLS)
    .single();
  if (error) throw error;
  return data as EmailCampaign;
}

// Edita uma campanha. Só permitido enquanto rascunho/erro — campanhas em
// envio ou já enviadas são imutáveis (histórico).
export class CampaignLockedError extends Error {
  constructor(message = "campanha não editável neste status") {
    super(message);
    this.name = "CampaignLockedError";
  }
}

export async function updateCampaign(
  id: string,
  fields: Partial<{
    name: string;
    subject: string | null;
    template_id: string | null;
    html: string | null;
    audience: Audience | null;
  }>
): Promise<EmailCampaign | undefined> {
  const current = await getCampaign(id);
  if (!current) return undefined;
  if (current.status === "enviando" || current.status === "enviada") {
    throw new CampaignLockedError();
  }
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "subject", "template_id", "html", "audience"] as const) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  if (Object.keys(patch).length === 0) return current;
  const { data, error } = await supabase
    .from("email_campaigns")
    .update(patch)
    .eq("id", id)
    .select(CAMPAIGN_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as EmailCampaign) ?? undefined;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
  if (error) throw error;
}

// Valida/normaliza um audience cru (vindo do JSON da request). Retorna null
// se a forma for inválida — o caller decide se vira 400 ou audience vazio.
export function parseAudience(raw: unknown): Audience | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.type === "list") {
    return typeof a.list_id === "string" && a.list_id ? { type: "list", list_id: a.list_id } : null;
  }
  if (a.type === "leads") {
    const f = (a.filters && typeof a.filters === "object" ? a.filters : {}) as Record<string, unknown>;
    const filters: { status?: LeadStatus[]; tags?: string[] } = {};
    if (Array.isArray(f.status)) {
      filters.status = f.status.filter((s): s is LeadStatus => typeof s === "string");
    }
    if (Array.isArray(f.tags)) {
      filters.tags = f.tags.filter((t): t is string => typeof t === "string");
    }
    return { type: "leads", filters };
  }
  return null;
}

// ---------- Destinatários ----------

// Resolve o público-alvo de uma campanha em uma lista de {email, name}.
//   list  → contatos não descadastrados da lista.
//   leads → leads do CRM filtrados por estágio/etiqueta, COM email preenchido.
// Deduplica por email (case-insensitive).
export async function resolveRecipients(audience: Audience | null): Promise<Recipient[]> {
  if (!audience) return [];

  let rows: Recipient[] = [];

  if (audience.type === "list") {
    const { data, error } = await supabase
      .from("email_contacts")
      .select("email,name")
      .eq("list_id", audience.list_id)
      .eq("unsubscribed", false);
    if (error) throw error;
    rows = ((data ?? []) as Array<{ email: string; name: string | null }>).map((c) => ({
      email: c.email,
      name: c.name,
    }));
  } else {
    // type === "leads"
    const filters = audience.filters ?? {};

    // Se há filtro de etiquetas, primeiro resolve os lead_ids que têm
    // ALGUMA dessas etiquetas (união).
    let tagLeadIds: string[] | null = null;
    if (filters.tags && filters.tags.length > 0) {
      const { data, error } = await supabase
        .from("lead_tags")
        .select("lead_id")
        .in("tag_id", filters.tags);
      if (error) throw error;
      tagLeadIds = Array.from(
        new Set(((data ?? []) as Array<{ lead_id: string }>).map((r) => r.lead_id))
      );
      if (tagLeadIds.length === 0) return [];
    }

    let q = supabase.from("leads").select("email,name").not("email", "is", null);
    if (filters.status && filters.status.length > 0) q = q.in("status", filters.status);
    if (tagLeadIds) q = q.in("id", tagLeadIds);

    const { data, error } = await q;
    if (error) throw error;
    rows = ((data ?? []) as Array<{ email: string | null; name: string | null }>)
      .filter((l) => l.email && l.email.trim())
      .map((l) => ({ email: (l.email as string).trim(), name: l.name }));
  }

  // Supressão GLOBAL (QA E2): remove descadastrados de QUALQUER público —
  // inclusive leads (que não têm flag local) e contatos descadastrados em
  // outra lista. Vale para 'leads' e 'list'.
  const suppressed = await getSuppressedSet(rows.map((r) => r.email));

  // Deduplica por email (case-insensitive), preservando o primeiro nome visto.
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of rows) {
    const key = r.email.toLowerCase();
    if (!r.email || seen.has(key) || suppressed.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// Conta o público sem materializar o envio (preview "X destinatários").
export async function countRecipients(audience: Audience | null): Promise<number> {
  return (await resolveRecipients(audience)).length;
}

// ---------- Eventos / tracking ----------

export async function recordEvent(
  campaignId: string,
  contactEmail: string,
  type: EmailEventType,
  meta?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("email_events").insert({
    campaign_id: campaignId,
    contact_email: contactEmail,
    type,
    meta: meta ?? null,
  });
  if (error) throw error;
}

// Agrega os eventos de uma campanha por tipo (para a tela de stats).
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const { data, error } = await supabase
    .from("email_events")
    .select("type")
    .eq("campaign_id", campaignId);
  if (error) throw error;
  const stats: CampaignStats = { sent: 0, open: 0, click: 0, bounce: 0, unsubscribe: 0 };
  for (const row of (data ?? []) as Array<{ type: EmailEventType }>) {
    if (row.type in stats) stats[row.type] += 1;
  }
  return stats;
}

// Resolve a URL base usada nos links/pixel de tracking. baseUrl (origin do
// request) tem prioridade; senão cai no config.appUrl (env). Vazio = sem host
// absoluto (tracking não funciona, mas o envio segue — útil no provider 'dev').
function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl || config.appUrl || "").replace(/\/$/, "");
}

// URL assinada do redirect de click (QA E3 — a assinatura cobre c|e|u, então
// o /track/click só redireciona para destinos que ele próprio gerou).
export function buildClickUrl(
  base: string,
  campaignId: string,
  email: string,
  url: string
): string {
  const sig = signClick(campaignId, email, url);
  const qs =
    `c=${encodeURIComponent(campaignId)}` +
    `&e=${encodeURIComponent(email)}` +
    `&u=${encodeURIComponent(url)}` +
    `&sig=${sig}`;
  return `${base}/api/email/track/click?${qs}`;
}

// URL assinada de descadastro (QA E0). O /unsubscribe só descadastra com sig válida.
export function buildUnsubUrl(base: string, campaignId: string, email: string): string {
  const sig = signUnsub(campaignId, email);
  const qs = `c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(email)}&sig=${sig}`;
  return `${base}/api/email/unsubscribe?${qs}`;
}

// Injeta tracking no HTML do email:
//   - reescreve <a href="..."> http(s) para o redirect ASSINADO /track/click (E3)
//   - acrescenta um rodapé com link de DESCADASTRO assinado (E0)
//   - acrescenta um pixel 1x1 /track/open antes de </body> (ou no fim)
// Se não há baseUrl absoluto, devolve o HTML intacto (não dá pra rastrear).
export function injectTracking(
  html: string,
  campaignId: string,
  email: string,
  baseUrl?: string
): string {
  const base = resolveBaseUrl(baseUrl);
  if (!base) return html;
  const c = encodeURIComponent(campaignId);
  const e = encodeURIComponent(email);

  // Reescreve href de links http(s) com URL de destino ASSINADA. Pula mailto:,
  // tel:, âncoras (#) — só casa https?://...
  const rewritten = html.replace(
    /(<a\b[^>]*\bhref=)(["'])(https?:\/\/[^"']+)\2/gi,
    (_m, pre: string, quote: string, url: string) =>
      `${pre}${quote}${buildClickUrl(base, campaignId, email, url)}${quote}`
  );

  // Rodapé de descadastro (link assinado) — obrigatório por conformidade.
  const unsubUrl = buildUnsubUrl(base, campaignId, email);
  const footer =
    `<p style="margin-top:24px;font-size:12px;color:#888;text-align:center">` +
    `Não quer mais receber estes e-mails? ` +
    `<a href="${unsubUrl}" style="color:#888">Descadastrar</a>.</p>`;

  const pixel = `<img src="${base}/api/email/track/open?c=${c}&e=${e}" width="1" height="1" alt="" style="display:none" />`;

  if (/<\/body>/i.test(rewritten)) {
    return rewritten.replace(/<\/body>/i, `${footer}${pixel}</body>`);
  }
  return rewritten + footer + pixel;
}

// ---------- Envio ----------

export interface SendResult {
  recipients: number;
  sent: number;
  failed: number;
  status: CampaignStatus;
}

// Envia uma campanha: resolve destinatários, renderiza (template/HTML) com
// tracking e despacha pelo provider plugável, gravando um evento 'sent' por
// envio bem-sucedido. Atualiza status/sent_count/sent_at ao final.
// baseUrl: origin público (do request) para montar os links de tracking.
export async function sendCampaign(campaignId: string, baseUrl?: string): Promise<SendResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("campanha não encontrada");

  // CLAIM ATÔMICO (QA E1): só assume o envio quem conseguir trocar o status de
  // rascunho/erro -> enviando NESTE update. Se afetou 0 linhas, outra execução
  // já está enviando (ou já enviou) — aborta sem reenviar. Fecha a corrida TOCTOU.
  const { data: claimed, error: claimErr } = await supabase
    .from("email_campaigns")
    .update({ status: "enviando" })
    .eq("id", campaignId)
    .in("status", ["rascunho", "erro"])
    .select("id");
  if (claimErr) throw claimErr;
  if (!claimed || claimed.length === 0) {
    throw new CampaignLockedError("campanha já enviada ou em envio");
  }

  // Resolve assunto/HTML efetivos: campos da campanha têm prioridade; senão,
  // herda do template vinculado.
  let subject = campaign.subject ?? "";
  let html = campaign.html ?? "";
  if ((!subject || !html) && campaign.template_id) {
    const tpl = await getTemplate(campaign.template_id);
    if (tpl) {
      if (!subject) subject = tpl.subject ?? "";
      if (!html) html = tpl.html ?? "";
    }
  }

  const recipients = await resolveRecipients(campaign.audience);
  const base = resolveBaseUrl(baseUrl);

  const provider = await getEmailProvider();
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const body = injectTracking(html, campaignId, r.email, baseUrl);
    // Header List-Unsubscribe (QA E0) — link assinado de descadastro com 1 clique.
    const headers: Record<string, string> = { "X-Campaign-Id": campaignId };
    if (base) {
      headers["List-Unsubscribe"] = `<${buildUnsubUrl(base, campaignId, r.email)}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    try {
      const { id } = await provider.send({ to: r.email, subject, html: body, headers });
      await recordEvent(campaignId, r.email, "sent", { provider: provider.name, message_id: id });
      sent++;
    } catch (e) {
      failed++;
      console.error(`[email] falha ao enviar para ${r.email}:`, e instanceof Error ? e.message : e);
    }
  }

  // Status final: 'enviada' se ao menos um saiu (ou não havia ninguém);
  // 'erro' se havia destinatários e todos falharam.
  const status: CampaignStatus = recipients.length > 0 && sent === 0 ? "erro" : "enviada";
  await supabase
    .from("email_campaigns")
    .update({ status, sent_count: sent, sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  return { recipients: recipients.length, sent, failed, status };
}

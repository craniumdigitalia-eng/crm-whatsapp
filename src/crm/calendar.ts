import { getGoogleConfig, GoogleConfig } from "./integrations";
import { Lead } from "../types";

// =====================================================================
// Tipos internos — item bruto da Calendar API v3 (Events: list / get).
// =====================================================================

interface GoogleCalendarEventItem {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  attendees?: Array<{ email: string; responseStatus?: string }>;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  status?: string; // 'confirmed' | 'tentative' | 'cancelled'
  error?: { message?: string; code?: number };
}

// =====================================================================
// Tipo normalizado exposto pelas rotas da Agenda.
// Google e a fonte da verdade; a UI le sempre daqui.
// =====================================================================

export interface AgendaEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO 8601 (dateTime) ou YYYY-MM-DD (allDay)
  end: string;   // ISO 8601 (dateTime) ou YYYY-MM-DD (allDay)
  allDay?: boolean;
  meetLink?: string;
  htmlLink?: string;
  attendees?: string[];   // so os e-mails
  leadId?: string;        // extendedProperties.private.leadId
  leadName?: string;      // resolvido pelo chamador via getLead
}

// =====================================================================
// Google Calendar (Parte B) — cria eventos na agenda conectada usando o
// refresh_token salvo pelo fluxo OAuth (app/api/integrations/google/*).
//
// Fluxo: refresh_token -> access_token (curto) -> POST events.
// Tudo server-side; o refresh_token NUNCA vai ao browser.
// =====================================================================

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_TZ = process.env.GOOGLE_CALENDAR_TZ ?? "America/Sao_Paulo";

// Erro tipado para o chamador distinguir "nao conectado/configurado" de falha da API.
export class CalendarError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "CalendarError";
  }
}

// Troca o refresh_token por um access_token de curta duracao.
async function getAccessToken(cfg: GoogleConfig): Promise<string> {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new CalendarError("Google nao configurado (faltam GOOGLE_CLIENT_ID/SECRET).", 400);
  }
  if (!cfg.refreshToken) {
    throw new CalendarError("Google Calendar nao conectado. Conecte na aba Integracoes.", 400);
  }
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (e) {
    throw new CalendarError(`falha de rede ao renovar token Google: ${(e as Error).message}`, 502);
  }
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const msg = json.error_description ?? json.error ?? `token endpoint respondeu ${res.status}`;
    throw new CalendarError(`Google OAuth: ${msg}`, 400);
  }
  return json.access_token;
}

// Normaliza um instante para RFC3339 (dateTime do Google). Aceita Date ou string ISO.
function toRfc3339(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: string | Date; // ISO ou Date
  end: string | Date;
  attendees?: string[]; // e-mails
  location?: string;
  timeZone?: string; // default America/Sao_Paulo
  colorId?: string; // cor do evento no Google Calendar (ex.: "9" = azul/Blueberry)
  // Propriedades privadas gravadas no evento do Google (ex.: leadId para vinculo com lead).
  extendedProperties?: Record<string, string>;
}

export interface CalendarEventResult {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  // Link da sala do Google Meet gerada para o evento (conferenceData). Pode vir
  // do campo hangoutLink ou do primeiro entryPoint do tipo "video".
  meetLink?: string;
}

// Cria um evento no calendario conectado. Lanca CalendarError se nao conectado/configurado.
// Sempre solicita uma sala do Google Meet (conferenceData) — o link sai em meetLink.
export async function createEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
  const cfg = await getGoogleConfig();
  const token = await getAccessToken(cfg);
  const tz = input.timeZone ?? DEFAULT_TZ;

  const event: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: toRfc3339(input.start), timeZone: tz },
    end: { dateTime: toRfc3339(input.end), timeZone: tz },
    // Pede ao Google para criar uma sala do Meet junto com o evento. requestId
    // unico por evento (idempotencia da criacao da conferencia).
    conferenceData: {
      createRequest: {
        requestId: randomRequestId(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (input.attendees?.length) {
    event.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.colorId) {
    event.colorId = input.colorId;
  }
  // Propriedades privadas: grava leadId e outros metadados que precisam persistir no evento.
  if (input.extendedProperties && Object.keys(input.extendedProperties).length > 0) {
    event.extendedProperties = { private: input.extendedProperties };
  }

  // sendUpdates=all -> notifica os convidados por e-mail.
  // conferenceDataVersion=1 -> obrigatorio para o Google processar o createRequest do Meet.
  const url = `${CAL_API}/calendars/${encodeURIComponent(
    cfg.calendarId
  )}/events?sendUpdates=all&conferenceDataVersion=1`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (e) {
    throw new CalendarError(`falha de rede ao criar evento: ${(e as Error).message}`, 502);
  }
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    const msg = json.error?.message ?? `Calendar API respondeu ${res.status}`;
    throw new CalendarError(`Google Calendar: ${msg}`, res.status || 500);
  }
  // Extrai o link do Meet: hangoutLink (atalho) ou o entryPoint de video.
  const videoEntry = json.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video" && p.uri
  );
  const meetLink = json.hangoutLink || videoEntry?.uri;
  return { id: json.id, htmlLink: json.htmlLink, hangoutLink: json.hangoutLink, meetLink };
}

// requestId unico por createRequest do Meet. crypto.randomUUID quando disponivel;
// fallback simples para ambientes sem WebCrypto.
function randomRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// =====================================================================
// Normaliza um item bruto da Calendar API para o tipo AgendaEvent.
// leadName deve ser resolvido pelo chamador (nao e responsabilidade desta funcao).
// =====================================================================

function normalizeGoogleEvent(item: GoogleCalendarEventItem): AgendaEvent {
  const allDay = !item.start?.dateTime; // allDay = so tem 'date', sem 'dateTime'
  const startRaw = item.start?.dateTime ?? item.start?.date ?? "";
  const endRaw = item.end?.dateTime ?? item.end?.date ?? "";

  // Normaliza para ISO 8601 quando e um evento com hora; preserva YYYY-MM-DD para allDay.
  const start = allDay ? startRaw : new Date(startRaw).toISOString();
  const end = allDay ? endRaw : new Date(endRaw).toISOString();

  const videoEntry = item.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video" && p.uri
  );
  const meetLink = item.hangoutLink || videoEntry?.uri;
  const leadId = item.extendedProperties?.private?.leadId;
  const attendees = (item.attendees ?? [])
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));

  return {
    id: item.id ?? "",
    summary: item.summary ?? "(sem titulo)",
    ...(item.description ? { description: item.description } : {}),
    start,
    end,
    ...(allDay ? { allDay: true } : {}),
    ...(meetLink ? { meetLink } : {}),
    ...(item.htmlLink ? { htmlLink: item.htmlLink } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(leadId ? { leadId } : {}),
  };
}

// =====================================================================
// listEvents — busca eventos do calendario conectado num intervalo de datas.
// Retorna array normalizado (AgendaEvent); leadName deve ser resolvido
// pelo chamador via getLead (ver rota GET /api/agenda/events).
// =====================================================================

export interface ListEventsParams {
  timeMin: string; // ISO 8601 — inicio do intervalo
  timeMax: string; // ISO 8601 — fim do intervalo
  maxResults?: number; // default 250
}

export async function listEvents(params: ListEventsParams): Promise<AgendaEvent[]> {
  const cfg = await getGoogleConfig();
  const token = await getAccessToken(cfg);
  const max = params.maxResults ?? 250;

  const qs = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
  });
  const url = `${CAL_API}/calendars/${encodeURIComponent(cfg.calendarId)}/events?${qs}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new CalendarError(`falha de rede ao listar eventos: ${(e as Error).message}`, 502);
  }
  const json = (await res.json().catch(() => ({}))) as {
    items?: GoogleCalendarEventItem[];
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = json.error?.message ?? `Calendar API respondeu ${res.status}`;
    throw new CalendarError(`Google Calendar: ${msg}`, res.status || 500);
  }
  // Filtra eventos cancelados (status='cancelled') antes de normalizar.
  return (json.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map(normalizeGoogleEvent);
}

// =====================================================================
// updateEvent — atualiza campos de um evento existente via PATCH.
// Google retorna o evento completo apos o PATCH; normalizamos e devolvemos.
// =====================================================================

export interface AgendaEventPatch {
  summary?: string;
  description?: string;
  start?: string; // ISO 8601
  end?: string;   // ISO 8601
  attendees?: string[]; // substitui a lista de convidados inteira
  timeZone?: string;    // default America/Sao_Paulo
}

export async function updateEvent(id: string, patch: AgendaEventPatch): Promise<AgendaEvent> {
  const cfg = await getGoogleConfig();
  const token = await getAccessToken(cfg);
  const tz = patch.timeZone ?? DEFAULT_TZ;

  // Monta o body com apenas os campos presentes no patch (PATCH e partial merge).
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start !== undefined) {
    body.start = { dateTime: toRfc3339(patch.start), timeZone: tz };
  }
  if (patch.end !== undefined) {
    body.end = { dateTime: toRfc3339(patch.end), timeZone: tz };
  }
  if (patch.attendees !== undefined) {
    body.attendees = patch.attendees.map((email) => ({ email }));
  }

  // conferenceDataVersion=1 preserva o Meet existente; sendUpdates=all notifica convidados.
  const url = `${CAL_API}/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(id)}?conferenceDataVersion=1&sendUpdates=all`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new CalendarError(`falha de rede ao atualizar evento: ${(e as Error).message}`, 502);
  }
  const json = (await res.json().catch(() => ({}))) as GoogleCalendarEventItem & {
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    const msg = (json as { error?: { message?: string } }).error?.message ?? `Calendar API respondeu ${res.status}`;
    throw new CalendarError(`Google Calendar: ${msg}`, res.status || 500);
  }
  return normalizeGoogleEvent(json);
}

// =====================================================================
// deleteEvent — remove um evento do calendario e notifica os convidados.
// =====================================================================

export async function deleteEvent(id: string): Promise<void> {
  const cfg = await getGoogleConfig();
  const token = await getAccessToken(cfg);

  const url = `${CAL_API}/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=all`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new CalendarError(`falha de rede ao remover evento: ${(e as Error).message}`, 502);
  }
  // 204 = sucesso sem corpo; 404 = ja removido (idempotente).
  if (res.status === 204 || res.status === 404) return;
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  const msg = json.error?.message ?? `Calendar API respondeu ${res.status}`;
  throw new CalendarError(`Google Calendar: ${msg}`, res.status || 500);
}

// Helper: agenda uma reuniao com um lead (ex.: quando ele qualifica).
// Monta o titulo a partir do nome/telefone e cria o evento de `durationMin` minutos.
export async function agendarReuniaoLead(
  lead: Lead,
  start: string | Date,
  opts?: { durationMin?: number; attendees?: string[]; description?: string }
): Promise<CalendarEventResult> {
  const startDate = start instanceof Date ? start : new Date(start);
  const durationMin = opts?.durationMin ?? 30;
  const end = new Date(startDate.getTime() + durationMin * 60_000);

  const quem = lead.name?.trim() || `+${lead.phone}`;
  const description =
    opts?.description ??
    [
      `Lead: ${quem}`,
      `Telefone: ${lead.phone}`,
      lead.service_interest ? `Interesse: ${lead.service_interest}` : "",
      lead.notes ? `\n${lead.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  return createEvent({
    summary: `Reuniao — ${quem}`,
    description,
    start: startDate,
    end,
    attendees: opts?.attendees,
  });
}

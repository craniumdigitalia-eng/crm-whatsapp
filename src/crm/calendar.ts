import { getGoogleConfig, GoogleConfig } from "./integrations";
import { Lead } from "../types";

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

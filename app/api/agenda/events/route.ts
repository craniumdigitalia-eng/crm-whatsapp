import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  listEvents,
  createEvent,
  CalendarError,
  AgendaEvent,
} from '@/src/crm/calendar';
import { getLead } from '@/src/crm/leads';

// GET /api/agenda/events?from=ISO&to=ISO
// Lista os eventos do Google Calendar no intervalo informado.
// Resolve leadName para cada evento que tiver leadId gravado.
// POST /api/agenda/events
// Cria um novo evento. Se vier leadId, enriquece com dados do lead e
// grava extendedProperties.private.leadId no evento do Google.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'parametros from e to sao obrigatorios (ISO 8601)' },
        { status: 400 }
      );
    }
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return NextResponse.json({ error: 'from ou to invalido' }, { status: 400 });
    }

    const events = await listEvents({ timeMin: from, timeMax: to });

    // Resolve leadName em batch para todos os eventos com leadId.
    const leadIds = [...new Set(events.filter((e) => e.leadId).map((e) => e.leadId!))];
    const leadNameMap = new Map<string, string>();
    await Promise.all(
      leadIds.map(async (lid) => {
        const lead = await getLead(lid);
        if (lead?.name) leadNameMap.set(lid, lead.name);
      })
    );

    const eventsWithNames: AgendaEvent[] = events.map((e) => ({
      ...e,
      ...(e.leadId && leadNameMap.has(e.leadId) ? { leadName: leadNameMap.get(e.leadId) } : {}),
    }));

    return NextResponse.json({ events: eventsWithNames }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    if (e instanceof CalendarError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[api/agenda/events] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      summary?: unknown;
      start?: unknown;
      end?: unknown;
      description?: unknown;
      attendees?: unknown;
      leadId?: unknown;
      colorId?: unknown;
    };

    const summary = (body.summary ?? '').toString().trim();
    const start = (body.start ?? '').toString().trim();
    const end = (body.end ?? '').toString().trim();
    const description = body.description ? body.description.toString().trim() : undefined;
    const leadIdRaw = body.leadId ? body.leadId.toString().trim() : undefined;

    // Validacao de colorId: apenas "1".."11" (paleta nativa do Google Calendar).
    const VALID_COLOR_IDS = new Set(['1','2','3','4','5','6','7','8','9','10','11']);
    let colorId: string | undefined;
    if (body.colorId != null) {
      const v = String(body.colorId).trim();
      if (!VALID_COLOR_IDS.has(v)) {
        return NextResponse.json(
          { error: 'colorId invalido — deve ser um valor entre "1" e "11"' },
          { status: 400 }
        );
      }
      colorId = v;
    }

    // Validacoes obrigatorias.
    if (!summary) return NextResponse.json({ error: 'summary obrigatorio' }, { status: 400 });
    if (!start || isNaN(Date.parse(start))) {
      return NextResponse.json({ error: 'start invalido (ISO 8601 esperado)' }, { status: 400 });
    }
    if (!end || isNaN(Date.parse(end))) {
      return NextResponse.json({ error: 'end invalido (ISO 8601 esperado)' }, { status: 400 });
    }

    // Constroi a lista de convidados a partir do body.
    let attendees: string[] = [];
    if (Array.isArray(body.attendees)) {
      attendees = (body.attendees as unknown[])
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter(Boolean);
    }

    // Enriquecimento com dados do lead quando leadId for fornecido.
    let resolvedDescription = description;
    let leadName: string | undefined;
    const extendedProperties: Record<string, string> = {};

    if (leadIdRaw) {
      const lead = await getLead(leadIdRaw);
      if (!lead) {
        return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
      }
      leadName = lead.name ?? undefined;
      const quem = lead.name?.trim() || `+${lead.phone}`;

      // Monta descricao enriquecida (mesmo padrao de agendarReuniaoLead).
      resolvedDescription = resolvedDescription ?? [
        `Lead: ${quem}`,
        `Telefone: ${lead.phone}`,
        lead.service_interest ? `Interesse: ${lead.service_interest}` : '',
        lead.notes ? `\n${lead.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      // Inclui o e-mail do lead nos convidados se ainda nao estiver.
      if (lead.email && !attendees.includes(lead.email)) {
        attendees = [lead.email, ...attendees];
      }

      // Persiste o vinculo no proprio evento do Google (sem tabela nova).
      extendedProperties.leadId = leadIdRaw;
    }

    const result = await createEvent({
      summary,
      description: resolvedDescription,
      start,
      end,
      attendees: attendees.length ? attendees : undefined,
      ...(colorId ? { colorId } : {}),
      ...(Object.keys(extendedProperties).length ? { extendedProperties } : {}),
    });

    // Monta o AgendaEvent de retorno a partir do input + resultado da criacao.
    const event: AgendaEvent = {
      id: result.id,
      summary,
      ...(resolvedDescription ? { description: resolvedDescription } : {}),
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      ...(result.meetLink ? { meetLink: result.meetLink } : {}),
      ...(result.htmlLink ? { htmlLink: result.htmlLink } : {}),
      ...(attendees.length ? { attendees } : {}),
      ...(colorId ? { colorId } : {}),
      ...(leadIdRaw ? { leadId: leadIdRaw } : {}),
      ...(leadName ? { leadName } : {}),
    };

    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    if (e instanceof CalendarError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[api/agenda/events] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

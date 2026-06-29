import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateEvent, deleteEvent, CalendarError } from '@/src/crm/calendar';
import { getLead } from '@/src/crm/leads';

// PATCH /api/agenda/events/[id]
// Atualiza parcialmente um evento no Google Calendar.
// Body (todos opcionais): { summary, start, end, description, attendees }
// DELETE /api/agenda/events/[id]
// Remove o evento do Google Calendar e notifica os convidados.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      summary?: unknown;
      start?: unknown;
      end?: unknown;
      description?: unknown;
      attendees?: unknown;
      colorId?: unknown;
    };

    // Valida os campos opcionais presentes no body.
    const patch: {
      summary?: string;
      start?: string;
      end?: string;
      description?: string;
      attendees?: string[];
      colorId?: string;
    } = {};

    if (body.summary != null) {
      const v = String(body.summary).trim();
      if (!v) return NextResponse.json({ error: 'summary nao pode ser vazio' }, { status: 400 });
      patch.summary = v;
    }
    if (body.start != null) {
      const v = String(body.start).trim();
      if (isNaN(Date.parse(v))) {
        return NextResponse.json({ error: 'start invalido (ISO 8601 esperado)' }, { status: 400 });
      }
      patch.start = v;
    }
    if (body.end != null) {
      const v = String(body.end).trim();
      if (isNaN(Date.parse(v))) {
        return NextResponse.json({ error: 'end invalido (ISO 8601 esperado)' }, { status: 400 });
      }
      patch.end = v;
    }
    if (body.description != null) {
      patch.description = String(body.description).trim();
    }
    if (body.attendees !== undefined) {
      if (!Array.isArray(body.attendees)) {
        return NextResponse.json({ error: 'attendees deve ser um array de e-mails' }, { status: 400 });
      }
      patch.attendees = (body.attendees as unknown[])
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter(Boolean);
    }
    if (body.colorId != null) {
      const VALID_COLOR_IDS = new Set(['1','2','3','4','5','6','7','8','9','10','11']);
      const v = String(body.colorId).trim();
      if (!VALID_COLOR_IDS.has(v)) {
        return NextResponse.json(
          { error: 'colorId invalido — deve ser um valor entre "1" e "11"' },
          { status: 400 }
        );
      }
      patch.colorId = v;
    }

    const updated = await updateEvent(id, patch);

    // Resolve leadName se o evento tiver vinculo com lead.
    if (updated.leadId) {
      const lead = await getLead(updated.leadId);
      if (lead?.name) updated.leadName = lead.name;
    }

    return NextResponse.json({ event: updated });
  } catch (e) {
    if (e instanceof CalendarError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(`[api/agenda/events/${id}] PATCH:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });

  try {
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CalendarError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(`[api/agenda/events/${id}] DELETE:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

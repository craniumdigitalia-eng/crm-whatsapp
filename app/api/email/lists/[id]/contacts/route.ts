import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listContacts, addContacts, parseCsv } from '@/src/crm/email';

// GET /api/email/lists/:id/contacts — contatos da lista.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const contacts = await listContacts(id);
    return NextResponse.json({ contacts });
  } catch (e) {
    console.error('[api/email/lists/:id/contacts] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/email/lists/:id/contacts — adiciona contatos.
// Aceita { contacts: [{email,name?}] } e/ou { csv: "..." } (importação CSV).
// Retorna quantos foram efetivamente inseridos (duplicatas ignoradas).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      contacts?: Array<{ email?: string; name?: string }>;
      csv?: string;
    };

    const toAdd: Array<{ email: string; name?: string | null }> = [];
    if (typeof body.csv === 'string' && body.csv.trim()) {
      toAdd.push(...parseCsv(body.csv));
    }
    if (Array.isArray(body.contacts)) {
      for (const c of body.contacts) {
        if (c && typeof c.email === 'string') toAdd.push({ email: c.email, name: c.name ?? null });
      }
    }
    if (toAdd.length === 0) {
      return NextResponse.json({ error: 'nenhum contato válido enviado' }, { status: 400 });
    }

    const added = await addContacts(id, toAdd);
    return NextResponse.json({ added, received: toAdd.length }, { status: 201 });
  } catch (e) {
    console.error('[api/email/lists/:id/contacts] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

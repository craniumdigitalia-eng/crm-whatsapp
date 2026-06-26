import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listLists, createList, getListCounts } from '@/src/crm/email';

// GET /api/email/lists — listas + contagem de contatos por lista.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const [lists, counts] = await Promise.all([listLists(), getListCounts()]);
    return NextResponse.json({
      lists: lists.map((l) => ({ ...l, count: counts[l.id] ?? 0 })),
    });
  } catch (e) {
    console.error('[api/email/lists] GET:', e);
    return NextResponse.json({ error: erro(e) }, { status: 500 });
  }
}

// POST /api/email/lists — cria uma lista { name }.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name obrigatorio' }, { status: 400 });
    const list = await createList(name);
    return NextResponse.json({ list }, { status: 201 });
  } catch (e) {
    console.error('[api/email/lists] POST:', e);
    return NextResponse.json({ error: erro(e) }, { status: 500 });
  }
}

function erro(e: unknown): string {
  return e instanceof Error ? e.message : 'erro interno';
}

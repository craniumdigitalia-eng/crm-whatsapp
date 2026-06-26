import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getList, listContacts, deleteList } from '@/src/crm/email';

// GET /api/email/lists/:id — lista + seus contatos.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const list = await getList(id);
    if (!list) return NextResponse.json({ error: 'lista nao encontrada' }, { status: 404 });
    const contacts = await listContacts(id);
    return NextResponse.json({ list, contacts });
  } catch (e) {
    console.error('[api/email/lists/:id] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// DELETE /api/email/lists/:id — remove a lista (contatos caem por cascade).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteList(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/email/lists/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

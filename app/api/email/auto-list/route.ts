import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getAutoListId, setAutoListId } from '@/src/crm/email';

// GET /api/email/auto-list — qual lista recebe os leads automaticamente (ou null).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const autoListId = await getAutoListId();
    return NextResponse.json({ autoListId });
  } catch (e) {
    console.error('[api/email/auto-list] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// PUT /api/email/auto-list — define (ou limpa) a lista automática.
// Body: { listId: string | null }
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as { listId?: unknown };
    const listId = typeof body.listId === 'string' && body.listId.trim() ? body.listId.trim() : null;
    await setAutoListId(listId);
    return NextResponse.json({ autoListId: listId });
  } catch (e) {
    console.error('[api/email/auto-list] PUT:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

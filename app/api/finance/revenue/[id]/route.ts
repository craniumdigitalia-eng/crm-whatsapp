import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { deleteRevenue } from '@/src/crm/finance';

// DELETE /api/finance/revenue/:id — remove uma receita avulsa.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteRevenue(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/finance/revenue/:id] DELETE:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateDemandStatus, deleteDemand, type DemandStatus } from '@/src/crm/demands';

const VALID: DemandStatus[] = ['aberta', 'andamento', 'concluida'];

// PATCH /api/demands/:id — move a demanda de coluna. Body: { status }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    const status = String(body.status ?? '') as DemandStatus;
    if (!VALID.includes(status)) return NextResponse.json({ error: 'status invalido' }, { status: 400 });
    await updateDemandStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/demands/:id] PATCH:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// DELETE /api/demands/:id — remove a demanda do quadro.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteDemand(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/demands/:id] DELETE:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

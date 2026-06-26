import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { cancelFollowUp } from '@/src/crm/followup-schedule';

// DELETE /api/followups/:id — cancela um follow-up agendado (pendente).
// Idempotente: cancelar um item ja resolvido retorna 200 com cancelled=false.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const cancelled = await cancelFollowUp(id);
    return NextResponse.json({ ok: true, cancelled });
  } catch (e) {
    console.error('[api/followups/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

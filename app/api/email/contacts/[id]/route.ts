import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { deleteContact } from '@/src/crm/email';

// DELETE /api/email/contacts/:id — remove um contato de uma lista.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/email/contacts/:id] DELETE:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

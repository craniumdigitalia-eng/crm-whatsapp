import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getLead } from '@/src/crm/leads';
import { listChecklist, addChecklistItem } from '@/src/crm/checklists';

// GET /api/leads/:id/checklist — itens do checklist do lead, ordenados por position.
// Story 5.13 — Checklists dentro do lead.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const items = await listChecklist(id);
    return NextResponse.json({ items });
  } catch (e) {
    console.error('[api/leads/:id/checklist] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// POST /api/leads/:id/checklist — adiciona um item { text } ao fim do checklist.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({})) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'text obrigatorio' }, { status: 400 });
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: 'lead nao encontrado' }, { status: 404 });
    const item = await addChecklistItem(id, text);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error('[api/leads/:id/checklist] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

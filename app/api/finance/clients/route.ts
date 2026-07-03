import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listClients, createClient } from '@/src/crm/finance';

// GET /api/finance/clients — lista os clientes pagantes.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const clients = await listClients();
    return NextResponse.json({ clients });
  } catch (e) {
    console.error('[api/finance/clients] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// POST /api/finance/clients — cria um cliente.
// Body: { name, monthly_value, billing_day?, status?, started_at?, notes? }
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = (body.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'nome obrigatorio' }, { status: 400 });
    const client = await createClient({
      name,
      monthly_value: Number(body.monthly_value ?? 0),
      billing_day: body.billing_day != null ? Number(body.billing_day) : null,
      status: body.status as 'ativo' | 'atrasado' | 'cancelado' | undefined,
      started_at: body.started_at ? String(body.started_at) : undefined,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    console.error('[api/finance/clients] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

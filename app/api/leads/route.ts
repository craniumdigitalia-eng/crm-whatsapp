import { NextResponse } from 'next/server';
import { listLeads } from '@/src/crm/leads';
import { STATUS_LABELS } from '@/src/types';

// GET /api/leads — lista todos os leads para o kanban.
// Migrado de api/leads/index.ts (Vercel handler) — Story 5.4.
export async function GET() {
  try {
    const leads = await listLeads();
    return NextResponse.json({ leads, statusLabels: STATUS_LABELS });
  } catch (e) {
    console.error('[api/leads] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

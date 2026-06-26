import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listLeads } from '@/src/crm/leads';
import { getTagsByLeadIds } from '@/src/crm/tags';
import { STATUS_LABELS } from '@/src/types';

// GET /api/leads — lista todos os leads para o kanban, com as etiquetas de cada lead.
// Migrado de api/leads/index.ts (Vercel handler) — Story 5.4.
// Story 5.12: anexa `tags` em cada lead para os chips coloridos no card.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const leads = await listLeads();
    const tagsByLead = await getTagsByLeadIds(leads.map((l) => l.id));
    const leadsWithTags = leads.map((l) => ({ ...l, tags: tagsByLead[l.id] ?? [] }));
    return NextResponse.json({ leads: leadsWithTags, statusLabels: STATUS_LABELS });
  } catch (e) {
    console.error('[api/leads] GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

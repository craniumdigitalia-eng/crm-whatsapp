import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listLeads, findLeadByPhone, getOrCreateLead, updateLeadFields } from '@/src/crm/leads';
import { getTagsByLeadIds } from '@/src/crm/tags';
import { LeadStatus, STATUS_LABELS } from '@/src/types';

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

// POST /api/leads — cria um lead manualmente (botao "Novo Lead" do kanban).
// Body: { phone: string (obrigatorio), name?: string, service_interest?: string, status?: LeadStatus }
// Resposta: { lead } 201 se criado, { lead, existed: true } 200 se o telefone ja existia.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      phone?: unknown;
      name?: unknown;
      service_interest?: unknown;
      status?: unknown;
    };

    // Normaliza telefone: apenas digitos; rejeita se vazio ou menor que 8 digitos.
    const phoneRaw = (body.phone ?? '').toString();
    const phone = phoneRaw.replace(/\D/g, '');
    if (phone.length < 8) {
      return NextResponse.json(
        { error: 'telefone obrigatorio (minimo 8 digitos)' },
        { status: 400 }
      );
    }

    // Nome: opcional, trim, limite de 120 caracteres.
    const nameTrimmed = (body.name ?? '').toString().trim().slice(0, 120) || undefined;

    // service_interest: opcional, trim.
    const serviceInterest = (body.service_interest ?? '').toString().trim() || undefined;

    // Status: valida contra os valores conhecidos do funil; ignora invalidos (usa padrao "novo").
    const statusRaw = (body.status ?? '').toString().trim();
    const validStatuses = Object.keys(STATUS_LABELS) as LeadStatus[];
    const status: LeadStatus | undefined = validStatuses.includes(statusRaw as LeadStatus)
      ? (statusRaw as LeadStatus)
      : undefined;

    // Verifica se o lead ja existe para diferenciar criacao de retorno do existente.
    const preexisting = await findLeadByPhone(phone);
    const existed = !!preexisting;

    // getOrCreateLead faz upsert pelo telefone (idempotente, trata corridas).
    const lead = await getOrCreateLead(phone, nameTrimmed);

    // Atualiza campos extras se fornecidos (update e noop se nada mudou).
    if (serviceInterest !== undefined || status !== undefined) {
      await updateLeadFields(lead.id, {
        ...(serviceInterest !== undefined && { service_interest: serviceInterest }),
        ...(status !== undefined && { status }),
      });
      // Reflete os campos atualizados no objeto retornado.
      if (serviceInterest !== undefined) lead.service_interest = serviceInterest;
      if (status !== undefined) lead.status = status;
    }

    if (existed) {
      return NextResponse.json({ lead, existed: true }, { status: 200 });
    }
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    console.error('[api/leads] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

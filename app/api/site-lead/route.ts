import { NextResponse } from 'next/server';
import { config } from '@/src/config';
import { getOrCreateLead, findLeadByPhone, updateLeadFields, setLeadAttribution } from '@/src/crm/leads';
import { iniciarAtendimento } from '@/src/handler';

// POST /api/site-lead — ingresso de leads do FORMULARIO DO SITE (quem testou a IA
// e deixou os dados). Cria o lead no CRM (origem 'site'), salva e-mail (entra na
// lista automatica de e-mail) e, se houver telefone valido, a IA puxa a conversa
// no WhatsApp (opener), igual ao lead do Meta.
//
// Endpoint de MAQUINA — protegido por SITE_LEAD_SECRET (header x-site-secret ou
// ?token=). O backend do seu site envia o secret; nunca exponha no browser.
export const maxDuration = 60;

// Normaliza telefone para digitos com DDI Brasil (55) quando vier so DDD+numero.
function normalizePhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const provided = req.headers.get('x-site-secret') ?? url.searchParams.get('token') ?? '';
  const isProd = process.env.NODE_ENV === 'production';
  if (config.siteLeadSecret) {
    if (provided !== config.siteLeadSecret) {
      return NextResponse.json({ error: 'nao autorizado' }, { status: 401 });
    }
  } else if (isProd) {
    console.error('[site-lead] SITE_LEAD_SECRET nao configurado em producao — request recusado');
    return NextResponse.json({ error: 'configure SITE_LEAD_SECRET' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = (body.name ?? body.nome ?? '').toString().trim() || undefined;
  const email = (body.email ?? '').toString().trim() || undefined;
  const phone = normalizePhone((body.phone ?? body.telefone ?? body.whatsapp ?? '').toString());
  const interest =
    (body.interest ?? body.interesse ?? body.mensagem ?? body.message ?? '').toString().trim() || undefined;

  if (!phone && !email) {
    return NextResponse.json({ error: 'informe ao menos telefone ou email' }, { status: 400 });
  }

  // Guarda todos os campos recebidos como form_data (atribuicao/consulta).
  const formData: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v != null && typeof v !== 'object') formData[k] = String(v);
  }

  try {
    // Sem telefone valido, usa um marcador sintetico (phone e NOT NULL/unique).
    const leadPhone = phone || `site:${email ?? Math.abs(Date.now()).toString(36)}`;
    const existing = await findLeadByPhone(leadPhone);
    const created = !existing;
    const lead = await getOrCreateLead(leadPhone, name);

    if (email || interest || name) {
      await updateLeadFields(lead.id, {
        ...(email ? { email } : {}),
        ...(interest ? { service_interest: interest } : {}),
        ...(name ? { name } : {}),
      });
    }
    await setLeadAttribution(lead.id, { source: 'site', form_data: formData });

    // Novo lead com telefone valido -> IA abre a conversa no WhatsApp (opener).
    if (created && phone) {
      await iniciarAtendimento({ ...lead, phone }, formData).catch((e) =>
        console.error('[site-lead] iniciarAtendimento:', e)
      );
    }

    return NextResponse.json({ ok: true, leadId: lead.id, created }, { status: created ? 201 : 200 });
  } catch (e) {
    console.error('[api/site-lead] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

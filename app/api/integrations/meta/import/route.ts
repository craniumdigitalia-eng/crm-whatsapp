import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getMetaConfig } from '@/src/crm/integrations';
import { fetchFormLeads, importLeads, MetaError } from '@/src/crm/meta';

// POST /api/integrations/meta/import — importa leads do formulario instantaneo do Meta.
// Usa o Page Access Token + Form ID resolvidos (env ou aba Integracoes).
// Body opcional: { form_id? } sobrescreve o form id configurado.
// Idempotente: leads ja importados (mesmo leadgen_id) sao pulados.
// Story 5.14.
// RBAC: usa o Page Access Token (credencial sensivel) -> exige admin (S2).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const cfg = await getMetaConfig();
    const body = await req.json().catch(() => ({})) as { form_id?: string };
    const formId = (body.form_id && body.form_id.trim()) || cfg.formId;

    if (!cfg.pageAccessToken) {
      return NextResponse.json(
        { error: 'Page Access Token ausente. Configure na aba Integracoes ou no .env (META_PAGE_ACCESS_TOKEN).' },
        { status: 400 }
      );
    }
    if (!formId) {
      return NextResponse.json(
        { error: 'Form ID ausente. Informe o ID do formulario instantaneo (META_FORM_ID).' },
        { status: 400 }
      );
    }

    const raws = await fetchFormLeads(cfg, formId);
    const result = await importLeads(raws);

    return NextResponse.json({
      ok: true,
      form_id: formId,
      fetched: raws.length,
      ...result, // imported, skipped, errors
    });
  } catch (e) {
    if (e instanceof MetaError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[api/integrations/meta/import] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

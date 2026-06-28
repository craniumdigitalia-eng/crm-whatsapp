import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getEmailProvider } from '@/src/crm/email-provider';

// POST /api/email/test — envia um email de teste para o proprio admin logado,
// usando o provedor configurado (Gmail SMTP em producao). Serve para validar
// que as credenciais funcionam de ponta a ponta. Somente admin.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const to = auth.user.email;
  if (!to) {
    return NextResponse.json(
      { error: 'sua conta nao tem e-mail associado' },
      { status: 400 }
    );
  }

  try {
    const provider = await getEmailProvider();
    const { id } = await provider.send({
      to,
      subject: 'Teste de envio do CRM Cranium ✅',
      html:
        '<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">' +
        '<h2 style="margin:0 0 12px">Teste de envio do CRM Cranium ✅</h2>' +
        '<p style="margin:0 0 8px">Se você está lendo isto, o provedor de email está ' +
        'configurado e enviando de verdade.</p>' +
        `<p style="margin:0;color:#6b7280;font-size:13px">Provedor: <strong>${provider.name}</strong></p>` +
        '</div>',
    });
    return NextResponse.json({ ok: true, to, provider: provider.name, id });
  } catch (e) {
    console.error('[api/email/test] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

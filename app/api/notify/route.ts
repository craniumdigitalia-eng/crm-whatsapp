import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getNotifyConfig, setNotifyConfig } from '@/src/crm/notify';

// Configuração de notificações do operador via WhatsApp.
// GET  → { enabled, whatsapp }
// POST → { enabled: boolean, whatsapp: string } → valida e grava, retorna { enabled, whatsapp }
//
// Protegido por requireUser (qualquer membro autenticado da equipe).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const cfg = await getNotifyConfig();
  return NextResponse.json({ enabled: cfg.enabled, whatsapp: cfg.whatsapp });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'payload inválido (JSON esperado)' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.enabled !== 'boolean') {
    return NextResponse.json({ error: '"enabled" deve ser boolean' }, { status: 400 });
  }

  const rawWhatsapp = typeof b.whatsapp === 'string' ? b.whatsapp : '';
  // Aceita vazio (desabilita); quando preenchido deve conter só dígitos.
  const whatsapp = rawWhatsapp.replace(/\D/g, '');
  if (rawWhatsapp.trim() !== '' && whatsapp !== rawWhatsapp.trim()) {
    return NextResponse.json(
      { error: '"whatsapp" deve conter apenas dígitos' },
      { status: 400 }
    );
  }

  try {
    await setNotifyConfig({ enabled: b.enabled, whatsapp });
    return NextResponse.json({ enabled: b.enabled, whatsapp });
  } catch (e) {
    console.error('[api/notify] POST:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

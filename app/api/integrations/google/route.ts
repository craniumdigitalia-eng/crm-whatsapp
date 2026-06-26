import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { config } from '@/src/config';

// GET /api/integrations/google — inicia o fluxo OAuth do Google Calendar.
// Parte 3 (stub documentado): se as credenciais OAuth existirem no env,
// redireciona para a tela de consentimento do Google; caso contrario,
// retorna instrucoes de como configurar (status "Nao conectado" na UI).
//
// Para ativar de verdade:
//   1. Crie um projeto no Google Cloud Console e habilite a Calendar API.
//   2. Configure a tela de consentimento OAuth e crie credenciais "OAuth Client ID" (Web).
//   3. Adicione GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.
//      Redirect URI sugerida: https://SEU_DOMINIO/api/integrations/google/callback
//   4. Implemente o handler de callback para trocar o `code` por tokens e salva-los.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// RBAC (S2): hoje este GET so LE credenciais do env e redireciona para o consentimento
// OAuth — nao GRAVA segredo. Por isso fica em requireUser. QUANDO o handler de callback
// (passo 4 acima) for implementado e passar a PERSISTIR tokens, ele deve usar requireAdmin.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!config.googleClientId || !config.googleRedirectUri) {
    return NextResponse.json(
      {
        connected: false,
        configured: false,
        message:
          'Google Calendar nao configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.',
      },
      { status: 200 }
    );
  }

  // Credenciais presentes: monta a URL de consentimento e redireciona.
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

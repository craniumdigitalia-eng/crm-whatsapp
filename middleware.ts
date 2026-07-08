import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Protege todas as rotas de UI do portal: sem sessao Supabase -> redireciona para /login.
// O matcher abaixo exclui /api/* (gateado nos handlers via requireUser(), devolve 401 JSON
// em vez de redirect), a propria /login e os estaticos do Next.
export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Casa tudo, EXCETO: /api/*, /login, /reset-password (fluxo de recuperacao de senha,
    // acessado sem sessao), os internos do Next (_next/static, _next/image), favicon e
    // qualquer arquivo com extensao (estaticos do /public).
    '/((?!api|login|reset-password|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};

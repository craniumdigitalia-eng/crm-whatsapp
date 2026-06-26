import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refresca a sessao Supabase a cada navegacao e devolve { supabaseResponse, user }.
// Padrao oficial do @supabase/ssr para o App Router — usado pelo middleware.ts da raiz.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: nao rodar codigo entre createServerClient e auth.getUser() —
  // evita bugs sutis de sessao/refresh de cookie (recomendacao do @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}

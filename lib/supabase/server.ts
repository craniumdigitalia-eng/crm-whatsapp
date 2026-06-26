import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente Supabase server-side ligado aos cookies da requisicao (Server Components e Route Handlers).
// Le a sessao do usuario logado — `auth.getUser()` valida o JWT junto ao Supabase.
// Usa a anon key (respeita RLS). O acesso de DADOS do CRM continua via service_role em src/db.ts,
// mas sempre atras do gate de auth (lib/auth.ts).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de dentro de um Server Component (cookies sao read-only la).
            // Sem problema: o middleware (lib/supabase/middleware.ts) refresca a sessao.
          }
        },
      },
    },
  );
}

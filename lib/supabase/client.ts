import { createBrowserClient } from '@supabase/ssr';

// Cliente Supabase para o browser (login/logout na pagina /login e no LogoutButton).
// Usa a anon key publica — as variaveis NEXT_PUBLIC_* sao embutidas no bundle em build time.
// NUNCA use a service_role aqui: ela ignora RLS e nao pode ir ao cliente.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

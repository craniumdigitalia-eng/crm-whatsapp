import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Cliente Supabase server-side com service_role key (ignora RLS).
// Nao usar no frontend — expoe todos os dados do tenant.
// Story 2.2: substitui o DatabaseSync do SQLite (node:sqlite).
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

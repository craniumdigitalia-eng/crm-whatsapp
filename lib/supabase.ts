import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Cliente Supabase com a service_role key (uso server-side: ignora RLS).
// NUNCA exponha essa key no front-end.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

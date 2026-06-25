// Re-exporta o client Supabase de src/db.ts.
// Centraliza o import para handlers em api/ — evita paths ../../../src/db espalhados.
// O client e um singleton stateless-safe (sem pool de conexao, session desabilitada):
// pode ser reusado entre invocacoes warm sem risco de estado mutavel compartilhado.
export { supabase } from "../../src/db";

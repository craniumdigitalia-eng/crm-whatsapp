import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Cria (ou promove) o primeiro usuario admin do portal. Story 5.2.
//
// Uso:
//   npx ts-node --transpile-only --project tsconfig.backend.json \
//     scripts/create-admin.ts <email> <senha>
//
// Ex.:
//   npx ts-node --transpile-only --project tsconfig.backend.json \
//     scripts/create-admin.ts craniumdigital.ia@gmail.com 'SenhaForte123!'
//
// Usa a SERVICE_ROLE (server-only, do .env): cria o usuario ja com e-mail confirmado
// (sem fluxo de verificacao) e grava role='admin' na tabela profiles (migration 004).
// Idempotente: se o usuario ja existe, apenas promove a admin.
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: npx ts-node scripts/create-admin.ts <email> <senha>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Cria o usuario no Auth, ja confirmado.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: 'Admin Cranium' },
  });

  let userId = created?.user?.id;

  if (createErr) {
    // Ja existe? Entao apenas resolve o id para promover a admin.
    if (!/already|registered|exists/i.test(createErr.message)) {
      console.error('Erro ao criar usuario:', createErr.message);
      process.exit(1);
    }
    console.warn('Usuario ja existe — promovendo a admin.');
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error('Erro ao listar usuarios:', listErr.message);
      process.exit(1);
    }
    userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }

  if (!userId) {
    console.error('Nao foi possivel resolver o id do usuario.');
    process.exit(1);
  }

  // 2) Garante o profile com role=admin (o trigger handle_new_user cria como 'atendente').
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, nome: 'Admin Cranium', role: 'admin' }, { onConflict: 'id' });

  if (upsertErr) {
    console.error('Erro ao gravar profile admin:', upsertErr.message);
    process.exit(1);
  }

  console.log(`OK — admin pronto: ${email} (id ${userId})`);
}

main().catch((e) => {
  console.error('Falha inesperada:', e);
  process.exit(1);
});

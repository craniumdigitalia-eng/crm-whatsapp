/**
 * Setup pós-schema de um cliente novo. Rode DEPOIS de aplicar o provisioning/schema.sql
 * no Supabase do cliente. Cria os buckets de Storage, o usuário admin e valida as tabelas.
 *
 * Uso (na pasta do projeto do cliente, com o .env do cliente preenchido):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_EMAIL=dono@cliente.com ADMIN_PASSWORD='SenhaForte123!' \
 *   node_modules/.bin/tsx provisioning/setup.ts
 *
 * (as duas primeiras já vêm do .env via dotenv; as de admin você passa na linha.)
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!url || !key) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (do .env do cliente).');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function ensureBucket(name: string, isPublic: boolean) {
  // Tenta criar; se falhar (já existe, ou erro transitório 5xx), confere se existe.
  for (let i = 0; i < 3; i++) {
    const { error } = await db.storage.createBucket(name, { public: isPublic });
    if (!error) {
      console.log(`  bucket "${name}" (${isPublic ? 'público' : 'privado'}) criado`);
      return;
    }
    const { data } = await db.storage.getBucket(name);
    if (data) {
      console.log(`  bucket "${name}" já existe, ok`);
      return;
    }
    if (i < 2) continue; // erro transitório → tenta de novo
    throw error;
  }
}

async function main() {
  console.log('== 1) Buckets de Storage ==');
  await ensureBucket('avatars', true);
  await ensureBucket('agent-assets', true);

  console.log('\n== 2) Verificando tabelas principais ==');
  const tabelas = ['leads', 'messages', 'profiles', 'integrations_config', 'fin_clients', 'demands', 'group_messages', 'agent_assets'];
  for (const t of tabelas) {
    const { error } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${error ? '❌ ' + error.message : '✅'}`);
  }

  console.log('\n== 3) Usuário admin ==');
  if (!adminEmail || !adminPassword) {
    console.log('  (pulei — passe ADMIN_EMAIL e ADMIN_PASSWORD para criar o admin)');
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (error && !/already been registered/i.test(error.message)) throw error;
    const userId = data?.user?.id;
    if (userId) {
      await db.from('profiles').upsert(
        { id: userId, email: adminEmail, nome: 'Admin', role: 'admin' },
        { onConflict: 'id' }
      );
      console.log(`  admin criado: ${adminEmail} (role=admin)`);
    } else {
      // Já existia: garante role admin.
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      const u = list?.users.find((x) => x.email?.toLowerCase() === adminEmail.toLowerCase());
      if (u) {
        await db.from('profiles').upsert({ id: u.id, email: adminEmail, nome: 'Admin', role: 'admin' }, { onConflict: 'id' });
        console.log(`  admin já existia; role garantida (${adminEmail}).`);
      }
    }
  }

  console.log('\n✅ Setup concluído.');
  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO no setup:', e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Atualização em massa dos clientes (modelo 1 código, 1 deploy por cliente).
 * Faz o deploy do código ATUAL deste repositório para o projeto Vercel de cada
 * cliente listado em provisioning/clients.json, e (opcional) verifica se uma
 * tabela existe no Supabase de cada um (pra confirmar migration aplicada).
 *
 * Pré-requisitos:
 *   - Vercel CLI instalado (já usamos no projeto).
 *   - VERCEL_TOKEN no ambiente (crie em vercel.com/account/tokens).
 *   - provisioning/clients.json preenchido (veja clients.example.json).
 *
 * Uso (na raiz do repo):
 *   VERCEL_TOKEN=xxx node_modules/.bin/tsx provisioning/update-all.ts
 *   ... --only=Bonfim                 (só um cliente)
 *   ... --no-deploy --verify-table=fin_clients   (só confere a tabela em cada)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

interface Client {
  name: string;
  vercelOrgId: string;
  vercelProjectId: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const verifyTable = args.find((a) => a.startsWith('--verify-table='))?.split('=')[1];
const doDeploy = !args.includes('--no-deploy');
const token = process.env.VERCEL_TOKEN;

async function main() {
  let clients: Client[];
  try {
    clients = JSON.parse(readFileSync('provisioning/clients.json', 'utf8'));
  } catch {
    console.error('Não achei provisioning/clients.json. Copie clients.example.json e preencha.');
    process.exit(1);
  }
  const list = only ? clients.filter((c) => c.name.toLowerCase() === only.toLowerCase()) : clients;
  if (list.length === 0) {
    console.error('Nenhum cliente a processar (confira o --only e o clients.json).');
    process.exit(1);
  }

  console.log(`Processando ${list.length} cliente(s)${doDeploy ? '' : ' (sem deploy)'}...\n`);
  const resultados: { name: string; deploy: string }[] = [];

  for (const c of list) {
    console.log(`=== ${c.name} ===`);
    let deployMsg = 'pulado';

    if (doDeploy) {
      if (!token) {
        deployMsg = 'sem VERCEL_TOKEN';
        console.error('  deploy ❌ faltou VERCEL_TOKEN no ambiente');
      } else {
        try {
          const out = execFileSync('vercel', ['deploy', '--prod', '--yes', '--token', token], {
            env: { ...process.env, VERCEL_ORG_ID: c.vercelOrgId, VERCEL_PROJECT_ID: c.vercelProjectId },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          const url = out.match(/https:\/\/[^\s]+/)?.[0] ?? '(ver output)';
          deployMsg = url;
          console.log(`  deploy ✅ ${url}`);
        } catch (e) {
          deployMsg = 'ERRO';
          console.error(`  deploy ❌ ${(e as Error).message.split('\n')[0].slice(0, 200)}`);
        }
      }
    }

    if (verifyTable && c.supabaseUrl && c.supabaseServiceKey) {
      try {
        const db = createClient(c.supabaseUrl, c.supabaseServiceKey, { auth: { persistSession: false } });
        const { error } = await db.from(verifyTable).select('*', { count: 'exact', head: true });
        console.log(`  tabela "${verifyTable}": ${error ? '❌ FALTA (rode a migration nova no SQL editor)' : '✅'}`);
      } catch (e) {
        console.log(`  tabela "${verifyTable}": ❌ ${(e as Error).message}`);
      }
    }

    resultados.push({ name: c.name, deploy: deployMsg });
  }

  console.log('\n== Resumo ==');
  for (const r of resultados) console.log(`  ${r.name}: ${r.deploy}`);
  process.exit(0);
}

main();

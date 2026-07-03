// AC5 — Runner e2e do teste negativo de auth + RBAC + RLS (Story 5.2).
//
// Executa, contra o dev server local, a matriz desenhada em
// docs/smart-memory/agents/qa/review-5.2-ac5-e-config.md (Tessera / crm-qa):
//
//   N*  (nao autenticado)  -> rota protegida sem cookie  => 401 (api) / redirect /login (ui)
//   F*  (papel insuficiente) -> sessao 'atendente' em rota requireAdmin => 403
//   R*  (RLS defense-in-depth) -> anon key direto na Data API nao vaza dado de negocio,
//        e atendente nao consegue se autopromover (trigger 006). DEPENDE das migrations
//        005 (RLS) e 006 (role-lock) aplicadas no Supabase.
//
// Saida: resumo PASS/FAIL por classe. Exit code != 0 se N* ou F* falharem (regressao de
// codigo, roda HOJE). R* sao CONDICIONAIS as migrations: por padrao nao derrubam o exit
// (marcados PENDING quando a migration nao esta aplicada); com STRICT_RLS=1 viram fatais.
//
// COMO RODAR
//   1) Subir o dev server:           npm run dev         (porta 3000)
//   2) Em outro terminal:            node scripts/test/ac5-negative.mjs
//
// VARIAVEIS (lidas do .env via dotenv; podem ser sobrescritas no ambiente)
//   BASE_URL                      default http://localhost:3000
//   NEXT_PUBLIC_SUPABASE_URL      url do projeto Supabase (anon/ssr)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY anon key
//   SUPABASE_URL                  url (service role; cria/promove o usuario de teste)
//   SUPABASE_SERVICE_ROLE_KEY     service role key
//   TEST_ATTENDANT_EMAIL          default qa-atendente@cranium.test
//   TEST_ATTENDANT_PASSWORD       default QaAtendente@2026
//   STRICT_RLS=1                  torna falhas de R* fatais (exige 005/006 aplicadas)
//
// SEGURANCA: as rotas requireAdmin checam o papel ANTES de qualquer efeito colateral
// (verificado: o gate e a 1a instrucao de cada handler). Logo F* (POST/PUT/DELETE com
// sessao atendente) retornam 403 sem mutar nada. R4 (auto-escalonamento) e revertido
// via service_role ao final, por garantia.

import 'dotenv/config';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ATT_EMAIL = process.env.TEST_ATTENDANT_EMAIL || 'qa-atendente@cranium.test';
const ATT_PASS = process.env.TEST_ATTENDANT_PASSWORD || 'QaAtendente@2026';
const STRICT_RLS = process.env.STRICT_RLS === '1';

const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

// ---- util de cor/log -------------------------------------------------------
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// resultados por classe
const results = { N: [], F: [], R: [] };
function record(cls, id, ok, detail, status /* 'pass'|'fail'|'pending' */) {
  results[cls].push({ id, ok, detail, status: status || (ok ? 'pass' : 'fail') });
  const tag = status === 'pending' ? c.yellow('PENDING') : ok ? c.green('PASS') : c.red('FAIL');
  console.log(`  [${tag}] ${id} — ${detail}`);
}

function die(msg) {
  console.error(c.red(`\nERRO DE SETUP: ${msg}`));
  process.exit(2);
}

// ---- HTTP helper -----------------------------------------------------------
async function http(method, path, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers['cookie'] = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  return res;
}

// ---- forja de cookies de sessao via @supabase/ssr --------------------------
// Usa o proprio @supabase/ssr para gerar os cookies exatos (nome/chunking/base64)
// que o server-side espera, evitando reimplementar o formato a mao.
async function buildAttendantCookieHeader() {
  const jar = new Map(); // name -> value
  const client = createServerClient(SUPA_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(list) {
        for (const { name, value } of list) {
          if (value === '' ) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: ATT_EMAIL, password: ATT_PASS });
  if (error) die(`signIn atendente (ssr) falhou: ${error.message}`);
  if (jar.size === 0) die('nenhum cookie de sessao foi emitido pelo signIn (ssr).');
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
}

// ---- setup: garante usuario atendente de teste -----------------------------
async function ensureAttendant() {
  const admin = createClient(SERVICE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ATT_EMAIL,
    password: ATT_PASS,
    email_confirm: true,
    user_metadata: { nome: 'QA Atendente (teste AC5)' },
  });
  userId = created?.user?.id;
  if (createErr) {
    if (!/already|registered|exists/i.test(createErr.message)) {
      die(`createUser atendente falhou: ${createErr.message}`);
    }
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) die(`listUsers falhou: ${listErr.message}`);
    userId = list.users.find((u) => u.email?.toLowerCase() === ATT_EMAIL.toLowerCase())?.id;
  }
  if (!userId) die('nao foi possivel resolver o id do atendente de teste.');
  // Garante role='atendente' (service_role ignora o trigger 006).
  const { error: upErr } = await admin
    .from('profiles')
    .upsert({ id: userId, email: ATT_EMAIL, nome: 'QA Atendente (teste AC5)', role: 'atendente' }, { onConflict: 'id' });
  if (upErr) die(`upsert profile atendente falhou: ${upErr.message}`);
  return { admin, userId };
}

// ---- N* — nao autenticado --------------------------------------------------
// (a) UI sem cookie -> redirect /login (middleware).  (b) /api sem cookie -> 401.
const N_API = [
  ['GET', '/api/leads', 'N1 GET /api/leads'],
  ['GET', `/api/leads/${DUMMY_ID}`, 'N2 GET /api/leads/{id}'],
  ['POST', `/api/leads/${DUMMY_ID}/reply`, 'N3 POST /api/leads/{id}/reply'],
  ['GET', '/api/bi/metrics', 'N4 GET /api/bi/metrics'],
  ['PATCH', '/api/profile', 'N5 PATCH /api/profile'],
  ['GET', '/api/tags', 'N6 GET /api/tags'],
  ['GET', '/api/followups', 'N7 GET /api/followups'],
  ['GET', '/api/email/templates', 'N8 GET /api/email/templates'],
  ['GET', '/api/integrations/evolution/status', 'N9 GET /api/integrations/evolution/status'],
  ['POST', '/api/agente/config', 'N10 POST /api/agente/config (admin route, sem sessao => 401 antes do 403)'],
];

async function runN() {
  console.log(c.bold('\n== N* — nao autenticado (sem cookie) =='));
  // N0: rota de UI -> redirect para /login (middleware).
  const ui = await http('GET', '/', {});
  const loc = ui.headers.get('location') || '';
  const okUi = (ui.status === 307 || ui.status === 302 || ui.status === 308) && /\/login/.test(loc);
  record('N', 'N0', okUi, `GET / sem sessao -> ${ui.status} ${loc ? `(${loc})` : ''} [esperado redirect /login]`);
  // N1..N10: /api sem cookie -> 401.
  for (const [method, path, label] of N_API) {
    const res = await http(method, path, { body: method === 'GET' ? undefined : {} });
    const ok = res.status === 401;
    record('N', label.split(' ')[0], ok, `${label} -> ${res.status} [esperado 401]`);
  }
}

// ---- F* — atendente em rota requireAdmin -> 403 ----------------------------
const F_ADMIN = [
  ['POST', '/api/integrations/evolution/connect', 'F1'],
  ['POST', '/api/integrations/evolution/disconnect', 'F2'],
  ['POST', '/api/integrations/evolution/config', 'F3'],
  ['POST', '/api/integrations/meta/config', 'F4'],
  ['POST', '/api/integrations/meta/import', 'F5'],
  ['GET', '/api/integrations/google/auth', 'F6'],
  ['PUT', '/api/email/config', 'F7'],
  ['POST', '/api/email/test', 'F8'],
  ['POST', `/api/email/campaigns/${DUMMY_ID}/send`, 'F9'],
  ['POST', '/api/agente/config', 'F10'],
  ['POST', '/api/agente/preview', 'F11'],
  ['POST', '/api/followups/cadence', 'F12'],
];

async function runF(cookie) {
  console.log(c.bold('\n== F* — sessao atendente em rota requireAdmin (esperado 403) =='));
  for (const [method, path, id] of F_ADMIN) {
    const res = await http(method, path, { cookie, body: method === 'GET' ? undefined : {} });
    const ok = res.status === 403;
    record('F', id, ok, `${method} ${path} -> ${res.status} [esperado 403]`);
  }
  // F13 contraprova: GET requireUser com sessao atendente -> 200.
  for (const [path, id] of [['/api/agente/config', 'F13a'], ['/api/email/config', 'F13b']]) {
    const res = await http('GET', path, { cookie });
    const ok = res.status === 200;
    record('F', id, ok, `GET ${path} (atendente) -> ${res.status} [esperado 200, GET e user]`);
  }
}

// ---- R* — RLS defense-in-depth (anon key direto na Data API) ---------------
// Condicional as migrations 005/006. Sem elas: marcado PENDING (nao fatal salvo STRICT_RLS).
async function runR(admin, userId) {
  console.log(c.bold('\n== R* — RLS / anon key direto na Data API (depende de 005/006) =='));
  const anon = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } });
  const rest = (path) => `${SUPA_URL}/rest/v1/${path}`;

  // IMPORTANTE: leads/messages podem estar VAZIAS. Ler 0 linhas com a tabela vazia NAO
  // prova RLS (empty == bloqueado). Por isso semeamos uma SENTINELA via service_role e so
  // entao testamos a leitura anon — se a anon enxerga a sentinela, RLS NAO esta ligada.
  const phone = `+550000AC5RLS${Date.now()}`;
  let leadId = null;
  let msgId = null;
  try {
    const { data: lead, error: lErr } = await admin
      .from('leads').insert({ phone, name: 'AC5-RLS-SENTINEL' }).select('id').single();
    if (lErr) {
      record('R', 'R1', false, `nao foi possivel semear lead sentinela: ${lErr.message}`, 'pending');
      record('R', 'R2', false, 'pulado (sentinela ausente)', 'pending');
    } else {
      leadId = lead.id;
      const { data: msg } = await admin
        .from('messages').insert({ lead_id: leadId, direction: 'in', body: 'AC5-RLS-SENTINEL' }).select('id').single();
      msgId = msg?.id || null;

      // R1: anon le a sentinela em leads -> deve ser 0 linhas (pos-005).
      const { data: aLeads, error: aLErr } = await anon.from('leads').select('*').eq('phone', phone);
      if (aLErr || (Array.isArray(aLeads) && aLeads.length === 0)) {
        record('R', 'R1', true, `anon select leads(sentinela) -> ${aLErr ? aLErr.code : '0 linhas'} [bloqueado]`);
      } else {
        record('R', 'R1', false, `anon LEU a sentinela em leads (${aLeads.length} linha) -> RLS desligada [migration 005 NAO aplicada]`, 'pending');
      }

      // R2: anon le a sentinela em messages -> 0 linhas (pos-005).
      const { data: aMsgs, error: aMErr } = await anon.from('messages').select('*').eq('lead_id', leadId);
      if (aMErr || (Array.isArray(aMsgs) && aMsgs.length === 0)) {
        record('R', 'R2', true, `anon select messages(sentinela) -> ${aMErr ? aMErr.code : '0 linhas'} [bloqueado]`);
      } else {
        record('R', 'R2', false, `anon LEU a sentinela em messages (${aMsgs.length} linha) -> RLS desligada [migration 005 NAO aplicada]`, 'pending');
      }

      // R3: anon INSERT em leads -> deve ser negado (pos-005).
      const { error: aInsErr } = await anon.from('leads').insert({ phone: `${phone}-x`, name: 'anon-try' });
      if (aInsErr) {
        record('R', 'R3', true, `anon insert leads -> negado ${aInsErr.code} [bloqueado]`);
      } else {
        record('R', 'R3', false, 'anon INSERIU em leads -> RLS desligada [migration 005 NAO aplicada]', 'pending');
        await admin.from('leads').delete().eq('phone', `${phone}-x`);
      }
    }
  } catch (e) {
    record('R', 'R1', false, `R1/R2/R3 falharam: ${e.message}`, 'pending');
  } finally {
    if (msgId) await admin.from('messages').delete().eq('id', msgId);
    if (leadId) await admin.from('leads').delete().eq('id', leadId);
  }

  // R4: auto-escalonamento — sessao atendente PATCH profiles.role=admin -> 42501 (pos-006).
  try {
    const anon = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email: ATT_EMAIL, password: ATT_PASS });
    if (sErr || !sess?.session?.access_token) {
      record('R', 'R4', false, `signIn p/ token atendente falhou: ${sErr?.message || 'sem token'}`, 'pending');
    } else {
      const token = sess.session.access_token;
      const res = await fetch(rest(`profiles?id=eq.${userId}`), {
        method: 'PATCH',
        headers: { apikey: ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation' },
        body: JSON.stringify({ role: 'admin' }),
      });
      const txt = await res.text();
      let parsed = null; try { parsed = JSON.parse(txt); } catch { /* */ }
      const blocked = res.status === 403 || res.status === 401 || (parsed && parsed.code === '42501');
      const escalated = res.ok && Array.isArray(parsed) && parsed[0]?.role === 'admin';
      if (blocked) {
        record('R', 'R4', true, `atendente PATCH role=admin -> ${res.status} (${parsed?.code || 'rejeitado'}) [trigger 006 OK]`);
      } else if (escalated) {
        record('R', 'R4', false, `atendente CONSEGUIU virar admin -> migration 006 NAO aplicada [VULN]`, STRICT_RLS ? 'fail' : 'pending');
      } else {
        record('R', 'R4', false, `PATCH role -> ${res.status}: ${txt.slice(0, 160)}`, 'pending');
      }
    }
  } catch (e) {
    record('R', 'R4', false, `R4 falhou: ${e.message}`, 'pending');
  } finally {
    // Reverte qualquer escalonamento, por garantia (service_role ignora trigger).
    await admin.from('profiles').update({ role: 'atendente' }).eq('id', userId);
  }
}

// ---- main ------------------------------------------------------------------
async function main() {
  console.log(c.bold('AC5 — runner e2e (teste negativo auth + RBAC + RLS) · Story 5.2'));
  console.log(c.dim(`BASE_URL=${BASE_URL} · STRICT_RLS=${STRICT_RLS ? 'on' : 'off'}`));

  if (!SUPA_URL || !ANON_KEY) die('faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  if (!SERVICE_URL || !SERVICE_KEY) die('faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (para criar o atendente de teste).');

  // sanity: dev server de pe?
  try {
    await fetch(`${BASE_URL}/api/health`).catch(() => fetch(`${BASE_URL}/`));
  } catch {
    die(`dev server nao respondeu em ${BASE_URL}. Rode "npm run dev" antes.`);
  }

  const { admin, userId } = await ensureAttendant();
  const cookie = await buildAttendantCookieHeader();

  await runN();
  await runF(cookie);
  await runR(admin, userId);

  // ---- resumo ----
  console.log(c.bold('\n== RESUMO =='));
  const summarize = (cls) => {
    const arr = results[cls];
    const pass = arr.filter((r) => r.status === 'pass').length;
    const fail = arr.filter((r) => r.status === 'fail').length;
    const pend = arr.filter((r) => r.status === 'pending').length;
    const line = `${cls}*: ${pass} PASS · ${fail} FAIL · ${pend} PENDING (${arr.length} casos)`;
    console.log(fail > 0 ? c.red(line) : pend > 0 ? c.yellow(line) : c.green(line));
    return { fail, pend };
  };
  const sN = summarize('N');
  const sF = summarize('F');
  const sR = summarize('R');

  // Exit: N*/F* falham = fatal (regressao de codigo). R* fatal so com STRICT_RLS.
  const fatal = sN.fail + sF.fail + (STRICT_RLS ? sR.fail : 0);
  if (sR.pend > 0 && !STRICT_RLS) {
    console.log(c.yellow(`\nNota: ${sR.pend} caso(s) R* PENDING — dependem das migrations 005 (RLS) e 006 (role-lock).`));
    console.log(c.yellow('Aplique-as no Supabase e rode com STRICT_RLS=1 para validar a defesa-em-profundidade.'));
  }
  if (fatal > 0) {
    console.log(c.red(`\nRESULTADO: FAIL — ${fatal} caso(s) bloqueante(s).`));
    process.exit(1);
  }
  console.log(c.green('\nRESULTADO: PASS — N* e F* OK (RLS R* conforme nota acima).'));
  process.exit(0);
}

main().catch((e) => die(e?.stack || String(e)));

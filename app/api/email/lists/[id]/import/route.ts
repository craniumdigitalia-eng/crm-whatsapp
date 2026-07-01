import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getList, addContacts, isValidEmail } from '@/src/crm/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Regex de e-mail — mesma do email.ts para consistência.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Divide uma linha em células (separador vírgula ou ponto-e-vírgula,
// remove aspas duplas ao redor de campos).
function splitRow(line: string): string[] {
  return line.split(/[,;]/).map((cell) => cell.trim().replace(/^"(.*)"$/, '$1').trim());
}

// Parseia o texto colado pelo usuário (CSV ou um e-mail por linha).
// Aceita formatos: "email", "email,nome", "nome,email".
//   - Ignora cabeçalho se a 1ª linha não contém nenhuma célula com e-mail válido.
//   - Sem cabeçalho: detecta a coluna de e-mail por regex (suporta qualquer ordem de colunas).
//   - Com cabeçalho: usa os nomes "email"/"e-mail" e "name"/"nome".
// Retorna { contacts, invalid, total }:
//   total   = linhas de dados (excluindo cabeçalho, se houver)
//   invalid = linhas sem e-mail válido
//   contacts = pares { email, name? } de linhas válidas (pode ter duplicatas dentro do lote)
function parseImportText(text: string): {
  contacts: Array<{ email: string; name: string | null }>;
  invalid: number;
  total: number;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { contacts: [], invalid: 0, total: 0 };

  // Detecta cabeçalho: 1ª linha não tem nenhuma célula que pareça e-mail.
  const firstCells = splitRow(lines[0]);
  const hasHeader = !firstCells.some((c) => EMAIL_RE.test(c));

  // Índices de coluna definidos pelo cabeçalho (quando presente).
  let headerEmailIdx = -1;
  let headerNameIdx = -1;
  let start = 0;

  if (hasHeader) {
    const lower = firstCells.map((c) => c.toLowerCase());
    headerEmailIdx = lower.findIndex((c) => c === 'email' || c === 'e-mail');
    headerNameIdx = lower.findIndex((c) => c === 'name' || c === 'nome');
    start = 1;
  }

  const contacts: Array<{ email: string; name: string | null }> = [];
  let invalid = 0;
  const total = lines.length - start;

  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);

    let emailIdx: number;
    let nameIdx: number;

    if (hasHeader) {
      // Com cabeçalho: usa os índices detectados (fallback col 0 se não encontrou).
      emailIdx = headerEmailIdx >= 0 ? headerEmailIdx : 0;
      nameIdx = headerNameIdx;
    } else {
      // Sem cabeçalho: detecta a coluna de e-mail por regex (suporta "nome,email").
      emailIdx = cells.findIndex((c) => EMAIL_RE.test(c));
      if (emailIdx < 0) {
        invalid++;
        continue;
      }
      // A outra célula (se existir) é o nome.
      nameIdx = emailIdx === 0 ? 1 : 0;
    }

    const email = (cells[emailIdx] ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }

    const name =
      nameIdx >= 0 && nameIdx < cells.length ? cells[nameIdx].trim() || null : null;

    contacts.push({ email, name });
  }

  return { contacts, invalid, total };
}

// POST /api/email/lists/[id]/import
// Body: { text: string } — conteúdo colado (CSV ou um e-mail por linha).
// Resposta: { added: number, invalid: number, duplicates: number, total: number }
//   added      = inseridos com sucesso no banco
//   invalid    = linhas sem e-mail válido
//   duplicates = e-mails válidos já presentes na lista (ou duplicados no próprio lote)
//   total      = total de linhas de dados lidas
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id: listId } = await params;

  try {
    const list = await getList(listId);
    if (!list) return NextResponse.json({ error: 'lista nao encontrada' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';

    const { contacts, invalid, total } = parseImportText(text);

    // addContacts deduplica dentro do lote e ignora duplicatas já no banco.
    // Retorna quantos foram efetivamente inseridos.
    const added = contacts.length > 0 ? await addContacts(listId, contacts) : 0;

    // duplicates = válidos que não foram inseridos (já existiam ou duplicados no lote).
    const duplicates = contacts.length - added;

    return NextResponse.json({ added, invalid, duplicates, total });
  } catch (e) {
    console.error(`[api/email/lists/:id/import] POST:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

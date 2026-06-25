import path from "path";
import fs from "fs";

// Usa o SQLite embutido no Node (node:sqlite, disponivel no Node 22.5+/24).
// Evita dependencias nativas que precisariam de Python/compilador no Windows.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "crm.db");
export const db: any = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

// Migracao de schema legado (Story 1.2): detecta INTEGER PKs e recria as tabelas.
// Faz backup do arquivo antes de qualquer DROP — dados legados sao preservados.
{
  const cols: any[] = db.prepare("PRAGMA table_info(leads)").all();
  const schemaLegado =
    cols.length > 0 && cols.find((c: any) => c.name === "id")?.type === "INTEGER";
  if (schemaLegado) {
    const backupPath = `${dbPath}.backup-${Date.now()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.warn(
      `[db] Schema legado (INTEGER PKs) detectado. Backup salvo em ${backupPath}. Recriando tabelas com UUID (TEXT).`
    );
    db.exec("DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS leads;");
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  service_interest TEXT,
  budget TEXT,
  notes TEXT,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  last_direction TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  lead_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
`);

// Indice unico parcial para deduplicacao de mensagens recebidas (Story 1.1).
// external_id NULL (mensagens 'out' internas) nao participa do constraint.
// CREATE TABLE ja inclui a coluna — indice e idempotente (IF NOT EXISTS).
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id
    ON messages(external_id) WHERE external_id IS NOT NULL;
`);

import type Database from "better-sqlite3"

// Migrations idempotentes appliquées au démarrage.
// Rattrape la dérive entre db/schema.ts et db/migrations (colonnes ajoutées au schéma sans migration,
// migrations 0002/0003 ignorées par drizzle à cause de leurs horodatages) et crée les nouvelles tables.

type ColumnStep = { table: string; column: string; ddl: string }

const COLUMNS: ColumnStep[] = [
  { table: "transactions", column: "original_cents", ddl: "INTEGER" },
  { table: "transactions", column: "original_currency", ddl: "TEXT" },
  { table: "households", column: "currency", ddl: "TEXT NOT NULL DEFAULT 'EUR'" },
  { table: "users", column: "first_name", ddl: "TEXT" },
  { table: "users", column: "last_name", ddl: "TEXT" },
  { table: "loans", column: "property_id", ddl: "TEXT REFERENCES properties(id)" },
  { table: "properties", column: "taxe_fonciere_history", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "properties", column: "residence_type", ddl: "TEXT NOT NULL DEFAULT 'principale'" },
  { table: "properties", column: "rent_monthly_cents", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "households", column: "ai_key_enc", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "households", column: "ai_provider", ddl: "TEXT NOT NULL DEFAULT 'anthropic'" },
  { table: "households", column: "ai_model", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "households", column: "tax_situation", ddl: "TEXT NOT NULL DEFAULT '{}'" },
  { table: "households", column: "fx_rates", ddl: "TEXT NOT NULL DEFAULT '{}'" },
  { table: "households", column: "fx_source", ddl: "TEXT NOT NULL DEFAULT 'demo'" },
  { table: "households", column: "fx_ts", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "accounts", column: "last4", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "accounts", column: "purpose", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "transactions", column: "member_id", ddl: "TEXT" },
  { table: "goals", column: "monthly_cents", ddl: "INTEGER" },
  { table: "goals", column: "risk", ddl: "TEXT NOT NULL DEFAULT 'equilibre'" },
  { table: "goals", column: "owner_ids", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "recurring", column: "owner_ids", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "loans", column: "start_date", ddl: "TEXT" },
  { table: "loans", column: "account_id", ddl: "TEXT" },
  { table: "loans", column: "insurance_cents", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "loans", column: "owner_ids", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "properties", column: "costs", ddl: "TEXT NOT NULL DEFAULT '{}'" },
  { table: "properties", column: "estimate_source", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "investments", column: "account_id", ddl: "TEXT" },
  { table: "investments", column: "asset_class", ddl: "TEXT NOT NULL DEFAULT 'actions'" },
  { table: "investments", column: "zone", ddl: "TEXT NOT NULL DEFAULT 'Monde'" },
  { table: "investments", column: "sector", ddl: "TEXT NOT NULL DEFAULT 'Diversifié'" },
  { table: "investments", column: "currency", ddl: "TEXT NOT NULL DEFAULT 'EUR'" },
  { table: "investments", column: "cap", ddl: "TEXT NOT NULL DEFAULT '—'" },
  { table: "investments", column: "ter_pct", ddl: "REAL NOT NULL DEFAULT 0" },
  { table: "investments", column: "gain_cents", ddl: "INTEGER" },
  { table: "investments", column: "prev_price_cents", ddl: "INTEGER" },
]

const TABLES = [
  `CREATE TABLE IF NOT EXISTS investment_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL REFERENCES households(id),
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    bank TEXT NOT NULL DEFAULT '',
    owner_ids TEXT NOT NULL DEFAULT '[]',
    benef_ids TEXT NOT NULL DEFAULT '[]',
    since_year INTEGER NOT NULL,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    monthly_cents INTEGER NOT NULL DEFAULT 0,
    fees_pct REAL NOT NULL DEFAULT 0,
    match_pct REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL REFERENCES households(id),
    ym TEXT NOT NULL,
    value_cents INTEGER NOT NULL,
    bench_index REAL
  )`,
  `CREATE TABLE IF NOT EXISTS alert_states (
    household_id TEXT NOT NULL REFERENCES households(id),
    alert_id TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS investment_flows (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id),
    ym TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    match_cents INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS alert_states_hh_id ON alert_states (household_id, alert_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS portfolio_snapshots_hh_ym ON portfolio_snapshots (household_id, ym)",
]

export function ensureSchema(sqlite: Database.Database): void {
  const tableExists = (name: string) =>
    !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)

  for (const ddl of TABLES) sqlite.exec(ddl)

  for (const step of COLUMNS) {
    if (!tableExists(step.table)) continue
    const cols = sqlite.prepare(`PRAGMA table_info(${step.table})`).all() as { name: string }[]
    if (cols.some((c) => c.name === step.column)) continue
    try {
      sqlite.exec(`ALTER TABLE ${step.table} ADD COLUMN ${step.column} ${step.ddl}`)
    } catch (e) {
      // plusieurs processus (workers de build, serveurs) peuvent migrer en même temps : la colonne existe déjà
      if (!/duplicate column name/i.test((e as Error).message)) throw e
    }
  }
}

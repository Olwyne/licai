import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  taxSituation: text("tax_situation").notNull().default("{}"), // JSON: situation fiscale (cf. lib/finance/tax.ts)
  fxRates: text("fx_rates").notNull().default("{}"), // JSON: { USD: 0.88, … } (1 unité = X €)
  fxSource: text("fx_source").notNull().default("demo"), // demo | manual | api
  fxTs: text("fx_ts").notNull().default(""),
  currency: text("currency").notNull().default("EUR"), // devise de référence choisie à l'inscription
})

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("admin"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
})

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  short: text("short").notNull(),
  role: text("role").notNull(),
  colorHex: text("color_hex").notNull(),
  monthlyIncomeCents: integer("monthly_income_cents").notNull().default(0),
  birthYear: integer("birth_year"),
  retireYear: integer("retire_year"),
  isChild: integer("is_child", { mode: "boolean" }).notNull().default(false),
  allowanceCents: integer("allowance_cents").notNull().default(0),
})

export const banks = sqliteTable("banks", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  colorHex: text("color_hex").notNull(),
  csvSeparator: text("csv_separator").notNull().default(";"),
  csvDecimal: text("csv_decimal").notNull().default(","),
  csvDateFormat: text("csv_date_format").notNull().default("DD/MM/YYYY"),
})

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  bankId: text("bank_id").references(() => banks.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings", "investment", "card", "other"] }).notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  iban: text("iban"),
  colorHex: text("color_hex"),
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON array
  last4: text("last4").notNull().default(""),
  purpose: text("purpose").notNull().default(""),
})

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
  colorHex: text("color_hex").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
})

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("📁"),
  description: text("description").notNull().default(""),
  deadline: text("deadline"), // "YYYY-MM-DD" or null
  colorHex: text("color_hex").notNull().default("#1D9E75"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  accountId: text("account_id").references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  note: text("note").notNull().default(""),
  isCommon: integer("is_common", { mode: "boolean" }).notNull().default(true),
  importedAt: integer("imported_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  kind: text("kind", { enum: ["expense", "income", "transfer"] }).notNull().default("expense"),
  toAccountId: text("to_account_id").references(() => accounts.id),
  goalId: text("goal_id"), // FK to goals added after goals table
  projectId: text("project_id").references(() => projects.id),
  memberId: text("member_id"), // personne à qui l'opération est attribuée
})

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  categoryId: text("category_id").notNull().references(() => categories.id),
  limitCents: integer("limit_cents").notNull(),
  month: text("month").notNull(), // YYYY-MM
})

export const recurring = sqliteTable("recurring", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  accountId: text("account_id").references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  frequency: text("frequency", { enum: ["monthly", "quarterly", "annual"] }).notNull(),
  kind: text("kind", { enum: ["charge", "subscription", "insurance", "saving"] }).notNull(),
  nextDate: text("next_date").notNull(), // YYYY-MM-DD
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON: à la charge de
})

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tone: text("tone", { enum: ["warning", "info", "danger", "success"] }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
})

// Statut (fait / reporté) des alertes dérivées des données du foyer
export const alertStates = sqliteTable("alert_states", {
  householdId: text("household_id").notNull().references(() => households.id),
  alertId: text("alert_id").notNull(),
  status: text("status").notNull(), // "done" | "snooze"
})

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎯"),
  description: text("description").notNull().default(""),
  targetCents: integer("target_cents").notNull(),
  currentCents: integer("current_cents").notNull().default(0),
  deadline: text("deadline"), // "YYYY-MM-DD" or null
  kind: text("kind").notNull().default("court"), // "court" | "long"
  colorHex: text("color_hex").notNull().default("#1D9E75"),
  linkedAccountId: text("linked_account_id").references(() => accounts.id),
  projectId: text("project_id").references(() => projects.id),
  memberId: text("member_id").references(() => members.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  monthlyCents: integer("monthly_cents"), // effort mensuel saisi (null = calculé)
  risk: text("risk").notNull().default("equilibre"), // prudent | equilibre | dynamique
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON: personnes concernées
})

export const goalPockets = sqliteTable("goal_pockets", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").notNull().references(() => goals.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  pct: integer("pct").notNull().default(100),
})

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // "immobilier" | "vehicule" | "autre"
  valueCents: integer("value_cents").notNull(),
  purchasePriceCents: integer("purchase_price_cents").notNull(),
  purchaseDate: text("purchase_date"), // "YYYY-MM-DD"
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  // Immobilier fields
  address: text("address").notNull().default(""),
  surfaceSqm: real("surface_sqm"),
  lots: text("lots").notNull().default("[]"), // JSON: [{type, qty, sqm}]
  taxeFonciereCents: integer("taxe_fonciere_cents").notNull().default(0),
  taxeFonciereHistory: text("taxe_fonciere_history").notNull().default("[]"), // JSON: [{year, amountCents}]
  lastEstimatedAt: text("last_estimated_at"), // ISO date
  residenceType: text("residence_type").notNull().default("principale"), // "principale" | "secondaire" | "locatif"
  rentMonthlyCents: integer("rent_monthly_cents").notNull().default(0),
  estimateSource: text("estimate_source").notNull().default(""),
  costs: text("costs").notNull().default("{}"), // JSON: charges locatives { copro, assur, gestion, travaux (€/an), vacance (%), notaire (€) }
})

export const propertyOwners = sqliteTable("property_owners", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  memberId: text("member_id").notNull().references(() => members.id),
  sharePercent: real("share_percent").notNull().default(100),
})

export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // "immobilier" | "auto" | "conso" | "autre"
  principalCents: integer("principal_cents").notNull(),
  remainingCents: integer("remaining_cents").notNull(),
  monthlyPaymentCents: integer("monthly_payment_cents").notNull(),
  ratePercent: real("rate_percent").notNull(),
  endDate: text("end_date"), // "YYYY-MM-DD"
  propertyId: text("property_id").references(() => properties.id),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  startDate: text("start_date"), // "YYYY-MM"
  accountId: text("account_id"), // compte de prélèvement
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON: emprunteurs
  insuranceCents: integer("insurance_cents").notNull().default(0), // part d'assurance comprise dans la mensualité
})

// Enveloppes (assurance vie, PEA, CTO, PER…) qui portent les lignes du portefeuille
export const investmentAccounts = sqliteTable("investment_accounts", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  kind: text("kind").notNull(), // "av" | "pea" | "peapme" | "cto" | "per" | "pee" | "crypto" | "livret"
  name: text("name").notNull(),
  bank: text("bank").notNull().default(""),
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON array de member ids
  benefIds: text("benef_ids").notNull().default("[]"), // JSON array de member ids (assurance vie)
  sinceYear: integer("since_year").notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  monthlyCents: integer("monthly_cents").notNull().default(0),
  feesPct: real("fees_pct").notNull().default(0),
  matchPct: real("match_pct").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

// Valorisation mensuelle du portefeuille (+ indice de référence base 100 en janvier, optionnel)
export const portfolioSnapshots = sqliteTable("portfolio_snapshots", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  ym: text("ym").notNull(), // YYYY-MM
  valueCents: integer("value_cents").notNull(),
  benchIndex: real("bench_index"),
})

// Historique des versements du foyer sur les enveloppes (un enregistrement par mois ; match = abondement employeur)
export const investmentFlows = sqliteTable("investment_flows", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  ym: text("ym").notNull(), // YYYY-MM
  amountCents: integer("amount_cents").notNull(),
  matchCents: integer("match_cents").notNull().default(0),
  note: text("note").notNull().default(""),
})

export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  ticker: text("ticker").notNull().default(""),
  kind: text("kind").notNull(),           // "etf" | "action" | "fonds" | "crypto" | "autre"
  quantity: real("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  purchasePriceCents: integer("purchase_price_cents").notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  accountId: text("account_id"), // investment_accounts.id
  assetClass: text("asset_class").notNull().default("actions"), // actions | obligations | euro | immobilier | monetaire | crypto
  zone: text("zone").notNull().default("Monde"),
  sector: text("sector").notNull().default("Diversifié"),
  currency: text("currency").notNull().default("EUR"),
  cap: text("cap").notNull().default("—"), // Grandes | Petites | —
  terPct: real("ter_pct").notNull().default(0),
  gainCents: integer("gain_cents"), // plus-value connue (fonds euro, FCPE) ; null = calculée
  prevPriceCents: integer("prev_price_cents"), // clôture précédente, pour la variation du jour
})

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  insurer: text("insurer").notNull().default(""),
  kind: text("kind").notNull(),              // "assurance-vie" | "prevoyance" | "retraite" | "sante" | "autre"
  valueCents: integer("value_cents").notNull().default(0),
  monthlyPremiumCents: integer("monthly_premium_cents").notNull().default(0),
  startDate: text("start_date"),             // "YYYY-MM-DD"
  endDate: text("end_date"),                 // "YYYY-MM-DD" or null
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

// Inferred types
export type Household = typeof households.$inferSelect
export type User = typeof users.$inferSelect
export type Member = typeof members.$inferSelect
export type Bank = typeof banks.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Category = typeof categories.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Budget = typeof budgets.$inferSelect
export type Recurring = typeof recurring.$inferSelect
export type Alert = typeof alerts.$inferSelect
export type Goal = typeof goals.$inferSelect
export type Project = typeof projects.$inferSelect
export type Property = typeof properties.$inferSelect
export type PropertyOwner = typeof propertyOwners.$inferSelect
export type Loan = typeof loans.$inferSelect
export type Investment = typeof investments.$inferSelect
export type InvestmentAccount = typeof investmentAccounts.$inferSelect
export type Contract = typeof contracts.$inferSelect

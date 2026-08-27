import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("admin"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
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
  type: text("type", { enum: ["checking", "savings", "investment", "other"] }).notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  iban: text("iban"),
  colorHex: text("color_hex"),
  ownerIds: text("owner_ids").notNull().default("[]"), // JSON array
})

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
  colorHex: text("color_hex").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
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
  kind: text("kind", { enum: ["charge", "subscription", "saving"] }).notNull(),
  nextDate: text("next_date").notNull(), // YYYY-MM-DD
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
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

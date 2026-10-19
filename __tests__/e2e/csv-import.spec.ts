import { test, expect, type Page } from "@playwright/test"
import { loginOk } from "./helpers"

test.describe.configure({ mode: "serial" })

const uid = () => Math.random().toString(36).slice(2, 7)
const iso = (offset: number) => new Date(Date.now() + offset * 86400000)
const fr = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
const isoDate = (d: Date) => d.toISOString().slice(0, 10)

async function openWizard(page: Page) {
  await page.goto("/transactions?import=1")
  await expect(page.locator(".modal")).toBeVisible()
}
async function upload(page: Page, name: string, content: string | Buffer) {
  await page.locator('.modal input[type="file"]').setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8") })
  await expect(page.locator(".dz-file")).toContainText(name)
}
async function txByName(page: Page, name: string) {
  const { data } = await (await page.request.get("/api/transactions")).json()
  return (data as { name: string; amountCents: number; date: string; categoryId: string | null }[]).filter((t) => t.name.includes(name))
}

test.describe("Import CSV : modèles de colonnes et saisie manuelle", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("export d'une banque : préambule, guillemets, Windows-1252, montants à la française — lu, corrigeable et importé", async ({ page }) => {
    const tag = uid()
    const d1 = iso(-5), d2 = iso(-4)
    const csv = [
      "Compte;Courant FR76 3000 6000", "Période;Août 2026", "",
      "Date opération;Libellé;Débit euros;Crédit euros;Solde",
      `${fr(d1)};"Café, croissant ${tag}";3,50;;1 000,00`,
      `${fr(d2)};Remboursement é${tag};;1 250,40;2 250,40`,
      `31/02/2026;Date impossible ${tag};1,00;;0,00`,
    ].join("\r\n")
    // é encodé en Windows-1252 (un seul octet 0xE9), comme les exports de nombreuses banques
    await openWizard(page)
    await upload(page, "releve.csv", Buffer.from(csv, "latin1"))
    await page.getByRole("button", { name: /continuer/i }).click()

    await expect(page.getByLabel("Lignes à ignorer avant l'en-tête")).toHaveValue("3")
    await expect(page.getByLabel("Colonne date")).toHaveValue("Date opération")
    await expect(page.getByLabel("Colonne débit")).toHaveValue("Débit euros")
    await expect(page.getByTestId("parse-summary")).toContainText("2 opérations lues")
    await expect(page.getByTestId("parse-summary")).toContainText("1 ligne ignorée")
    await expect(page.getByTestId("parse-summary")).toContainText("ligne 7 : date illisible")

    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.getByTestId("import-issues")).toBeVisible()
    const rows = page.locator(".pv-edit")
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).getByLabel("Libellé")).toHaveValue(`Café, croissant ${tag}`)
    await expect(rows.nth(0).getByLabel("Montant")).toHaveValue("-3,50")
    await expect(rows.nth(1).getByLabel("Libellé")).toHaveValue(`Remboursement é${tag}`) // accent correctement décodé
    await expect(rows.nth(1).getByLabel("Montant")).toHaveValue("1250,40")

    await rows.nth(0).getByLabel("Montant").fill("-4,20") // correction avant import
    await page.getByRole("button", { name: /importer 2 opérations/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)

    const [coffee] = await txByName(page, `croissant ${tag}`)
    expect(coffee).toMatchObject({ amountCents: -420, date: isoDate(d1) })
    expect((await txByName(page, `Remboursement é${tag}`))[0]).toMatchObject({ amountCents: 125040, date: isoDate(d2) })
    expect(await txByName(page, `Date impossible ${tag}`)).toHaveLength(0)
  })

  test("un format enregistré est reconnu automatiquement pour les exports suivants, puis peut être supprimé", async ({ page }) => {
    const name = `Format test ${uid()}`
    const bankHeader = `Jour${uid()}`
    const mk = (label: string, amount: string) => `${bankHeader};Détail;Montant\n${fr(iso(-2))};${label};${amount}\n`

    await openWizard(page)
    await upload(page, "banque-a.csv", mk("Premier export", "-10,00"))
    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.getByLabel("Colonne date")).toHaveValue(bankHeader)
    await page.getByRole("button", { name: "Une colonne montant" }).click()
    await expect(page.getByLabel("Colonne montant")).toHaveValue("Montant")
    await page.getByLabel("Nom du format").fill(name)
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    await expect(page.getByRole("status").filter({ hasText: name })).toBeVisible()
    await page.keyboard.press("Escape")

    // enregistré côté serveur, donc disponible sur tout navigateur du foyer
    const list = (await (await page.request.get("/api/csv-templates")).json()).data as { name: string; dateCol: string; amountMode: string; id: string }[]
    const saved = list.find((t) => t.name === name)!
    expect(saved).toMatchObject({ dateCol: bankHeader, amountMode: "single" })

    // second fichier de la même banque : reconnu sans rien configurer
    await openWizard(page)
    await upload(page, "banque-a-suite.csv", mk("Deuxième export", "-25,00").replace("Détail", "Détail"))
    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.locator(".preset-hint")).toContainText(name)
    await expect(page.getByLabel("Colonne montant")).toHaveValue("Montant")
    await expect(page.getByTestId("parse-summary")).toContainText("1 opération lue")

    await page.getByLabel("Formats enregistrés").selectOption(name)
    await page.getByRole("button", { name: "Supprimer ce format" }).click()
    await expect(page.getByRole("status").filter({ hasText: "supprimé" })).toBeVisible()
    expect(((await (await page.request.get("/api/csv-templates")).json()).data as { id: string }[]).some((t) => t.id === saved.id)).toBe(false)
  })

  test("export aux dépenses positives : l'option « Inverser le signe » les remet en dépenses", async ({ page }) => {
    const tag = uid()
    await openWizard(page)
    await upload(page, "carte.csv", `Date,Description,Amount\n${isoDate(iso(-2))},Restaurant ${tag},45.00\n${isoDate(iso(-2))},Remboursement ${tag},-10.00\n`)
    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.getByLabel("Séparateur")).toHaveValue(",")
    await expect(page.getByLabel("Format de date")).toHaveValue("YYYY-MM-DD")
    await expect(page.getByLabel("Décimale des montants")).toHaveValue(".")
    await page.getByRole("switch", { name: "Inverser le signe des montants" }).check()
    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.locator(".pv-edit").nth(0).getByLabel("Montant")).toHaveValue("-45,00")
    await page.getByRole("button", { name: /importer 2 opérations/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)
    expect((await txByName(page, `Restaurant ${tag}`))[0].amountCents).toBe(-4500)
    expect((await txByName(page, `Remboursement ${tag}`))[0].amountCents).toBe(1000)
  })

  test("saisie manuelle : collage depuis un tableur, ligne ajoutée à la main, correction puis import", async ({ page }) => {
    const tag = uid()
    const d = fr(iso(-1))
    await openWizard(page)
    await page.getByRole("button", { name: /saisie manuelle/i }).click()
    await page.locator("#paste-area").fill(`${d}\tBoulangerie ${tag}\t-4,80\n${d}\tSalaire d'appoint ${tag}\t1 200,00\n99/99/2026\tCassée ${tag}\t1`)
    await page.getByRole("button", { name: /continuer/i }).click()
    await expect(page.getByTestId("import-issues")).toContainText("ligne 3")
    await expect(page.locator(".pv-edit")).toHaveCount(2)

    await page.getByRole("button", { name: /ajouter une ligne/i }).click()
    const last = page.locator(".pv-edit").nth(2)
    await last.getByLabel("Libellé").fill(`Parking ${tag}`)
    await expect(page.getByRole("button", { name: /importer 2 opérations/i })).toBeVisible() // la ligne sans montant n'est pas importable
    await last.getByLabel("Montant").fill("-2,50")
    await page.getByRole("button", { name: /importer 3 opérations/i }).click()
    await expect(page.locator(".modal")).toHaveCount(0)

    expect((await txByName(page, `Boulangerie ${tag}`))[0].amountCents).toBe(-480)
    expect((await txByName(page, `Salaire d'appoint ${tag}`))[0].amountCents).toBe(120000)
    expect((await txByName(page, `Parking ${tag}`))[0].amountCents).toBe(-250)
    expect(await txByName(page, `Cassée ${tag}`)).toHaveLength(0)
  })

  test("les anciens formats enregistrés dans le navigateur sont repris dans les modèles du foyer", async ({ page }) => {
    const name = `Ancien format ${uid()}`
    await page.goto("/transactions")
    await page.evaluate((n) => localStorage.setItem("licai-csv-presets", JSON.stringify([{ name: n, separator: ";", decimal: ",", dateFormat: "DD/MM/YYYY", amountMode: "single", dateCol: "Date", labelCol: "Libellé", amountCol: "Montant", debitCol: "", creditCol: "" }])), name)
    await page.goto("/transactions?import=1")
    await expect(page.locator(".modal")).toBeVisible()
    await expect.poll(async () => ((await (await page.request.get("/api/csv-templates")).json()).data as { name: string }[]).some((t) => t.name === name)).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem("licai-csv-presets"))).toBeNull()
    const t = ((await (await page.request.get("/api/csv-templates")).json()).data as { name: string; id: string }[]).find((x) => x.name === name)!
    await page.request.delete(`/api/csv-templates/${t.id}`)
  })

  test("l'API refuse un modèle invalide", async ({ page }) => {
    const res = await page.request.put("/api/csv-templates", { data: { template: { name: "", dateCol: "D" } } })
    expect(res.status()).toBe(400)
  })
})

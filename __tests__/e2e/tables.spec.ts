import { test, expect, type Locator } from "@playwright/test"
import { loginOk } from "./helpers"

const num = (t: string) => parseFloat(t.replace(/[\s  ]/g, "").replace(/[−–]/g, "-").replace(",", ".").replace(/[^\d.-]/g, ""))
const col = async (rows: Locator, idx: number) => (await rows.locator(`td:nth-child(${idx})`).allInnerTexts()).map(num)

test.describe("Tableaux : tri et filtre", () => {
  test.beforeEach(async ({ page }) => { await loginOk(page) })

  test("Placements : tri par colonne (croissant, décroissant, ordre d'origine) et filtre texte", async ({ page }) => {
    await page.goto("/placements")
    const table = page.locator("table.dtable", { hasText: "Enveloppe" }).first()
    const rows = table.locator("tbody tr:not(.tot)")
    const header = table.getByRole("columnheader", { name: /^Valeur/ })
    const initial = await rows.locator("td:nth-child(1)").allInnerTexts()
    expect(initial.length).toBeGreaterThan(3)
    await expect(header).toHaveAttribute("aria-sort", "none")

    await header.getByRole("button").click()
    await expect(header).toHaveAttribute("aria-sort", "ascending")
    const asc = await col(rows, 9)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))

    await header.getByRole("button").click()
    await expect(header).toHaveAttribute("aria-sort", "descending")
    const desc = await col(rows, 9)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))

    await header.getByRole("button").click() // retour à l'ordre d'origine
    await expect(header).toHaveAttribute("aria-sort", "none")
    expect(await rows.locator("td:nth-child(1)").allInnerTexts()).toEqual(initial)

    // filtre : un mot du nom de la première ligne (insensible à la casse et aux accents)
    const word = initial[0].split(/\s+/)[0].toUpperCase()
    await page.getByLabel("Filtrer les lignes du portefeuille").fill(word)
    const kept = await rows.locator("td:nth-child(1)").allInnerTexts()
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThanOrEqual(initial.length)
    for (const k of kept) expect(k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")).toContain(word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
    await expect(table.locator("tr.tot")).toContainText(`${kept.length} / ${initial.length} lignes`)

    await page.getByLabel("Filtrer les lignes du portefeuille").fill("zzzz-introuvable")
    await expect(table).toContainText("Aucune ligne ne correspond")
  })

  test("Prévisions : filtre par mois et tri sur le solde", async ({ page }) => {
    await page.goto("/previsions")
    const table = page.locator("table.rp-table")
    const rows = table.locator("tbody tr")
    await expect(rows.first()).toBeVisible()
    const total = await rows.count()
    expect(total).toBeGreaterThan(6)
    const firstMonth = (await rows.first().locator("td").first().innerText()).trim()
    const year = firstMonth.split(/\s+/).pop()!
    await page.getByLabel("Filtrer les mois").fill(year)
    const kept = await rows.locator("td:nth-child(1)").allInnerTexts()
    expect(kept.length).toBeGreaterThan(0)
    for (const k of kept) expect(k).toContain(year)

    await page.getByLabel("Filtrer les mois").fill("")
    await table.getByRole("columnheader", { name: /^Solde/ }).getByRole("button").click()
    const asc = await col(rows, 8)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
  })

  test("Tableau de bord, Patrimoine et Trajectoire : les en-têtes sont triables", async ({ page }) => {
    for (const [path, tableSel, headerName] of [["/dashboard", "table.dtable", /^Revenus/], ["/patrimoine", "table.dtable", /^Patrimoine net/], ["/trajectoire", "table.traj-table", /^Patrimoine net/]] as const) {
      await page.goto(path)
      const header = page.locator(tableSel).getByRole("columnheader", { name: headerName }).first()
      await header.scrollIntoViewIfNeeded()
      await expect(header).toHaveAttribute("aria-sort", "none")
      await header.getByRole("button").click()
      await expect(header).toHaveAttribute("aria-sort", "ascending")
      await header.getByRole("button").click()
      await expect(header).toHaveAttribute("aria-sort", "descending")
    }
  })
})

import { describe, expect, it } from "vitest"
import {
  applyTemplate, decodeCsv, DEFAULT_TEMPLATE, detectSeparator, detectSkipLines, guessDateFormat, guessMapping, headerSignature,
  matchTemplate, parseAmount, parseDate, parsePasted, sanitizeTemplate, tokenizeCsv, type CsvTemplate,
} from "@/lib/finance/csv-import"

const tpl = (over: Partial<CsvTemplate>): CsvTemplate => ({ ...DEFAULT_TEMPLATE, name: "T", dateCol: "Date", labelCol: "Libellé", ...over })

describe("lecture du fichier", () => {
  it("décode l'UTF-8 (BOM retiré) et à défaut le Windows-1252 des banques françaises", () => {
    expect(decodeCsv(new Uint8Array([0xef, 0xbb, 0xbf, 0x44, 0xc3, 0xa9, 0x62]).buffer)).toBe("Déb")
    expect(decodeCsv(new Uint8Array([0x44, 0xe9, 0x62, 0x69, 0x74]).buffer)).toBe("Débit") // é en Windows-1252
  })
  it("détecte le séparateur, y compris avec des virgules dans des champs entre guillemets", () => {
    expect(detectSeparator("Date;Libellé;Montant\n01/08/2026;Café, croissant;-3,50")).toBe(";")
    expect(detectSeparator('Date,Description,Amount\n2026-08-01,"Café, croissant",-3.50')).toBe(",")
    expect(detectSeparator("Date\tLibellé\tMontant\n01/08/2026\tCafé\t-3,50")).toBe("\t")
    expect(detectSeparator("Date|Libellé|Montant\n01/08/2026|Café|-3,50")).toBe("|")
  })
  it("découpe correctement guillemets, guillemets doublés, séparateurs et retours à la ligne dans les champs", () => {
    const rows = tokenizeCsv('a;b;c\r\n"x;y";"il dit ""oui""";"ligne 1\nligne 2"\r\n\r\n;;\n', ";")
    expect(rows).toEqual([["a", "b", "c"], ["x;y", 'il dit "oui"', "ligne 1\nligne 2"], [""], ["", "", ""]]) // lignes vides conservées
  })
  it("repère les lignes de préambule avant l'en-tête", () => {
    const rows = tokenizeCsv("Compte;FR76 3000;\nPériode;Août 2026;\n\nDate;Libellé;Débit;Crédit\n01/08/2026;Courses;10,00;\n02/08/2026;Salaire;;2000,00", ";")
    expect(detectSkipLines(rows)).toBe(3) // 3 lignes avant l'en-tête, dont une vide
    expect(detectSkipLines(tokenizeCsv("Date;Libellé;Montant\n01/08/2026;A;1\n02/08/2026;B;2", ";"))).toBe(0)
  })
})

describe("dates", () => {
  it("lit les formats usuels et refuse les dates impossibles", () => {
    expect(parseDate("01/08/2026", "DD/MM/YYYY")).toBe("2026-08-01")
    expect(parseDate("1/8/26", "DD/MM/YY")).toBe("2026-08-01")
    expect(parseDate("08/01/2026", "MM/DD/YYYY")).toBe("2026-08-01")
    expect(parseDate("2026-08-01 14:32:10", "YYYY-MM-DD")).toBe("2026-08-01")
    expect(parseDate("01.08.2026", "DD.MM.YYYY")).toBe("2026-08-01")
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull()
    expect(parseDate("13/13/2026", "DD/MM/YYYY")).toBeNull()
    expect(parseDate("pas une date", "DD/MM/YYYY")).toBeNull()
  })
  it("devine le format d'après les exemples (JJ/MM prioritaire quand c'est ambigu)", () => {
    expect(guessDateFormat(["01/08/2026", "15/08/2026"])).toBe("DD/MM/YYYY")
    expect(guessDateFormat(["08/15/2026", "08/20/2026"])).toBe("MM/DD/YYYY")
    expect(guessDateFormat(["01/08/2026", "02/08/2026"])).toBe("DD/MM/YYYY")
    expect(guessDateFormat(["2026-08-01", "2026-08-02"])).toBe("YYYY-MM-DD")
    expect(guessDateFormat(["01.08.2026"])).toBe("DD.MM.YYYY")
  })
})

describe("montants", () => {
  it("comprend les écritures françaises, anglaises et comptables", () => {
    expect(parseAmount("1 234,56", ",")).toBe(123456)
    expect(parseAmount("1.234,56", ",")).toBe(123456)
    expect(parseAmount("1,234.56", ".")).toBe(123456)
    expect(parseAmount("-12,50 €", ",")).toBe(-1250)
    expect(parseAmount("(12,50)", ",")).toBe(-1250)
    expect(parseAmount("12,50-", ",")).toBe(-1250)
    expect(parseAmount("+3", ",")).toBe(300)
    expect(parseAmount("1 000,00", ",")).toBe(100000)
    expect(parseAmount("−5,00", ",")).toBe(-500)
  })
  it("devine la décimale en mode automatique et refuse l'illisible", () => {
    expect(parseAmount("1.234,56")).toBe(123456)
    expect(parseAmount("1,234.56")).toBe(123456)
    expect(parseAmount("12,5")).toBe(1250)
    expect(parseAmount("1.234")).toBe(123400) // 3 chiffres après un séparateur unique : milliers
    expect(parseAmount("12.50")).toBe(1250)
    expect(parseAmount("abc")).toBeNull()
    expect(parseAmount("")).toBeNull()
    expect(parseAmount("1,2,3x")).toBeNull()
  })
})

describe("modèles de colonnes", () => {
  const headers = ["Date opération", "Libellé", "Débit euros", "Crédit euros", "Solde"]
  it("devine les colonnes d'après leur nom", () => {
    expect(guessMapping(headers)).toMatchObject({ dateCol: "Date opération", labelCol: "Libellé", debitCol: "Débit euros", creditCol: "Crédit euros", amountMode: "split" })
    expect(guessMapping(["Date", "Description", "Montant"])).toMatchObject({ amountCol: "Montant", amountMode: "single" })
  })
  it("reconnaît un modèle enregistré malgré la casse, les accents et l'ordre des colonnes", () => {
    const saved = [
      tpl({ name: "Autre banque", dateCol: "Date", labelCol: "Détail", amountMode: "single", amountCol: "Montant" }),
      tpl({ name: "Ma banque", dateCol: "DATE OPERATION", labelCol: "libelle", amountMode: "split", debitCol: "Debit euros", creditCol: "Credit euros" }),
    ]
    expect(matchTemplate(saved, headers)?.name).toBe("Ma banque")
    expect(matchTemplate(saved, ["Date", "Autre", "Chose"])).toBeNull()
    expect(headerSignature(["B", "a "])).toBe(headerSignature(["A", "b"]))
  })
  it("préfère le modèle de la banque choisie quand plusieurs conviennent", () => {
    const a = tpl({ name: "A", bankId: "b1", amountMode: "single", amountCol: "Montant" }), b = tpl({ name: "B", bankId: "b2", amountMode: "single", amountCol: "Montant" })
    expect(matchTemplate([a, b], ["Date", "Libellé", "Montant"], "b2")?.name).toBe("B")
  })
})

describe("application d'un modèle", () => {
  const file = tokenizeCsv("Relevé du compte;;;\nDate;Libellé;Débit;Crédit\n01/08/2026;Courses, Monoprix;87,40;\n15/08/2026;Salaire;;2 800,00\n32/08/2026;Date folle;1,00;\n20/08/2026;;5,00;\n21/08/2026;EDF;abc;\n", ";")
  const t = tpl({ skipLines: 1, amountMode: "split", debitCol: "Débit", creditCol: "Crédit" })
  it("lit les opérations en ignorant le préambule et signale les lignes écartées avec leur numéro", () => {
    const r = applyTemplate(file, t)
    expect(r.rows).toEqual([{ date: "2026-08-01", name: "Courses, Monoprix", amountCents: -8740 }, { date: "2026-08-15", name: "Salaire", amountCents: 280000 }])
    expect(r.issues).toEqual([{ line: 5, reason: "date illisible (« 32/08/2026 »)" }, { line: 6, reason: "libellé vide" }, { line: 7, reason: "montant illisible" }])
  })
  it("inverse le signe d'une colonne montant quand les dépenses sont positives", () => {
    const rows = tokenizeCsv("Date,Libellé,Montant\n2026-08-01,Resto,45.00\n2026-08-02,Remboursement,-10.00", ",")
    const r = applyTemplate(rows, tpl({ separator: ",", decimal: ".", dateFormat: "YYYY-MM-DD", amountMode: "single", amountCol: "Montant", invertSign: true }))
    expect(r.rows.map((x) => x.amountCents)).toEqual([-4500, 1000])
  })
  it("signale des colonnes introuvables au lieu de produire des lignes vides", () => {
    expect(applyTemplate(file, tpl({ skipLines: 1, dateCol: "Inconnue" })).issues[0].reason).toMatch(/introuvables/)
  })
  it("un débit saisi négatif reste une dépense", () => {
    const rows = tokenizeCsv("Date;Libellé;Débit;Crédit\n01/08/2026;Resto;-20,00;", ";")
    expect(applyTemplate(rows, tpl({ debitCol: "Débit", creditCol: "Crédit" })).rows[0].amountCents).toBe(-2000)
  })
})

describe("saisie collée depuis un tableur", () => {
  it("lit date, libellé, montant et catégorie, en devinant les formats", () => {
    const r = parsePasted("15/08/2026\tCafé\t-3,50\tRestauration\n16/08/2026\tSalaire\t2 000,00\n31/02/2026\tNon\t1\n17/08/2026\t\t5\n18/08/2026\tTest\tabc")
    expect(r.rows).toEqual([
      { date: "2026-08-15", name: "Café", amountCents: -350, category: "Restauration" },
      { date: "2026-08-16", name: "Salaire", amountCents: 200000, category: "" },
    ])
    expect(r.issues.map((i) => i.line)).toEqual([3, 4, 5])
  })
})

describe("validation d'un modèle reçu de l'API", () => {
  it("accepte un modèle valide et nettoie les valeurs", () => {
    const t = sanitizeTemplate({ name: " Ma banque ", bankId: "b1", separator: "|", decimal: ".", dateFormat: "DD.MM.YYYY", skipLines: 3, amountMode: "single", dateCol: "D", labelCol: "L", amountCol: "M", invertSign: true, extra: "x" })
    expect(t).toMatchObject({ name: "Ma banque", bankId: "b1", separator: "|", decimal: ".", dateFormat: "DD.MM.YYYY", skipLines: 3, invertSign: true })
    expect(t).not.toHaveProperty("extra")
  })
  it("refuse un modèle sans nom ou sans colonnes, et ramène les valeurs inconnues aux défauts", () => {
    expect(sanitizeTemplate({ name: "", dateCol: "D", labelCol: "L", amountCol: "M", amountMode: "single" })).toBeNull()
    expect(sanitizeTemplate({ name: "X", dateCol: "D", labelCol: "L", amountMode: "single" })).toBeNull()
    expect(sanitizeTemplate("pas un objet")).toBeNull()
    const t = sanitizeTemplate({ name: "X", dateCol: "D", labelCol: "L", amountCol: "M", amountMode: "single", separator: "§", dateFormat: "bizarre", skipLines: -4 })!
    expect(t).toMatchObject({ separator: ";", dateFormat: "DD/MM/YYYY", skipLines: 0 })
  })
})

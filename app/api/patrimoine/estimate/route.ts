import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

interface DvfRow {
  valeur_fonciere: number
  surface_reelle_bati: number
  date_mutation: string
}

interface OdsResponse {
  total_count: number
  results: DvfRow[]
}

async function geocode(
  address: string,
): Promise<{ lat: number; lon: number; citycode: string } | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null
  const json = (await res.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] }
      properties: { citycode: string }
    }>
  }
  const feat = json.features?.[0]
  if (!feat) return null
  const [lon, lat] = feat.geometry.coordinates
  return { lat, lon, citycode: feat.properties.citycode }
}

// Parse commune CSV from files.data.gouv.fr/geo-dvf (2025 data)
async function fetchCommune2025(citycode: string): Promise<DvfRow[]> {
  const dept = citycode.startsWith("97") ? citycode.substring(0, 3) : citycode.substring(0, 2)
  const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/2025/communes/${dept}/${citycode}.csv`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  } catch {
    return []
  }
  if (!res.ok) return []
  const text = await res.text()
  const lines = text.split("\n")
  if (lines.length < 2) return []
  // Column indices (stable across years):
  // 1=date_mutation, 3=nature_mutation, 4=valeur_fonciere, 30=type_local, 31=surface_reelle_bati
  const rows: DvfRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(",")
    if (cols.length < 32) continue
    const nature = cols[3]
    if (nature !== "Vente") continue
    const valeur = parseFloat(cols[4])
    const surface = parseFloat(cols[31])
    const date = cols[1]
    if (!valeur || !surface || valeur < 10000 || surface < 10) continue
    rows.push({ valeur_fonciere: valeur, surface_reelle_bati: surface, date_mutation: date })
  }
  return rows
}

async function fetchOds(lat: number, lon: number, radiusM: number): Promise<DvfRow[]> {
  const where = `within_distance(geo_point, geom'POINT(${lon} ${lat})', ${radiusM}m) AND nature_mutation='Vente' AND surface_reelle_bati IS NOT NULL AND valeur_fonciere IS NOT NULL`
  const url = `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/buildingref-france-demande-de-valeurs-foncieres-geolocalisee-millesime/records?limit=200&where=${encodeURIComponent(where)}&select=valeur_fonciere,surface_reelle_bati,date_mutation&order_by=date_mutation+DESC`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []
  const json = (await res.json()) as OdsResponse
  return json.results ?? []
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function computeResult(
  mutations: DvfRow[],
  surfaceSqm: number,
  source: string,
): {
  estimatedEuros: number
  pricePerSqm: number
  transactionCount: number
  period: string
  source: string
} {
  const pricesPerSqm = mutations.map((m) => m.valeur_fonciere / m.surface_reelle_bati)
  const medianPricePerSqm = median(pricesPerSqm)
  const estimatedEuros = Math.round(medianPricePerSqm * surfaceSqm)
  const sorted = [...mutations].sort((a, b) => a.date_mutation.localeCompare(b.date_mutation))
  const oldestYear = sorted[0]?.date_mutation?.substring(0, 4) ?? ""
  const latestYear = sorted.at(-1)?.date_mutation?.substring(0, 4) ?? oldestYear
  const period = oldestYear === latestYear ? latestYear : `${oldestYear}–${latestYear}`
  return {
    estimatedEuros,
    pricePerSqm: Math.round(medianPricePerSqm),
    transactionCount: mutations.length,
    period,
    source,
  }
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const body = (await req.json()) as { address: string; surfaceSqm: number }
  if (!body.address?.trim() || !body.surfaceSqm) {
    return err("Adresse et surface requises.", 400)
  }

  const coords = await geocode(body.address)
  if (!coords) return err("Adresse introuvable.", 404)

  // Try 2025 commune CSV first (most recent data)
  const commune2025 = await fetchCommune2025(coords.citycode)
  if (commune2025.length >= 5) {
    return ok(computeResult(commune2025, body.surfaceSqm, "geo-dvf-2025"))
  }

  // Fallback: ODS dataset (up to 2024), radius expansion
  let mutations: DvfRow[] = []
  let radius = 500

  for (const dist of [500, 1000, 2000, 5000, 10000]) {
    radius = dist
    const raw = await fetchOds(coords.lat, coords.lon, dist)
    const valid = raw.filter((m) => m.surface_reelle_bati >= 10 && m.valeur_fonciere >= 10000)
    if (!valid.length) continue
    const maxDate = new Date(valid[0].date_mutation)
    const cutoff = new Date(maxDate)
    cutoff.setMonth(cutoff.getMonth() - 12)
    const recent = valid.filter((m) => new Date(m.date_mutation) >= cutoff)
    mutations = recent.length >= 10 ? recent : valid
    if (mutations.length >= 30) break
  }

  if (mutations.length < 3) {
    return err("Données DVF insuffisantes pour cette adresse. Renseignez la valeur manuellement.", 422)
  }

  return ok({ ...computeResult(mutations, body.surfaceSqm, `ods-${radius}m`), radius })
}

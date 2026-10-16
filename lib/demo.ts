// Foyers de démonstration : un foyer isolé et jetable par visiteur, purgé après DEMO_TTL_HOURS.
export const DEMO_DOMAIN = "licai.demo"
export const DEMO_TTL_HOURS = Number(process.env.DEMO_TTL_HOURS) > 0 ? Number(process.env.DEMO_TTL_HOURS) : 24
export const DEMO_MAX_HOUSEHOLDS = 200

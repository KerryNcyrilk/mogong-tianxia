export const HOUR_MS = 3_600_000
export const OFFLINE_CAP_MS = 12 * HOUR_MS
export const SCHEMA_VERSION = "m0.1" as const

export interface RateCard {
  id: string
  perHour: Record<string, number>
}

export interface SaveState {
  schemaVersion: typeof SCHEMA_VERSION
  resources: Record<string, number>
  producers: RateCard[]
  consumers: RateCard[]
}

export interface SettledState extends SaveState {
  capped: boolean
  elapsedMs: number
  appliedMs: number
  appliedHours: number
}

function copyRates(rows: readonly RateCard[]): RateCard[] {
  return rows.map((row) => ({ id: row.id, perHour: { ...row.perHour } }))
}

function addRates(bag: Record<string, number>, rows: readonly RateCard[], hours: number): void {
  for (const row of rows) {
    for (const [key, rate] of Object.entries(row.perHour)) {
      bag[key] = (bag[key] ?? 0) + rate * hours
    }
  }
}

function consumeRates(bag: Record<string, number>, rows: readonly RateCard[], hours: number): void {
  const demand: Record<string, number> = {}
  for (const row of rows) {
    for (const [key, rate] of Object.entries(row.perHour)) {
      demand[key] = (demand[key] ?? 0) + rate * hours
    }
  }
  for (const [key, amount] of Object.entries(demand)) {
    const have = bag[key] ?? 0
    const take = Math.min(Math.max(have, 0), amount)
    bag[key] = have - take
  }
}

/**
 * Pure offline settlement. Production is applied before consumption in the same tick.
 * Time past 12 hours is dropped and reported with capped: true.
 * The argument is milliseconds; appliedHours is the float hour view of the time that counted.
 */
export function settle(state: SaveState, elapsedMs: number): SettledState {
  if (state.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`save schemaVersion must be ${SCHEMA_VERSION}`)
  }
  const raw = Number.isFinite(elapsedMs) ? elapsedMs : 0
  const capped = raw > OFFLINE_CAP_MS
  const appliedMs = Math.min(Math.max(raw, 0), OFFLINE_CAP_MS)
  const appliedHours = appliedMs / HOUR_MS
  const resources: Record<string, number> = { ...state.resources }
  addRates(resources, state.producers, appliedHours)
  consumeRates(resources, state.consumers, appliedHours)
  return {
    schemaVersion: state.schemaVersion,
    resources,
    producers: copyRates(state.producers),
    consumers: copyRates(state.consumers),
    capped,
    elapsedMs: raw,
    appliedMs,
    appliedHours,
  }
}

/** External hour interface. Converts a float hour count into milliseconds, then settles. */
export function settleHours(state: SaveState, elapsedHours: number): SettledState {
  return settle(state, elapsedHours * HOUR_MS)
}

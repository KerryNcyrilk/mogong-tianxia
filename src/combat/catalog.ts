import type { UnitType } from "./types.ts"

/** Numeric combat stats on a v4.0 unit row. */
export const COMBAT_FIELDS = ["atk", "def", "spd", "range", "hp"] as const

export type CombatField = (typeof COMBAT_FIELDS)[number]

const UNIT_TYPES: readonly UnitType[] = [
  "cavalry",
  "blade",
  "beast",
  "bow",
  "scholar",
  "halberd",
  "shield",
]

export function isUnitType(value: string): value is UnitType {
  return (UNIT_TYPES as readonly string[]).includes(value)
}

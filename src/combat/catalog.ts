import catalog from "../../data/units.json" with { type: "json" }
import type { UnitType } from "./types.ts"

/** Six combat numbers. hpPer and move keep their existing names; spd and the identity fields are added beside them. */
export const COMBAT_FIELDS = ["atk", "def", "spd", "hpPer", "range", "move"] as const

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

export function spdOf(type: UnitType): number {
  const row = catalog.units[type]
  if (typeof row?.spd !== "number") throw new Error(`units.json spd missing:${type}`)
  return row.spd
}

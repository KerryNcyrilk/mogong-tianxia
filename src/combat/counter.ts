import catalog from "../../data/units.json" with { type: "json" }
import { balance } from "./balance.ts"
import { isUnitType } from "./catalog.ts"
import type { UnitType } from "./types.ts"

/**
 * Directed counter pairs loaded from data/units.json.
 * `counters` is the v3.1 one-way ring. `countered-by` is the reverse edge and stays at 1.0.
 */
export interface CounterPair {
  attacker: UnitType
  defender: UnitType
  relation: "counters" | "countered-by"
}

function loadPairs(): CounterPair[] {
  return catalog.counter.map((row) => {
    if (!isUnitType(row.attacker) || !isUnitType(row.defender)) {
      throw new Error(`units.json counter pair has an unknown unit: ${row.attacker}->${row.defender}`)
    }
    if (row.relation !== "counters" && row.relation !== "countered-by") {
      throw new Error(`units.json counter relation is not counters or countered-by`)
    }
    return { attacker: row.attacker, defender: row.defender, relation: row.relation }
  })
}

export const COUNTER_PAIRS: readonly CounterPair[] = loadPairs()

function loadTarget(): Record<UnitType, UnitType | null> {
  const target: Record<UnitType, UnitType | null> = {
    scholar: null,
    bow: null,
    shield: null,
    blade: null,
    halberd: null,
    cavalry: null,
    beast: null,
  }
  for (const pair of COUNTER_PAIRS) {
    if (pair.relation === "counters") target[pair.attacker] = pair.defender
  }
  return target
}

/** One-way map derived from the `counters` rows. The reverse matchup is 1.0. 神獸 stays outside the cycle. */
export const COUNTER_TARGET: Record<UnitType, UnitType | null> = loadTarget()

export function counterMultiplier(
  attacker: UnitType,
  defender: UnitType,
  retaliation: boolean,
): number {
  if (retaliation) return 1
  if (COUNTER_TARGET[attacker] === defender) return balance.COUNTER_MULT
  return 1
}

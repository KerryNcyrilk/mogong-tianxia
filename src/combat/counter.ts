import catalog from "../../data/units.json" with { type: "json" }
import { balance } from "./balance.ts"

/**
 * Directed pairs from data/units.json. Advantage is 1.25, the reverse edge is 0.80.
 * Elites share the base unit through `aliases`. The grid roster still speaks the
 * old English type names; those names resolve onto the same six base ids.
 */
export interface CounterPair {
  attacker: string
  defender: string
  mult: number
}

const LEGACY_BASE: Readonly<Record<string, string>> = {
  blade: "dao",
  halberd: "ji",
  bow: "gong",
  shield: "dun",
  cavalry: "qi",
  scholar: "xuezhe",
}

export function canonicalUnitId(id: string): string {
  if (Object.prototype.hasOwnProperty.call(catalog.aliases, id)) {
    return catalog.aliases[id as keyof typeof catalog.aliases]
  }
  return LEGACY_BASE[id] ?? id
}

function loadPairs(): CounterPair[] {
  if (catalog.counters.length !== 12) {
    throw new Error(`units.json counters must be 12, got ${catalog.counters.length}`)
  }
  return catalog.counters.map((row) => {
    if (row.mult !== balance.COUNTER_MULT && row.mult !== balance.COUNTER_WEAK) {
      throw new Error(`units.json counter mult is outside v4.0: ${row.attacker}->${row.defender}`)
    }
    return { attacker: row.attacker, defender: row.defender, mult: row.mult }
  })
}

export const COUNTER_PAIRS: readonly CounterPair[] = loadPairs()

function loadTarget(): Record<string, string> {
  const target: Record<string, string> = {}
  for (const pair of COUNTER_PAIRS) {
    if (pair.mult === balance.COUNTER_MULT) target[pair.attacker] = pair.defender
  }
  return target
}

/** Advantage edge of the one-way ring. The reverse matchup is 0.80, read from the pair list. */
export const COUNTER_TARGET: Readonly<Record<string, string>> = loadTarget()

export function counterMultiplier(attacker: string, defender: string, retaliation = false): number {
  if (retaliation) return 1
  const from = canonicalUnitId(attacker)
  const to = canonicalUnitId(defender)
  for (const pair of COUNTER_PAIRS) {
    if (pair.attacker === from && pair.defender === to) return pair.mult
  }
  return 1
}

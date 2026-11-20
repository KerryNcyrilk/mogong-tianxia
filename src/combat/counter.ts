import type { UnitType } from "./types.ts"
import { balance } from "./balance.ts"

/**
 * One-way counter map: counter[attacker] = the defender type it beats.
 * This is not a symmetric matrix. The reverse matchup is 1.0.
 * 神獸 is outside the cycle.
 */
export const COUNTER_TARGET: Record<UnitType, UnitType | null> = {
  scholar: "bow",
  bow: "shield",
  shield: "blade",
  blade: "halberd",
  halberd: "cavalry",
  cavalry: "scholar",
  beast: null,
}

export function counterMultiplier(
  attacker: UnitType,
  defender: UnitType,
  retaliation: boolean,
): number {
  if (retaliation) return 1
  if (COUNTER_TARGET[attacker] === defender) return balance.COUNTER_MULT
  return 1
}

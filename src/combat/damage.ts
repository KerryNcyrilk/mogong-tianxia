import catalog from "../../data/units.json" with { type: "json" }
import { balance } from "./balance.ts"
import { counterMultiplier } from "./counter.ts"
import type { DamageInput, General, UnitSnapshot } from "./types.ts"

/** v4.0: floor((ATK * C - DEF) * M), then clamp at minDamage. */
export function calcDamage(a: UnitSnapshot, d: UnitSnapshot, opts?: { morale?: number }): number {
  const morale = opts?.morale ?? catalog.formula.defaultMorale
  const advantage = counterMultiplier(a.id, d.id)
  const raw = (a.atk * advantage - d.def) * morale
  return Math.max(catalog.formula.minDamage, Math.floor(raw))
}

/** Spec §2.1 writes the aura divisor as /200. It is not a balance.json key. */
const AURA_DIVISOR = 200

function auraFactor(stat: number | undefined): number {
  if (stat == null) return 1
  return 1 + stat / AURA_DIVISOR
}

export function attackPrime(unitAtk: number, general: General | null): number {
  return unitAtk * auraFactor(general?.atk)
}

export function defensePrime(unitDef: number, general: General | null): number {
  return unitDef * auraFactor(general?.def)
}

export function calculateDamage(input: DamageInput): number {
  const atkPrime = attackPrime(input.atk, input.attackerGeneral)
  const defPrime = defensePrime(input.def, input.defenderGeneral)
  const advantage = input.retaliation
    ? 1
    : counterMultiplier(input.attackerType, input.defenderType, false)
  const base = atkPrime * input.count * advantage - defPrime * input.count
  const finalDamage = Math.max(base, balance.DMG_FLOOR * input.count)
  return Math.max(finalDamage, 0)
}

export function lossesFromDamage(finalDamage: number, defenderHpPerUnit: number): number {
  if (defenderHpPerUnit <= 0) return 0
  return Math.max(0, Math.floor(finalDamage / defenderHpPerUnit))
}

export function skillDamage(skillCoef: number, skillAttr: number, general: General | null): number {
  return skillCoef * skillAttr * auraFactor(general?.atk)
}

export function skillLosses(
  skillDmg: number,
  defenderGeneral: General | null,
  defenderHpPerUnit: number,
): number {
  if (defenderHpPerUnit <= 0) return 0
  return Math.floor(skillDmg / auraFactor(defenderGeneral?.def) / defenderHpPerUnit)
}

export function stackTotalHp(count: number, hpPerUnit: number): number {
  return count * hpPerUnit
}

export function turnsToClear(totalHp: number, damagePerTurn: number): number {
  if (damagePerTurn <= 0) return Number.POSITIVE_INFINITY
  let remaining = totalHp
  let turns = 0
  while (remaining > 0) {
    remaining -= damagePerTurn
    turns += 1
  }
  return turns
}

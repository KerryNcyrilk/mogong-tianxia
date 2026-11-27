/**
 * 棋盤傷害的執行期係數。公式仍在 src/combat，這裡只在結果上回補。
 * 人數權重乘的是攻擊方人數：floor(原傷害 × (1 + (人數 − 1) × 權重))。
 * 士氣門檻最高 50%。調低時，把棋盤已套上的 0.9 懲罰還原（回合 ≤5 仍不懲罰）。
 * 兩個係數都在預設時，函式直接交回原狀態。
 */
import { applyCommand, autoCommands, autoTurn } from "../combat/board.ts"
import type { ApplyResult, BoardState, BoardUnit } from "../combat/board.ts"
import type { Side, UnitType } from "../combat/types.ts"
import { SANDBOX_UNITS } from "../sandbox/scenario.ts"
import { moraleThresholdOf, troopDamageWeight } from "./devOverrides.ts"

function countOf(unit: BoardUnit): number {
  const row = SANDBOX_UNITS[unit.type as UnitType]
  if (!row || row.hpPer <= 0) return 1
  return Math.max(1, Math.round(unit.maxHp / row.hpPer))
}

function factorFor(count: number, weight: number): number {
  const size = Math.max(1, count)
  return 1 + (size - 1) * weight
}

export function troopDamageFactor(count: number): number {
  const weight = troopDamageWeight()
  if (weight === 0) return 1
  return factorFor(count, weight)
}

function aliveRatio(state: BoardState, side: Side): number {
  let total = 0
  let living = 0
  for (const unit of state.units) {
    if (unit.side !== side) continue
    total += 1
    if (unit.hp > 0) living += 1
  }
  return living / Math.max(1, total)
}

function withOver(state: BoardState): BoardState {
  if (state.over) return state
  let attackers = false
  let defenders = false
  for (const unit of state.units) {
    if (unit.hp <= 0) continue
    if (unit.side === "attacker") attackers = true
    else defenders = true
  }
  if (!attackers) return { ...state, over: "defender" }
  if (!defenders) return { ...state, over: "attacker" }
  return state
}

export function adjustBoardHit(before: BoardState, result: ApplyResult): BoardState {
  if (!result.ok) return result.state
  const weight = troopDamageWeight()
  const threshold = moraleThresholdOf()
  if (weight === 0 && threshold >= 0.5) return result.state
  const entry = result.state.log[result.state.log.length - 1]
  if (!entry || (entry.kind !== "attack" && entry.kind !== "skill") || entry.damage == null || !entry.targetId) {
    return result.state
  }
  const dealt = entry.damage
  let nextDamage = dealt
  if (threshold < 0.5 && before.turn > 5 && dealt > 0) {
    const ratio = aliveRatio(before, entry.side)
    if (ratio > threshold && ratio <= 0.5) nextDamage = Math.round(dealt / 0.9)
  }
  if (weight > 0) {
    const attacker = before.units.find((unit) => unit.id === entry.unitId)
    const factor = attacker ? factorFor(countOf(attacker), weight) : 1
    if (factor !== 1) nextDamage = Math.floor(nextDamage * factor)
  }
  const extra = nextDamage - dealt
  if (extra <= 0) return result.state
  const target = result.state.units.find((unit) => unit.id === entry.targetId)
  if (!target) return result.state
  const applied = Math.min(target.hp, extra)
  if (applied <= 0) return result.state
  target.hp = Math.max(0, target.hp - applied)
  entry.damage = dealt + applied
  return target.hp === 0 ? withOver(result.state) : result.state
}

/** 係數在預設時走原本的 autoTurn；否則逐手重算，讓人數權重吃到實際扣血。 */
export function stepAutoBoard(current: BoardState): BoardState {
  if (troopDamageWeight() === 0 && moraleThresholdOf() >= 0.5) {
    return autoTurn({ ...current, auto: true }).state
  }
  let working: BoardState = { ...current, auto: true }
  const started = working.turn
  for (let guard = 0; guard < 64; guard += 1) {
    if (working.over) break
    const command = autoCommands(working)[0]
    if (!command) break
    const result = applyCommand(working, command)
    if (!result.ok) break
    working = adjustBoardHit(working, result)
    if (working.side === "attacker" && working.acted.length === 0 && working.turn > started) break
  }
  return working
}

import catalog from "../../data/units.json" with { type: "json" }
import { calcDamage } from "./damage.ts"
import type { Side, UnitSnapshot } from "./types.ts"

/** One v4.0 battle. `turn` is how many turns have already been played. */
export interface BattleState {
  units: UnitSnapshot[]
  turn: number
  /** Ids that acted in the turn just resolved, fastest first. */
  order?: string[]
}

export interface BattleResult {
  winner: Side
  turns: number
  reason: string
}

function cloneUnit(unit: UnitSnapshot): UnitSnapshot {
  return { ...unit }
}

function alive(units: readonly UnitSnapshot[], side: Side): number {
  let count = 0
  for (const unit of units) {
    if (unit.side === side && unit.hp > 0) count += 1
  }
  return count
}

function formationIndex(unit: UnitSnapshot): number {
  return unit.index ?? 0
}

function distance(a: UnitSnapshot, b: UnitSnapshot): number | null {
  if (a.x == null || a.y == null || b.x == null || b.y == null) return null
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function nearer(actor: UnitSnapshot, enemy: UnitSnapshot, best: UnitSnapshot): boolean {
  const enemyDist = distance(actor, enemy)
  const bestDist = distance(actor, best)
  if (enemyDist != null && bestDist != null && enemyDist !== bestDist) return enemyDist < bestDist
  const byIndex = formationIndex(enemy) - formationIndex(best)
  if (byIndex !== 0) return byIndex < 0
  return enemy.id < best.id
}

function nearest(actor: UnitSnapshot, enemies: readonly UnitSnapshot[]): UnitSnapshot {
  const first = enemies[0]
  if (!first) throw new Error("no target")
  let best = first
  for (const enemy of enemies) {
    if (nearer(actor, enemy, best)) best = enemy
  }
  return best
}

function actingOrder(units: readonly UnitSnapshot[]): string[] {
  return units
    .filter((unit) => unit.hp > 0)
    .slice()
    .sort((a, b) => {
      if (a.spd !== b.spd) return b.spd - a.spd
      if (a.side !== b.side) return a.side === "attacker" ? -1 : 1
      const byIndex = formationIndex(a) - formationIndex(b)
      if (byIndex !== 0) return byIndex
      if (a.id < b.id) return -1
      if (a.id > b.id) return 1
      return 0
    })
    .map((unit) => unit.id)
}

function judge(units: readonly UnitSnapshot[], turn: number, limit: number): BattleResult | null {
  const attackers = alive(units, "attacker")
  const defenders = alive(units, "defender")
  if (attackers === 0 && defenders === 0) {
    return { winner: "defender", turns: turn, reason: "mutual-wipe" }
  }
  if (attackers === 0) return { winner: "defender", turns: turn, reason: "wipe" }
  if (defenders === 0) return { winner: "attacker", turns: turn, reason: "wipe" }
  if (turn >= limit) return { winner: "defender", turns: turn, reason: catalog.turnLimitResult }
  return null
}

export function resolveTurn(state: BattleState): BattleState {
  const units = state.units.map(cloneUnit)
  const remaining = actingOrder(units)
  const acted: string[] = []
  while (remaining.length > 0) {
    const id = remaining.shift()
    if (id === undefined) break
    const actor = units.find((unit) => unit.id === id)
    if (!actor || actor.hp <= 0) continue
    const enemies = units.filter((unit) => unit.side !== actor.side && unit.hp > 0)
    if (enemies.length === 0) break
    const target = nearest(actor, enemies)
    const lastDuel = alive(units, "attacker") === 1 && alive(units, "defender") === 1
    target.hp = Math.max(0, target.hp - calcDamage(actor, target))
    if (target.hp <= 0) {
      const index = remaining.indexOf(target.id)
      if (index >= 0) remaining.splice(index, 1)
      if (lastDuel && !acted.includes(target.id)) {
        actor.hp = Math.max(0, actor.hp - calcDamage(target, actor))
      }
    }
    acted.push(actor.id)
  }
  return { units, turn: state.turn + 1, order: acted }
}

export function resolveBattle(state: BattleState, maxTurns = catalog.turnLimit): BattleResult {
  let current: BattleState = {
    units: state.units.map(cloneUnit),
    turn: state.turn,
    order: state.order ? [...state.order] : undefined,
  }
  for (let guard = 0; guard <= maxTurns + 1; guard += 1) {
    const decided = judge(current.units, current.turn, maxTurns)
    if (decided) return decided
    current = resolveTurn(current)
  }
  return { winner: "defender", turns: current.turn, reason: catalog.turnLimitResult }
}

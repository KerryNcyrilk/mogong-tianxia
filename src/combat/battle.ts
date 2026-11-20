import { balance } from "./balance.ts"
import { calculateDamage } from "./damage.ts"
import { cellKey, chebyshev, inBounds, type Cell } from "./grid.ts"
import { initiativeOrder } from "./initiative.ts"
import type { Side, Squad } from "./types.ts"

export type BattleEvent =
  | { kind: "move"; turn: number; actorId: string; targetId: string; from: Cell; to: Cell }
  | { kind: "attack"; turn: number; actorId: string; targetId: string; damage: number }
  | { kind: "retaliation"; turn: number; actorId: string; targetId: string; damage: number }
  | { kind: "idle"; turn: number; actorId: string; targetId: string }
  | { kind: "turn-limit"; turn: number }

export interface BattleState {
  squads: Squad[]
  turn: number
  phase: "ongoing" | "done"
  winner: Side | "draw" | null
  reason: "wipe" | "turn-limit" | null
  log: BattleEvent[]
  retaliated: string[]
  cursor: number
  order: string[]
}

const DIRS: readonly Cell[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
]

function cloneSquad(squad: Squad): Squad {
  return { ...squad, general: squad.general ? { ...squad.general } : null }
}

export function isAlive(squad: Squad): boolean {
  return squad.hp > 0
}

export function sideHp(squads: readonly Squad[], side: Side): number {
  let total = 0
  for (const squad of squads) {
    if (squad.side === side) total += squad.hp
  }
  return total
}

function wipeWinner(squads: readonly Squad[]): Side | "draw" | null {
  const attackerAlive = sideHp(squads, "attacker") > 0
  const defenderAlive = sideHp(squads, "defender") > 0
  if (attackerAlive && defenderAlive) return null
  if (attackerAlive) return "attacker"
  if (defenderAlive) return "defender"
  return "draw"
}

function replaceSquad(squads: readonly Squad[], id: string, next: Squad): Squad[] {
  return squads.map((squad) => (squad.id === id ? next : squad))
}

function applyHit(squad: Squad, damage: number): Squad {
  const hp = Math.max(0, squad.hp - damage)
  if (hp <= 0) return { ...squad, hp: 0, count: 0 }
  return { ...squad, hp, count: Math.ceil(hp / squad.hpPer) }
}

function assertPlacement(squads: readonly Squad[]): void {
  const seen = new Set<string>()
  for (const squad of squads) {
    if (!inBounds(squad.x, squad.y)) {
      throw new Error(`out-of-bounds:${squad.id}`)
    }
    const key = cellKey(squad.x, squad.y)
    if (seen.has(key)) throw new Error(`occupied:${key}`)
    seen.add(key)
  }
}

export function createBattle(squads: readonly Squad[]): BattleState {
  const cloned = squads.map(cloneSquad)
  assertPlacement(cloned)
  const wiped = wipeWinner(cloned)
  return {
    squads: cloned,
    turn: 1,
    phase: wiped ? "done" : "ongoing",
    winner: wiped,
    reason: wiped ? "wipe" : null,
    log: [],
    retaliated: [],
    cursor: 0,
    order: initiativeOrder(cloned.filter(isAlive)).map((squad) => squad.id),
  }
}

function pickTarget(actor: Squad, enemies: readonly Squad[]): Squad {
  let best = enemies[0]
  if (!best) throw new Error("no target")
  let bestDist = chebyshev(actor, best)
  for (const enemy of enemies.slice(1)) {
    const dist = chebyshev(actor, enemy)
    if (
      dist < bestDist ||
      (dist === bestDist &&
        (enemy.y < best.y || (enemy.y === best.y && (enemy.x < best.x || (enemy.x === best.x && enemy.id < best.id)))))
    ) {
      best = enemy
      bestDist = dist
    }
  }
  return best
}

function stepCloser(from: Cell, target: Cell, occupied: ReadonlySet<string>): Cell | null {
  const startDist = chebyshev(from, target)
  let best: Cell | null = null
  let bestDist = startDist
  for (const dir of DIRS) {
    const next = { x: from.x + dir.x, y: from.y + dir.y }
    if (!inBounds(next.x, next.y)) continue
    if (occupied.has(cellKey(next.x, next.y))) continue
    const dist = chebyshev(next, target)
    if (dist >= startDist) continue
    if (
      best === null ||
      dist < bestDist ||
      (dist === bestDist && (next.y < best.y || (next.y === best.y && next.x < best.x)))
    ) {
      best = next
      bestDist = dist
    }
  }
  return best
}

function strike(
  squads: readonly Squad[],
  attacker: Squad,
  defender: Squad,
  retaliation: boolean,
  turn: number,
): { squads: Squad[]; event: BattleEvent } {
  const damage = calculateDamage({
    atk: attacker.atk,
    def: defender.def,
    count: attacker.count,
    attackerType: attacker.type,
    defenderType: defender.type,
    attackerGeneral: attacker.general,
    defenderGeneral: defender.general,
    retaliation,
  })
  return {
    squads: replaceSquad(squads, defender.id, applyHit(defender, damage)),
    event: {
      kind: retaliation ? "retaliation" : "attack",
      turn,
      actorId: attacker.id,
      targetId: defender.id,
      damage,
    },
  }
}

function finishByHp(state: BattleState): BattleState {
  const attacker = sideHp(state.squads, "attacker")
  const defender = sideHp(state.squads, "defender")
  const winner = attacker > defender ? "attacker" : defender > attacker ? "defender" : "draw"
  return {
    ...state,
    phase: "done",
    winner,
    reason: "turn-limit",
    log: [...state.log, { kind: "turn-limit", turn: state.turn }],
  }
}

function act(state: BattleState, actor: Squad): BattleState {
  const enemies = state.squads.filter((squad) => squad.side !== actor.side && isAlive(squad))
  if (enemies.length === 0) {
    const winner = wipeWinner(state.squads) ?? "draw"
    return { ...state, phase: "done", winner, reason: "wipe" }
  }
  const target = pickTarget(actor, enemies)
  let squads = state.squads
  const log = [...state.log]
  let mover = actor
  const occupied = new Set(
    squads.filter((squad) => isAlive(squad) && squad.id !== actor.id).map((squad) => cellKey(squad.x, squad.y)),
  )
  let pos: Cell = { x: actor.x, y: actor.y }
  const start = { ...pos }
  let moved = false
  for (let stepIndex = 0; stepIndex < actor.move; stepIndex += 1) {
    if (chebyshev(pos, target) <= actor.range) break
    const next = stepCloser(pos, target, occupied)
    if (!next) break
    pos = next
    moved = true
  }
  if (moved) {
    mover = { ...mover, x: pos.x, y: pos.y }
    squads = replaceSquad(squads, mover.id, mover)
    log.push({ kind: "move", turn: state.turn, actorId: mover.id, targetId: target.id, from: start, to: pos })
  }

  let retaliated = state.retaliated
  if (chebyshev(pos, target) <= mover.range && mover.count > 0) {
    const attack = strike(squads, mover, target, false, state.turn)
    squads = attack.squads
    log.push(attack.event)
    const targetAfter = squads.find((squad) => squad.id === target.id)
    const actorAfter = squads.find((squad) => squad.id === mover.id)
    if (
      targetAfter &&
      actorAfter &&
      isAlive(targetAfter) &&
      isAlive(actorAfter) &&
      !retaliated.includes(targetAfter.id) &&
      targetAfter.count > 0 &&
      chebyshev(actorAfter, targetAfter) <= targetAfter.range
    ) {
      const back = strike(squads, targetAfter, actorAfter, true, state.turn)
      squads = back.squads
      log.push(back.event)
      retaliated = [...retaliated, targetAfter.id]
    }
  } else if (!moved) {
    log.push({ kind: "idle", turn: state.turn, actorId: mover.id, targetId: target.id })
  }

  const wiped = wipeWinner(squads)
  const advanced: BattleState = {
    ...state,
    squads,
    log,
    retaliated,
    cursor: state.cursor + 1,
  }
  if (wiped) return { ...advanced, phase: "done", winner: wiped, reason: "wipe" }
  if (advanced.cursor >= advanced.order.length && advanced.turn >= balance.TURN_LIMIT) {
    return finishByHp(advanced)
  }
  return advanced
}

export function step(state: BattleState): BattleState {
  if (state.phase === "done") return state
  let current = state
  for (let guard = 0; guard < 64; guard += 1) {
    if (current.cursor >= current.order.length) {
      if (current.turn >= balance.TURN_LIMIT) return finishByHp(current)
      const wiped = wipeWinner(current.squads)
      if (wiped) return { ...current, phase: "done", winner: wiped, reason: "wipe" }
      current = {
        ...current,
        turn: current.turn + 1,
        cursor: 0,
        retaliated: [],
        order: initiativeOrder(current.squads.filter(isAlive)).map((squad) => squad.id),
      }
      continue
    }
    const actor = current.squads.find((squad) => squad.id === current.order[current.cursor])
    if (!actor || !isAlive(actor)) {
      current = { ...current, cursor: current.cursor + 1 }
      continue
    }
    return act(current, actor)
  }
  return finishByHp(current)
}

export function runBattle(state: BattleState): BattleState {
  let current = state
  for (let guard = 0; guard < 10000 && current.phase === "ongoing"; guard += 1) {
    current = step(current)
  }
  return current
}

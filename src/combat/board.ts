import boardRules from "../../data/boardMove.json" with { type: "json" }
import catalog from "../../data/units.json" with { type: "json" }
import { calcDamage } from "./damage.ts"
import { canonicalUnitId } from "./counter.ts"
import { cellKey, inBounds } from "./grid.ts"
import type { Side, SkillRef, Squad, UnitType } from "./types.ts"

/** B2 手動棋盤戰棋（12×8）。規則真源：data/boardMove.json。 */

export interface BoardUnit {
  id: string
  side: Side
  type: UnitType
  atk: number
  def: number
  spd: number
  hp: number
  maxHp: number
  range: number
  move: number
  x: number
  y: number
  index: number
  generalAtk: number
  generalDef: number
  /** B6：武將主動技能（B2 預留的 castSkill 接口在此落地）。 */
  skills: SkillRef[]
  /** 技能冷卻剩餘回合，鍵為技能 id。 */
  cd: Record<string, number>
}

export type BoardReason = "not-your-turn" | "out-of-range" | "blocked" | "no-skill" | "cooling"

export type Command =
  | { type: "move"; unitId: string; to: { x: number; y: number } }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "wait"; unitId: string }
  | { type: "skill"; unitId: string; skillId: string; targetId: string }
  | { type: "toggleAuto"; enabled: boolean }

export interface BoardLog {
  turn: number
  side: Side
  unitId: string
  kind: "move" | "attack" | "wait" | "auto" | "skill" | "retreat"
  to?: { x: number; y: number }
  targetId?: string
  skillId?: string
  damage?: number
}

export interface BoardState {
  units: BoardUnit[]
  turn: number
  side: Side
  auto: boolean
  acted: string[]
  log: BoardLog[]
  over: Side | null
  /** B7 §2.3：主動撤退判負，戰後按 70% 回兵結算。 */
  retreated?: boolean
}

export interface ApplyResult {
  state: BoardState
  ok: boolean
  reason: BoardReason | null
}

export const MOVE_BY_TYPE: Record<UnitType, number> = boardRules.move as Record<UnitType, number>

const DIRS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

/** units.json 的兵種 spd（grid 舊名先映射到 v4.0 id）；神獸等未列兵種回 50。 */
export function speedOf(type: UnitType): number {
  const target = canonicalUnitId(type)
  const row = (catalog.units as ReadonlyArray<{ id: string; spd: number }>).find((unit) => unit.id === target)
  return row ? row.spd : 50
}

export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function unitFromSquad(squad: Squad, index: number): BoardUnit {
  return {
    id: squad.id,
    side: squad.side,
    type: squad.type,
    atk: squad.atk,
    def: squad.def,
    spd: speedOf(squad.type),
    hp: squad.hp,
    maxHp: squad.maxHp,
    range: squad.range,
    move: MOVE_BY_TYPE[squad.type] ?? 2,
    x: squad.x,
    y: squad.y,
    index,
    generalAtk: squad.general?.atk ?? 0,
    generalDef: squad.general?.def ?? 0,
    skills: squad.general?.skills ?? [],
    cd: {},
  }
}

export function createBoard(squads: readonly Squad[]): BoardState {
  const units = squads.map(unitFromSquad)
  const seen = new Set<string>()
  for (const unit of units) {
    if (!inBounds(unit.x, unit.y)) throw new Error(`out-of-bounds:${unit.id}`)
    const key = cellKey(unit.x, unit.y)
    if (seen.has(key)) throw new Error(`occupied:${key}`)
    seen.add(key)
  }
  return {
    units,
    turn: 1,
    side: "attacker",
    auto: false,
    acted: [],
    log: [],
    over: null,
  }
}

export function alive(units: readonly BoardUnit[], side?: Side): BoardUnit[] {
  return units.filter((unit) => unit.hp > 0 && (side == null || unit.side === side))
}

function clone(state: BoardState): BoardState {
  return {
    ...state,
    units: state.units.map((unit) => ({ ...unit, cd: { ...unit.cd } })),
    acted: [...state.acted],
    log: [...state.log],
  }
}

/** 四方向一格一步；被佔格不可穿越，可繞行。 */
export function reachable(state: BoardState, unitId: string): Map<string, number> {
  const unit = state.units.find((item) => item.id === unitId)
  const out = new Map<string, number>()
  if (!unit || unit.hp <= 0) return out
  const blocked = new Set<string>()
  for (const other of state.units) {
    if (other.hp > 0 && other.id !== unit.id) blocked.add(cellKey(other.x, other.y))
  }
  const start = cellKey(unit.x, unit.y)
  out.set(start, 0)
  const queue: Array<{ x: number; y: number; steps: number }> = [{ x: unit.x, y: unit.y, steps: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || current.steps >= unit.move) continue
    for (const dir of DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y, steps: current.steps + 1 }
      if (!inBounds(next.x, next.y)) continue
      const key = cellKey(next.x, next.y)
      if (blocked.has(key) || out.has(key)) continue
      out.set(key, next.steps)
      queue.push(next)
    }
  }
  return out
}

function order(side: Side, units: readonly BoardUnit[]): BoardUnit[] {
  return units
    .filter((unit) => unit.side === side && unit.hp > 0)
    .slice()
    .sort((a, b) => {
      if (a.spd !== b.spd) return b.spd - a.spd
      if (a.index !== b.index) return a.index - b.index
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

/** 同速攻方先行（錨點 E）：攻方全部行動完，才輪到守方。 */
export function initiative(state: BoardState): BoardUnit[] {
  return order(state.side, state.units)
}

export function activeUnitId(state: BoardState): string | null {
  const pending = initiative(state).find((unit) => !state.acted.includes(unit.id))
  return pending ? pending.id : null
}

function checkOver(state: BoardState): BoardState {
  const attackers = alive(state.units, "attacker").length
  const defenders = alive(state.units, "defender").length
  if (attackers === 0 && defenders === 0) return { ...state, over: "defender" }
  if (attackers === 0) return { ...state, over: "defender" }
  if (defenders === 0) return { ...state, over: "attacker" }
  return state
}

/** 一方全部行動完 → 換邊；兩邊都完 → 新回合（士氣／增益在 tickTurn 結算）。 */
function advance(state: BoardState): BoardState {
  const finished = initiative(state).every((unit) => state.acted.includes(unit.id))
  if (!finished) return state
  if (state.side === "attacker") return { ...state, side: "defender", acted: [] }
  const cooled = state.units.map((unit) => {
    const cd: Record<string, number> = {}
    for (const [key, value] of Object.entries(unit.cd)) cd[key] = Math.max(0, value - 1)
    return { ...unit, cd }
  })
  return { ...state, units: cooled, side: "attacker", acted: [], turn: state.turn + 1 }
}

function moraleFor(state: BoardState, side: Side): number {
  const base = catalog.formula.defaultMorale
  if (state.turn <= 5) return base
  const ratio = alive(state.units, side).length / Math.max(1, state.units.filter((unit) => unit.side === side).length)
  if (ratio <= 0.5) return base * 0.9
  return base
}

export function applyCommand(state: BoardState, command: Command): ApplyResult {
  if (command.type === "toggleAuto") {
    return { state: { ...state, auto: command.enabled, log: [...state.log, { turn: state.turn, side: state.side, unitId: "-", kind: "auto" }] }, ok: true, reason: null }
  }
  if (state.over) return { state, ok: false, reason: "blocked" }
  const unit = state.units.find((item) => item.id === command.unitId)
  if (!unit) return { state, ok: false, reason: "blocked" }
  if (unit.side !== state.side) return { state, ok: false, reason: "not-your-turn" }
  if (unit.hp <= 0) return { state, ok: false, reason: "blocked" }
  if (state.acted.includes(unit.id)) return { state, ok: false, reason: "blocked" }

  const next = clone(state)
  const moving = next.units.find((item) => item.id === unit.id)
  if (!moving) return { state, ok: false, reason: "blocked" }

  if (command.type === "move") {
    const reach = reachable(next, unit.id)
    const key = cellKey(command.to.x, command.to.y)
    const steps = reach.get(key)
    if (steps == null) return { state, ok: false, reason: "blocked" }
    moving.x = command.to.x
    moving.y = command.to.y
    next.acted.push(unit.id)
    next.log.push({ turn: next.turn, side: next.side, unitId: unit.id, kind: "move", to: command.to })
    return { state: checkOver(advance(next)), ok: true, reason: null }
  }

  if (command.type === "skill") {
    const skill = moving.skills.find((item) => item.id === command.skillId)
    if (!skill) return { state, ok: false, reason: "no-skill" }
    if ((moving.cd[skill.id] ?? 0) > 0) return { state, ok: false, reason: "cooling" }
    const target = next.units.find((item) => item.id === command.targetId)
    if (!target || target.hp <= 0 || target.side === unit.side) return { state, ok: false, reason: "blocked" }
    if (manhattan(unit, target) > skill.range) return { state, ok: false, reason: "out-of-range" }
    const raw = calcDamage(
      { id: unit.type, atk: unit.atk, def: unit.def, spd: unit.spd, range: unit.range, hp: unit.hp, side: unit.side },
      { id: target.type, atk: target.atk, def: target.def, spd: target.spd, range: target.range, hp: target.hp, side: target.side },
      { morale: moraleFor(next, unit.side) },
    )
    const damage = Math.min(target.hp, Math.round(raw * skill.power))
    target.hp = Math.max(0, target.hp - damage)
    moving.cd[skill.id] = skill.cooldown
    next.acted.push(unit.id)
    next.log.push({
      turn: next.turn,
      side: next.side,
      unitId: unit.id,
      kind: "skill",
      targetId: target.id,
      skillId: skill.id,
      damage,
    })
    return { state: checkOver(advance(next)), ok: true, reason: null }
  }

  if (command.type === "attack") {
    const target = next.units.find((item) => item.id === command.targetId)
    if (!target || target.hp <= 0 || target.side === unit.side) return { state, ok: false, reason: "blocked" }
    const dist = manhattan(unit, target)
    if (dist > unit.range) return { state, ok: false, reason: "out-of-range" }
    const damage = Math.min(
      target.hp,
      calcDamage(
        { id: unit.type, atk: unit.atk, def: unit.def, spd: unit.spd, range: unit.range, hp: unit.hp, side: unit.side },
        { id: target.type, atk: target.atk, def: target.def, spd: target.spd, range: target.range, hp: target.hp, side: target.side },
        { morale: moraleFor(next, unit.side) },
      ),
    )
    target.hp = Math.max(0, target.hp - damage)
    next.acted.push(unit.id)
    next.log.push({ turn: next.turn, side: next.side, unitId: unit.id, kind: "attack", targetId: target.id, damage })
    return { state: checkOver(advance(next)), ok: true, reason: null }
  }

  next.acted.push(unit.id)
  next.log.push({ turn: next.turn, side: next.side, unitId: unit.id, kind: "wait" })
  return { state: checkOver(advance(next)), ok: true, reason: null }
}

/** B7 §2.3 撤退：本回合持方認負，士氣與經驗按敗仗結算，但不算全滅。 */
export function retreat(state: BoardState): BoardState {
  if (state.over) return state
  const side = state.side
  const winner: Side = side === "attacker" ? "defender" : "attacker"
  return {
    ...state,
    over: winner,
    retreated: true,
    log: [...state.log, { turn: state.turn, side, unitId: "-", kind: "retreat" }],
  }
}

function nearestEnemy(unit: BoardUnit, enemies: readonly BoardUnit[]): BoardUnit | null {
  let best: BoardUnit | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const enemy of enemies) {
    const dist = manhattan(unit, enemy)
    if (dist < bestDist || (dist === bestDist && best && enemy.id < best.id)) {
      best = enemy
      bestDist = dist
    }
  }
  return best
}

/** 貪婪 AI：先打射程內血最低；否則向最近敵人走一格；冇敵人就待機。 */
export function autoCommands(state: BoardState): Command[] {
  const commands: Command[] = []
  let working = clone(state)
  const rounds = alive(working.units, working.side).length + 1
  for (let step = 0; step < rounds; step += 1) {
    const id = activeUnitId(working)
    if (!id) break
    const unit = working.units.find((item) => item.id === id)
    if (!unit) break
    const enemies = alive(working.units).filter((item) => item.side !== unit.side)
    if (enemies.length === 0) {
      const c: Command = { type: "wait", unitId: unit.id }
      commands.push(c)
      working = applyCommand(working, c).state
      continue
    }
    const usable = unit.skills.filter((skill) => (unit.cd[skill.id] ?? 0) === 0)
    if (usable.length > 0) {
      const skill = usable[0]
      if (skill) {
        const target = enemies
          .filter((enemy) => manhattan(unit, enemy) <= skill.range)
          .sort((a, b) => (a.hp !== b.hp ? a.hp - b.hp : a.id < b.id ? -1 : 1))[0]
        if (target) {
          const c: Command = { type: "skill", unitId: unit.id, skillId: skill.id, targetId: target.id }
          commands.push(c)
          working = applyCommand(working, c).state
          continue
        }
      }
    }
    const inRange = enemies.filter((enemy) => manhattan(unit, enemy) <= unit.range)
    if (inRange.length > 0) {
      inRange.sort((a, b) => (a.hp !== b.hp ? a.hp - b.hp : a.id < b.id ? -1 : 1))
      const target = inRange[0]
      if (target) {
        const c: Command = { type: "attack", unitId: unit.id, targetId: target.id }
        commands.push(c)
        working = applyCommand(working, c).state
        continue
      }
    }
    const target = nearestEnemy(unit, enemies)
    const reach = reachable(working, unit.id)
    let bestCell: { x: number; y: number } | null = null
    let bestDist = target ? manhattan(unit, target) : Number.POSITIVE_INFINITY
    for (const [key, steps] of reach) {
      if (steps === 0 || !target) continue
      const [cx, cy] = key.split(",").map(Number)
      if (cx == null || cy == null) continue
      const dist = manhattan({ x: cx, y: cy }, target)
      if (dist < bestDist) {
        bestDist = dist
        bestCell = { x: cx, y: cy }
      }
    }
    const c: Command = bestCell ? { type: "move", unitId: unit.id, to: bestCell } : { type: "wait", unitId: unit.id }
    commands.push(c)
    working = applyCommand(working, c).state
  }
  return commands
}

/** 託管模式：一回合（攻守兩邊）全自動，回傳命令序列供 UI／測試重放。 */
export function autoTurn(state: BoardState): { state: BoardState; commands: Command[] } {
  let working = clone(state)
  const commands: Command[] = []
  for (let guard = 0; guard < 4; guard += 1) {
    if (working.over) break
    const batch = autoCommands(working)
    if (batch.length === 0) break
    for (const command of batch) {
      const result = applyCommand(working, command)
      commands.push(command)
      working = result.state
    }
    if (working.side === "attacker" && working.acted.length === 0 && working.turn > state.turn) break
  }
  return { state: working, commands }
}

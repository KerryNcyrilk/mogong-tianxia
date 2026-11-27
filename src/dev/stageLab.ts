import catalog from "../../data/units.json" with { type: "json" }
import {
  applyCommand,
  alive,
  createBoard,
  initiative,
  reachable,
  type BoardState,
  type BoardUnit,
  type Command,
} from "../combat/board.ts"
import { SANDBOX_UNITS, type SandboxUnitRow } from "../sandbox/scenario.ts"
import type { Side, Squad, UnitType } from "../combat/types.ts"
import { DamageRingLog, explainDamage, type DamageLogEntry } from "./damageLog.ts"

/**
 * 12×8 戰棋沙盒（DEV-CONSOLE-V2A 第 2 項）。
 *
 * 全部是純函式：只接收／回傳 `BoardState`，不碰 DOM、不碰 `localStorage`。
 * 作弊開關以「指令後處理」方式實現，不改 `src/combat/**` 的戰鬥規則。
 */

export interface StageDraft {
  id: string
  label: string
  level: number
  note: string
  enemy: { type: UnitType; count: number; x: number; y: number }[]
}

/** S1–S3 讀 `data/stages.json`；S4–S10 是 `spec/CONTENT_EXPANSION_S4_S10.md` §3 的草案人數（未入 JSON）。 */
export const STAGES: readonly StageDraft[] = [
  { id: "s_yecun", label: "S1 野村", level: 1, note: "流寇盤踞，試刀第一戰", enemy: [
    { type: "blade", count: 18, x: 8, y: 3 },
    { type: "bow", count: 12, x: 10, y: 5 },
  ] },
  { id: "s_shankou", label: "S2 山口", level: 2, note: "扼守山道，弓騎混合", enemy: [
    { type: "halberd", count: 24, x: 7, y: 2 },
    { type: "bow", count: 16, x: 10, y: 3 },
    { type: "cavalry", count: 12, x: 9, y: 6 },
  ] },
  { id: "s_qinying", label: "S3 秦營", level: 3, note: "盾兵牆，先找神獸", enemy: [
    { type: "shield", count: 30, x: 7, y: 4 },
    { type: "halberd", count: 24, x: 7, y: 2 },
    { type: "bow", count: 18, x: 10, y: 3 },
    { type: "scholar", count: 12, x: 10, y: 6 },
  ] },
  { id: "s_jindu", label: "S4 津渡（草案）", level: 4, note: "補給渡口，無盾無神獸", enemy: [
    { type: "halberd", count: 32, x: 7, y: 2 },
    { type: "bow", count: 24, x: 10, y: 3 },
    { type: "blade", count: 26, x: 8, y: 4 },
    { type: "cavalry", count: 20, x: 9, y: 6 },
  ] },
  { id: "s_qiuxian", label: "S5 丘線（草案）", level: 5, note: "雙弓後排，考集火", enemy: [
    { type: "bow", count: 40, x: 10, y: 1 },
    { type: "bow", count: 28, x: 10, y: 5 },
    { type: "halberd", count: 30, x: 7, y: 3 },
    { type: "blade", count: 18, x: 8, y: 4 },
    { type: "cavalry", count: 18, x: 9, y: 6 },
  ] },
  { id: "s_feilei", label: "S6 廢壘（草案）", level: 6, note: "小盾牆，要帶神獸", enemy: [
    { type: "shield", count: 6, x: 7, y: 4 },
    { type: "halberd", count: 40, x: 7, y: 2 },
    { type: "bow", count: 36, x: 10, y: 2 },
    { type: "blade", count: 38, x: 8, y: 5 },
    { type: "scholar", count: 30, x: 10, y: 5 },
    { type: "cavalry", count: 20, x: 9, y: 6 },
  ] },
  { id: "s_changting", label: "S7 長亭（草案）", level: 7, note: "雙騎，騎先削學者", enemy: [
    { type: "cavalry", count: 40, x: 9, y: 6 },
    { type: "cavalry", count: 28, x: 9, y: 2 },
    { type: "bow", count: 36, x: 10, y: 4 },
    { type: "halberd", count: 46, x: 7, y: 3 },
    { type: "blade", count: 36, x: 8, y: 5 },
    { type: "scholar", count: 24, x: 10, y: 1 },
  ] },
  { id: "s_quliang", label: "S8 渠梁（草案）", level: 8, note: "神獸＋盾，長磨", enemy: [
    { type: "beast", count: 6, x: 8, y: 6 },
    { type: "scholar", count: 40, x: 10, y: 1 },
    { type: "bow", count: 70, x: 10, y: 4 },
    { type: "halberd", count: 60, x: 7, y: 3 },
    { type: "shield", count: 8, x: 7, y: 5 },
    { type: "cavalry", count: 70, x: 9, y: 2 },
  ] },
  { id: "s_qinbi", label: "S9 秦壁（草案）", level: 9, note: "城垣前大隊", enemy: [
    { type: "shield", count: 12, x: 7, y: 4 },
    { type: "halberd", count: 70, x: 7, y: 2 },
    { type: "bow", count: 60, x: 10, y: 3 },
    { type: "blade", count: 60, x: 8, y: 5 },
    { type: "cavalry", count: 50, x: 9, y: 6 },
    { type: "scholar", count: 50, x: 10, y: 1 },
  ] },
  { id: "s_xianyangdao", label: "S10 咸陽道（草案）", level: 10, note: "七隊終關，難在隊數", enemy: [
    { type: "beast", count: 6, x: 8, y: 6 },
    { type: "shield", count: 10, x: 7, y: 4 },
    { type: "cavalry", count: 100, x: 9, y: 2 },
    { type: "bow", count: 70, x: 10, y: 3 },
    { type: "halberd", count: 80, x: 7, y: 1 },
    { type: "scholar", count: 46, x: 10, y: 6 },
    { type: "blade", count: 42, x: 8, y: 5 },
  ] },
]

export const STAGE_IDS: readonly string[] = STAGES.map((row) => row.id)

/** 攻方固定三隊（與 B7 `stages.json` attacker 三格一致）。 */
const ATTACKER_DRAFT: readonly { type: UnitType; count: number; x: number; y: number }[] = [
  { type: "blade", count: 28, x: 1, y: 2 },
  { type: "cavalry", count: 24, x: 2, y: 4 },
  { type: "bow", count: 26, x: 1, y: 6 },
]

export const GRID_COLS = 12
export const GRID_ROWS = 8

function statsOf(type: UnitType): SandboxUnitRow {
  return SANDBOX_UNITS[type]
}

function buildSquad(draft: { type: UnitType; count: number; x: number; y: number }, side: Side, seq: number): Squad {
  const row = statsOf(draft.type)
  const hp = draft.count * row.hpPer
  return {
    id: `${side === "attacker" ? "mo" : "qin"}-${draft.type}-${seq}`,
    side,
    type: draft.type,
    atk: row.atk,
    def: row.def,
    count: draft.count,
    hp,
    maxHp: hp,
    hpPer: row.hpPer,
    range: row.range,
    move: row.move,
    x: draft.x,
    y: draft.y,
    seq,
    general: null,
  }
}

export function stageSquads(stageId: string): Squad[] {
  const stage = STAGES.find((item) => item.id === stageId) ?? STAGES[0]
  const attackers = ATTACKER_DRAFT.map((draft, index) => buildSquad(draft, "attacker", index + 1))
  const defenders = stage.enemy.map((draft, index) => buildSquad(draft, "defender", attackers.length + index + 1))
  return [...attackers, ...defenders]
}

/** 單挑棋盤（測試／日誌示範）：弓 26 人在 (2,2)，刀 18 人在 (5,2)，射程 3 內。 */
export function testDuelBoard(): BoardState {
  return createBoard([
    buildSquad({ type: "bow", count: 26, x: 2, y: 2 }, "attacker", 1),
    buildSquad({ type: "blade", count: 18, x: 5, y: 2 }, "defender", 2),
  ])
}

export function stageBoard(stageId: string): BoardState {
  return createBoard(stageSquads(stageId))
}

/** 沙盒擺盤：空格放兵；`count` 為人數，攻／防／射程／移動照沙盒表。 */
export function placeUnit(
  state: BoardState,
  draft: { side: Side; type: UnitType; count: number; x: number; y: number },
): BoardState {
  if (state.over) return state
  const occupied = state.units.some((unit) => unit.hp > 0 && unit.x === draft.x && unit.y === draft.y)
  if (occupied) return state
  const seq = state.units.reduce((max, unit) => Math.max(max, unit.index), 0) + 1
  const squad = buildSquad(draft, draft.side, seq)
  const board = createBoard([...state.units.map(toSquadShim), squad])
  return { ...state, units: board.units, acted: state.acted, log: state.log }
}

/** BoardUnit → Squad 的還原（只為重建棋盤用，數值不再重算）。 */
function toSquadShim(unit: BoardUnit): Squad {
  const hpPer = Math.max(1, Math.round(unit.maxHp / Math.max(1, Math.round(unit.hp / Math.max(1, unit.maxHp / 10)))))
  return {
    id: unit.id,
    side: unit.side,
    type: unit.type,
    atk: unit.atk,
    def: unit.def,
    count: Math.max(1, Math.round(unit.hp / hpPer)),
    hp: unit.hp,
    maxHp: unit.maxHp,
    hpPer,
    range: unit.range,
    move: unit.move,
    x: unit.x,
    y: unit.y,
    seq: unit.index,
    general: unit.generalAtk || unit.generalDef ? { id: "injected", name: "injected", atk: unit.generalAtk, def: unit.generalDef } : null,
  }
}

export function removeUnit(state: BoardState, unitId: string): BoardState {
  return {
    ...state,
    units: state.units.filter((unit) => unit.id !== unitId),
    acted: state.acted.filter((id) => id !== unitId),
  }
}

export function setUnitCount(state: BoardState, unitId: string, count: number): BoardState {
  const safe = Math.max(1, Math.min(2000, Math.round(count)))
  return {
    ...state,
    units: state.units.map((unit) => {
      if (unit.id !== unitId) return unit
      const hpPer = unit.maxHp / Math.max(1, Math.round(unit.hp / Math.max(1, unit.maxHp / 10)))
      const maxHp = safe * hpPer
      return { ...unit, hp: maxHp, maxHp }
    }),
  }
}

export interface CheatFlags {
  /** 我方不掉血。 */
  invincible: boolean
  /** 我方一擊必殺。 */
  oneShot: boolean
  /** 同一支部隊可重複行動（本輪不結束）。 */
  infiniteAction: boolean
  /** 敵軍不主動出手。 */
  freezeEnemy: boolean
}

export const CHEATS_OFF: CheatFlags = {
  invincible: false,
  oneShot: false,
  infiniteAction: false,
  freezeEnemy: false,
}

export const SPEEDS = [1, 2, 4, 8] as const
export type Speed = (typeof SPEEDS)[number]

/** 1×＝600ms 一步（與手動棋盤託管同速）；8×＝75ms。 */
export function tickMs(speed: Speed): number {
  return Math.max(75, Math.round(600 / speed))
}

/** 與 combat/board.ts 的 moraleFor 同義（該函式未 export，這裡按同規則重算，用於拆解日誌）。 */
function moraleFor(state: BoardState, side: Side): number {
  const base = catalog.formula.defaultMorale
  if (state.turn <= 5) return base
  const aliveCount = alive(state.units, side).length
  const total = Math.max(1, state.units.filter((unit) => unit.side === side).length)
  const ratio = aliveCount / total
  if (ratio <= 0.5) return base * 0.9
  return base
}

function isAttack(command: Command): boolean {
  return command.type === "attack" || command.type === "skill"
}

export interface SandboxApplyResult {
  state: BoardState
  ok: boolean
  reason: string | null
  /** 本次出手寫入環形日誌的拆解（非攻擊指令為 null）。 */
  entry: DamageLogEntry | null
  /** 作弊生效標記，方便 UI 顯示。 */
  cheatApplied: string[]
}

/**
 * 沙盒指令入口：先走原生 `applyCommand`，再按作弊開關後處理，
 * 並把傷害拆解寫入環形日誌（與戰鬥同一條公式）。
 */
export function sandboxCommand(
  state: BoardState,
  command: Command,
  cheats: CheatFlags,
  ring?: DamageRingLog,
): SandboxApplyResult {
  const before = state
  const result = applyCommand(state, command)
  if (!result.ok) return { state: result.state, ok: false, reason: result.reason, entry: null, cheatApplied: [] }

  let next = result.state
  const applied: string[] = []
  const logBefore = before.log.length
  const fresh = next.log.slice(logBefore)
  const hit = fresh.find((row) => row.damage != null && (row.side != null))

  let entry: DamageLogEntry | null = null
  if (isAttack(command) && hit && hit.damage != null) {
    const actor = before.units.find((unit) => unit.id === hit.unitId)
    const target = before.units.find((unit) => unit.id === hit.targetId)
    if (actor && target) {
      const breakdown = explainDamage({
        atk: actor.atk,
        def: target.def,
        attackerType: actor.type,
        defenderType: target.type,
        morale: moraleFor(before, actor.side),
        mode: "grid",
      })
      entry = ring
        ? ring.push({
            turn: before.turn,
            actorId: actor.id,
            targetId: target.id,
            attackerType: actor.type,
            defenderType: target.type,
            damage: hit.damage,
            engine: "grid",
            breakdown,
          })
        : {
            seq: 0,
            turn: before.turn,
            actorId: actor.id,
            targetId: target.id,
            attackerType: actor.type,
            defenderType: target.type,
            damage: hit.damage,
            engine: "grid",
            breakdown,
          }
    }
  }

  if (cheats.oneShot && isAttack(command) && hit?.targetId) {
    next = { ...next, units: next.units.map((unit) => (unit.id === hit.targetId ? { ...unit, hp: 0 } : unit)) }
    applied.push("一擊必殺")
  }
  if (cheats.invincible) {
    next = {
      ...next,
      units: next.units.map((unit) => (unit.side === "attacker" ? { ...unit, hp: unit.maxHp } : unit)),
    }
    applied.push("無敵")
  }
  if (cheats.infiniteAction && command.type !== "toggleAuto" && "unitId" in command && command.unitId) {
    next = { ...next, acted: next.acted.filter((id) => id !== command.unitId) }
    applied.push("無限行動力")
  }
  if (cheats.invincible || cheats.oneShot) {
    const moAlive = next.units.some((unit) => unit.side === "attacker" && unit.hp > 0)
    const qinAlive = next.units.some((unit) => unit.side === "defender" && unit.hp > 0)
    if (!qinAlive && moAlive) next = { ...next, over: "attacker" }
    if (!moAlive && qinAlive) next = { ...next, over: "defender" }
  }
  return { state: next, ok: true, reason: null, entry, cheatApplied: applied }
}

/** 強制結束本輪（無限行動力模式下用）：當前一方未動的部隊逐一待機，換邊即停。 */
export function endSide(state: BoardState): BoardState {
  const startSide = state.side
  let current = state
  for (let guard = 0; guard < 16 && !current.over; guard += 1) {
    if (current.side !== startSide) break
    const pending = initiative(current).find((unit) => !current.acted.includes(unit.id))
    if (!pending) break
    const result = applyCommand(current, { type: "wait", unitId: pending.id })
    if (!result.ok) break
    current = result.state
  }
  return current
}

/** 託管一步；`freezeEnemy` 時敵方直接跳過（模擬「敵軍凍結」）。 */
export function sandboxAutoStep(
  state: BoardState,
  cheats: CheatFlags,
  ring?: DamageRingLog,
): { state: BoardState; entry: DamageLogEntry | null } {
  if (state.over) return { state, entry: null }
  if (cheats.freezeEnemy && state.side === "defender") {
    return { state: endSide(state), entry: null }
  }
  const pending = initiative(state).find((unit) => !state.acted.includes(unit.id))
  if (!pending) return { state: endSide(state), entry: null }
  const enemies = state.units.filter((unit) => unit.side !== pending.side && unit.hp > 0)
  if (enemies.length === 0) return { state: { ...state, over: "attacker" }, entry: null }
  const target = enemies.reduce((best, unit) => {
    const dist = Math.abs(unit.x - pending.x) + Math.abs(unit.y - pending.y)
    const bestDist = Math.abs(best.x - pending.x) + Math.abs(best.y - pending.y)
    if (dist < bestDist) return unit
    if (dist === bestDist && (unit.y < best.y || (unit.y === best.y && unit.x < best.x))) return unit
    return best
  })
  const dist = Math.abs(target.x - pending.x) + Math.abs(target.y - pending.y)
  let command: Command =
    dist <= pending.range ? { type: "attack", unitId: pending.id, targetId: target.id } : { type: "wait", unitId: pending.id }
  if (dist > pending.range) {
    // 不在射程就向目標推進到最接近的可達格（四方向一格一步）
    let best: { x: number; y: number; dist: number } | null = null
    for (const key of reachable(state, pending.id).keys()) {
      const [x, y] = key.split(",").map((value) => Number(value))
      if (x === pending.x && y === pending.y) continue
      const nextDist = Math.abs(target.x - x) + Math.abs(target.y - y)
      if (nextDist >= dist) continue
      if (!best || nextDist < best.dist || (nextDist === best.dist && (y < best.y || (y === best.y && x < best.x)))) {
        best = { x, y, dist: nextDist }
      }
    }
    if (best) command = { type: "move", unitId: pending.id, to: { x: best.x, y: best.y } }
  }
  const applied = sandboxCommand(state, command, cheats, ring)
  return { state: applied.state, entry: applied.entry }
}

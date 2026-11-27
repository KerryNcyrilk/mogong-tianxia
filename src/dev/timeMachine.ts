import { INTERNAL_CONFIG } from "../internal/config.ts"
import type { Command } from "../combat/board.ts"
import { cellKey, inBounds } from "../combat/grid.ts"
import type { Side, UnitType } from "../combat/types.ts"
import { placeUnit, stageBoard } from "./stageLab.ts"
import type { BoardState } from "../combat/board.ts"

/**
 * 武將注入與時間機器（DEV-CONSOLE-V2A 第 4 項）。
 *
 * 純函式＋一個 10 步 Undo 的記憶體堆疊；快照是「棋盤狀態」而非存檔檔，
 * 壞檔生成器則直接針對真實 `persist.exportSave` 的 base64 格式做負面測試。
 */

export const SNAPSHOT_NAMES = ["opening", "m30", "qinShield", "maxed", "lowMorale"] as const
export type SnapshotName = (typeof SNAPSHOT_NAMES)[number]

export const SNAPSHOT_LABEL: Record<SnapshotName, string> = {
  opening: "開局",
  m30: "30 分鐘",
  qinShield: "秦營盾",
  maxed: "滿級武將",
  lowMorale: "低士氣",
}

export const UNDO_CAPACITY = 10
export const GENERAL_LEVEL_MIN = 1
export const GENERAL_LEVEL_MAX = 50

/** 武將等級 → 光環攻／防（猛將原型：攻 18、防 10；`generals.json` 每級 +3／+2）。 */
export function generalAura(level: number): { atk: number; def: number } {
  const safe = Math.max(GENERAL_LEVEL_MIN, Math.min(GENERAL_LEVEL_MAX, Math.round(level)))
  return { atk: 18 + 3 * (safe - 1), def: 10 + 2 * (safe - 1) }
}

export function injectGeneral(state: BoardState, unitId: string, level: number): BoardState {
  const aura = generalAura(level)
  return {
    ...state,
    units: state.units.map((unit) => (unit.id === unitId ? { ...unit, generalAtk: aura.atk, generalDef: aura.def, skills: [] } : unit)),
  }
}

export function clearGeneral(state: BoardState, unitId: string): BoardState {
  return {
    ...state,
    units: state.units.map((unit) => (unit.id === unitId ? { ...unit, generalAtk: 0, generalDef: 0 } : unit)),
  }
}

/** 七兵種注入：喺空格補一隊，人數照 `count`。 */
export function injectTroops(
  state: BoardState,
  draft: { side: Side; type: UnitType; count: number },
): { state: BoardState; placed: { x: number; y: number } | null } {
  const occupied = new Set(state.units.filter((unit) => unit.hp > 0).map((unit) => cellKey(unit.x, unit.y)))
  const startX = draft.side === "attacker" ? 0 : 6
  for (let y = 0; y < 8; y += 1) {
    for (let x = startX; x < 12; x += 1) {
      if (!inBounds(x, y) || occupied.has(cellKey(x, y))) continue
      const next = placeUnit(state, { ...draft, x, y })
      return { state: next, placed: { x, y } }
    }
  }
  return { state, placed: null }
}

function scaleHp(state: BoardState, side: Side, ratio: number): BoardState {
  return {
    ...state,
    units: state.units.map((unit) =>
      unit.side === side ? { ...unit, hp: Math.max(1, Math.round(unit.maxHp * ratio)) } : unit,
    ),
  }
}

export function createSnapshot(name: SnapshotName): BoardState {
  const base = stageBoard("s_yecun")
  if (name === "opening") return base
  if (name === "m30") return scaleHp(base, "attacker", 0.8)
  if (name === "qinShield") return stageBoard("s_qinying")
  if (name === "maxed") {
    let next = base
    for (const unit of base.units.filter((item) => item.side === "attacker")) {
      next = injectGeneral(next, unit.id, GENERAL_LEVEL_MAX)
    }
    return {
      ...next,
      units: next.units.map((unit) => (unit.side === "attacker" ? { ...unit, atk: unit.atk * 2, def: unit.def * 2 } : unit)),
    }
  }
  // 低士氣：攻方只剩一隊 30% 血，其餘歸零（士氣倍率 0.9 會生效）
  return {
    ...base,
    units: base.units.map((unit, index) => {
      if (unit.side !== "attacker") return unit
      return index === 0 ? { ...unit, hp: Math.max(1, Math.round(unit.maxHp * 0.3)) } : { ...unit, hp: 0 }
    }),
    turn: 6,
  }
}

/** 10 步 Undo：每步存一份淺拷貝快照，超過就丟最舊。 */
export class TimeMachine {
  private stack: BoardState[] = []
  private recorded = 0

  readonly capacity: number

  constructor(capacity: number = UNDO_CAPACITY) {
    this.capacity = capacity
  }

  record(state: BoardState): void {
    this.stack.push(snapshotOf(state))
    this.recorded += 1
    if (this.stack.length > this.capacity) this.stack.splice(0, this.stack.length - this.capacity)
  }

  undo(): BoardState | null {
    return this.stack.pop() ?? null
  }

  get depth(): number {
    return this.stack.length
  }

  get canUndo(): boolean {
    return this.stack.length > 0
  }

  get total(): number {
    return this.recorded
  }

  clear(): void {
    this.stack = []
  }
}

function snapshotOf(state: BoardState): BoardState {
  return {
    ...state,
    units: state.units.map((unit) => ({ ...unit, cd: { ...unit.cd } })),
    acted: [...state.acted],
    log: [...state.log],
  }
}

/** 以狀態重演指令：壞檔測試以外，亦用於驗證 Undo 回到同一局面。 */
export function replay(state: BoardState, commands: readonly Command[], apply: (s: BoardState, c: Command) => BoardState): BoardState {
  return commands.reduce((current, command) => apply(current, command), state)
}

export interface SaveValidation {
  ok: boolean
  errors: string[]
  summary: { resources: number; generals: number } | null
}

const RESOURCE_KEYS = INTERNAL_CONFIG.resources.map((row) => row.key)

/**
 * 存檔校驗：對 `persist.importSave` 的真實格式（base64 → {internal, roster}）逐層檢查，
 * 並補上遊戲原本不檢查的欄位（資源鍵齊全、武將陣列存在、schema 為 1）。
 */
export function validateSave(text: string): SaveValidation {
  const errors: string[] = []
  let raw = ""
  try {
    raw = decodeURIComponent(escape(atob(text.trim())))
  } catch {
    return { ok: false, errors: ["不是合法 base64"], summary: null }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, errors: ["JSON 解析失敗（壞檔）"], summary: null }
  }
  if (typeof parsed !== "object" || parsed == null) return { ok: false, errors: ["頂層不是物件"], summary: null }
  const payload = parsed as { internal?: { schema?: number; resources?: Record<string, unknown> }; roster?: { generals?: unknown[] } }
  if (!payload.internal) errors.push("缺 internal")
  if (!payload.roster) errors.push("缺 roster")
  if (payload.internal && payload.internal.schema !== 1) errors.push(`internal.schema=${String(payload.internal.schema)}（應為 1）`)
  const resources = payload.internal?.resources
  if (resources) {
    const missing = RESOURCE_KEYS.filter((key) => typeof resources[key] !== "number")
    if (missing.length > 0) errors.push(`資源鍵缺／非數字：${missing.join(",")}`)
    const negative = RESOURCE_KEYS.filter((key) => typeof resources[key] === "number" && (resources[key] as number) < 0)
    if (negative.length > 0) errors.push(`資源負值：${negative.join(",")}`)
  }
  const generals = payload.roster?.generals
  if (generals != null && !Array.isArray(generals)) errors.push("roster.generals 不是陣列")
  return {
    ok: errors.length === 0,
    errors,
    summary: {
      resources: resources ? Object.keys(resources).length : 0,
      generals: Array.isArray(generals) ? generals.length : 0,
    },
  }
}

/** 四類典型壞檔（皆為真實存檔格式的變體，方便貼入存檔面板測校驗）。 */
export function corruptSaves(): { label: string; text: string; expect: string }[] {
  const good = btoa(unescape(encodeURIComponent(JSON.stringify({ internal: { schema: 1 }, roster: { generals: [] }, at: 1 }))))
  const schema0 = btoa(unescape(encodeURIComponent(JSON.stringify({ internal: { schema: 0 }, roster: { generals: [] } }))))
  const brokenJson = btoa(unescape(encodeURIComponent(JSON.stringify({ internal: { schema: 1 }, roster: { generals: [] } }))) + "x")
  const negative = btoa(
    unescape(encodeURIComponent(JSON.stringify({ internal: { schema: 1, resources: { coin: -5 } }, roster: { generals: [] } }))),
  )
  return [
    { label: "純垃圾（非 base64）", text: "not-a-save-@@@", expect: "不是合法 base64" },
    { label: "JSON 尾部有雜字", text: brokenJson, expect: "JSON 解析失敗" },
    { label: "schema 寫錯", text: schema0, expect: "internal.schema" },
    { label: "資源負值", text: negative, expect: "資源負值" },
    { label: "對照組（合法最小檔）", text: good, expect: "應通過；resources 缺鍵會如實報" },
  ]
}

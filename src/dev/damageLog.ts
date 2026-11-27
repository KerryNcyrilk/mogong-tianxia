import catalog from "../../data/units.json" with { type: "json" }
import { balance } from "../combat/balance.ts"
import { counterMultiplier } from "../combat/counter.ts"
import type { General, UnitType } from "../combat/types.ts"

/**
 * 傷害公式透視環形日誌（DEV-CONSOLE-V2A 第 1 項）。
 *
 * 只讀 combat/damage.ts 同一條公式：`floor(atk' × 人數 × 克制 × 士氣 − def' × 人數)`，
 * 下界 clamp 到 `DMG_FLOOR × 人數`。這裡不參與戰鬥計算，只把每個乘子拆開記錄，
 * 方便開發者對數。純函式，不碰 DOM。
 */

/** 與 combat/damage.ts 一致的武將光環除數（規格 §2.1 寫死 /200）。 */
const AURA_DIVISOR = 200

export const DAMAGE_LOG_CAPACITY = 200

export function auraFactor(stat: number | undefined): number {
  if (stat == null) return 1
  return 1 + stat / AURA_DIVISOR
}

export interface DamageExplainInput {
  atk: number
  def: number
  /** 人數加權；棋盤引擎（B2）不乘人數，傳 1 或省略。 */
  count?: number
  attackerType: UnitType
  defenderType: UnitType
  attackerGeneral?: General | null
  defenderGeneral?: General | null
  morale?: number
  retaliation?: boolean
  /**
   * `grid`＝B2 手動棋盤（`combat/damage.calcDamage`，只乘克制與士氣，不乘人數、不讀武將光環）；
   * `squad`＝自動引擎（`combat/damage.calculateDamage`，乘人數與光環）。預設 `squad`。
   */
  mode?: "grid" | "squad"
}

export interface DamageBreakdown {
  /** 光環後的攻／防。 */
  atkPrime: number
  defPrime: number
  count: number
  /** 兵種克制倍率（反擊固定 1）。 */
  counter: number
  morale: number
  /** 攻方項：atkPrime × count × counter × morale。 */
  atkTerm: number
  /** 守方項：defPrime × count。 */
  defTerm: number
  /** 未 clamp 的差。 */
  raw: number
  /** 下界：DMG_FLOOR × count。 */
  floorMin: number
  final: number
  /** 是否被下界托住（0 傷害軟鎖的成因）。 */
  flooredByMin: boolean
}

/** 拆解一次傷害；`final` 與 combat/damage.ts calculateDamage 同值。 */
export function explainDamage(input: DamageExplainInput): DamageBreakdown {
  const mode: DamageEngine = input.mode ?? "squad"
  const atkPrime = mode === "grid" ? input.atk : input.atk * auraFactor(input.attackerGeneral?.atk)
  const defPrime = mode === "grid" ? input.def : input.def * auraFactor(input.defenderGeneral?.def)
  const counter = input.retaliation ? 1 : counterMultiplier(input.attackerType, input.defenderType, false)
  const morale = input.morale ?? 1
  const count = mode === "grid" ? 1 : (input.count ?? 1)
  const atkTerm = atkPrime * count * counter * morale
  const defTerm = defPrime * count
  const raw = atkTerm - defTerm
  const floorMin = mode === "grid" ? catalog.formula.minDamage : balance.DMG_FLOOR * count
  const final =
    mode === "grid" ? Math.max(floorMin, Math.floor(raw)) : Math.max(Math.max(raw, floorMin), 0)
  return {
    atkPrime,
    defPrime,
    count,
    counter,
    morale,
    atkTerm,
    defTerm,
    raw,
    floorMin,
    final,
    flooredByMin: raw < floorMin,
  }
}

/** 拆解結果同時標明是哪個引擎，避免把棋盤 0 傷害當成自動引擎的結論。 */
export type DamageEngine = "grid" | "squad"

export interface DamageLogEntry {
  seq: number
  turn: number
  actorId: string
  targetId: string
  attackerType: UnitType
  defenderType: UnitType
  damage: number
  engine: DamageEngine
  breakdown: DamageBreakdown
}

export interface DamageLogJson {
  schema: "damage-log.v1"
  capacity: number
  total: number
  entries: DamageLogEntry[]
}

/** 固定容量環形日誌：滿了蓋最舊一筆，UI 只讀最近 N 條。 */
export class DamageRingLog {
  private items: DamageLogEntry[] = []
  private seq = 0
  private pushed = 0

  readonly capacity: number

  constructor(capacity: number = DAMAGE_LOG_CAPACITY) {
    if (capacity < 1) throw new Error("damage ring capacity must be >= 1")
    this.capacity = capacity
  }

  push(entry: Omit<DamageLogEntry, "seq">): DamageLogEntry {
    this.seq += 1
    this.pushed += 1
    const full: DamageLogEntry = { ...entry, seq: this.seq }
    this.items.push(full)
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity)
    return full
  }

  /** 由舊到新；`latest(n)` 取最近 n 條（新在後）。 */
  list(): readonly DamageLogEntry[] {
    return this.items
  }

  latest(n: number): readonly DamageLogEntry[] {
    return n >= this.items.length ? this.items.slice() : this.items.slice(this.items.length - n)
  }

  clear(): void {
    this.items = []
  }

  get size(): number {
    return this.items.length
  }

  /** 累計寫入筆數（環形覆寫後仍可看出跑過幾多下）。 */
  get totalPushed(): number {
    return this.pushed
  }

  json(): DamageLogJson {
    return { schema: "damage-log.v1", capacity: this.capacity, total: this.pushed, entries: this.items.slice() }
  }
}

import { createBattle, sideHp, step, type BattleState } from "../combat/battle.ts"
import type { Squad } from "../combat/types.ts"
import { createScenario } from "../sandbox/scenario.ts"

export interface SimGame {
  index: number
  seed: number
  turns: number
  winner: string
  moHp: number
  qinHp: number
  moLossRate: number
  qinLossRate: number
}

export interface SimReport {
  schema: "sim-report.v1"
  createdAt: string
  config: { games: number; scenario: string; engine: string; seed: number; jitter: number }
  games: SimGame[]
  winRate: { mo: number; qin: number; draw: number }
  avgTurns: number
  lossRate: { mo: number; qin: number }
  /** 場間離散度（標準差）：jitter > 0 才有意義。 */
  stdDev: { turns: number; moLossRate: number; qinLossRate: number }
  deterministic: boolean
}

/** 默認開局擾動（Gemini 20261127-1309 拍板 0.08：日常平衡驗收用溫和浮動）。 */
export const DEFAULT_JITTER = 0.08

export interface SimOptions {
  /** 起始種子；同 seed＋同 jitter＝完全可重現。 */
  seed?: number
  /** 開局擾動幅度（0–0.3，例如 0.08＝士氣／兵力 ±8%）；0＝完全確定性。 */
  jitter?: number
}

/** mulberry32：細、快、可重現的偽隨機。 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.round(Math.sqrt(variance) * 100) / 100
}

const MAX_STEPS = 400

function runOne(squads: readonly Squad[], index: number, seed: number, jitter: number): SimGame {
  const random = mulberry32(seed)
  const jittered: Squad[] = jitter
    ? squads.map((item) => {
        const factor = 1 + (random() * 2 - 1) * jitter
        return { ...item, atk: Math.max(1, Math.round(item.atk * factor)), def: Math.max(1, Math.round(item.def * factor)) }
      })
    : (squads as Squad[])
  const moMax = sideHp(jittered, "attacker")
  const qinMax = sideHp(jittered, "defender")
  let state: BattleState = createBattle(jittered)
  let guard = 0
  while (state.phase !== "done" && guard < MAX_STEPS) {
    state = step(state)
    guard += 1
  }
  const moHp = sideHp(state.squads, "attacker")
  const qinHp = sideHp(state.squads, "defender")
  return {
    index,
    seed,
    turns: state.turn,
    winner: state.winner ?? "draw",
    moHp,
    qinHp,
    moLossRate: moMax ? Math.round(((moMax - moHp) / moMax) * 10000) / 100 : 0,
    qinLossRate: qinMax ? Math.round(((qinMax - qinHp) / qinMax) * 10000) / 100 : 0,
  }
}

/** 同配置連跑 N 場，彙總勝率／平均回合／戰損率／場間標準差。純函數、可單測。 */
export function runSimulation(games = 10, options: SimOptions = {}): SimReport {
  const squads = createScenario()
  const baseSeed = options.seed ?? 20261127
  const jitter = Math.max(0, Math.min(0.3, options.jitter ?? DEFAULT_JITTER))
  const rows: SimGame[] = []
  for (let index = 0; index < Math.max(1, Math.min(200, games)); index += 1) {
    rows.push(runOne(squads, index, baseSeed + index * 7, jitter))
  }
  const moWins = rows.filter((row) => row.winner === "attacker").length
  const qinWins = rows.filter((row) => row.winner === "defender").length
  const draws = rows.length - moWins - qinWins
  const avgTurns = rows.reduce((sum, row) => sum + row.turns, 0) / rows.length
  const moLoss = rows.reduce((sum, row) => sum + row.moLossRate, 0) / rows.length
  const qinLoss = rows.reduce((sum, row) => sum + row.qinLossRate, 0) / rows.length
  return {
    schema: "sim-report.v1",
    createdAt: new Date().toISOString(),
    config: { games: rows.length, scenario: "sandbox/default-12x8", engine: "combat/battle.auto", seed: baseSeed, jitter },
    games: rows,
    winRate: {
      mo: Math.round((moWins / rows.length) * 1000) / 10,
      qin: Math.round((qinWins / rows.length) * 1000) / 10,
      draw: Math.round((draws / rows.length) * 1000) / 10,
    },
    avgTurns: Math.round(avgTurns * 10) / 10,
    lossRate: { mo: Math.round(moLoss * 10) / 10, qin: Math.round(qinLoss * 10) / 10 },
    stdDev: {
      turns: stdDev(rows.map((row) => row.turns), avgTurns),
      moLossRate: stdDev(rows.map((row) => row.moLossRate), moLoss),
      qinLossRate: stdDev(rows.map((row) => row.qinLossRate), qinLoss),
    },
    deterministic: jitter === 0,
  }
}

export function reportJson(report: SimReport): string {
  return JSON.stringify(report, null, 2)
}

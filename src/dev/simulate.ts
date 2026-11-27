import { createBattle, sideHp, step, type BattleState } from "../combat/battle.ts"
import type { Squad } from "../combat/types.ts"
import { createScenario } from "../sandbox/scenario.ts"

export interface SimGame {
  index: number
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
  config: { games: number; scenario: string; engine: string }
  games: SimGame[]
  winRate: { mo: number; qin: number; draw: number }
  avgTurns: number
  lossRate: { mo: number; qin: number }
}

const MAX_STEPS = 400

function runOne(squads: readonly Squad[], index: number): SimGame {
  const start = squads.map((item) => ({ id: item.id, side: item.side, hp: item.hp }))
  const moMax = sideHp(squads, "attacker")
  const qinMax = sideHp(squads, "defender")
  let state: BattleState = createBattle(squads)
  let guard = 0
  while (state.phase !== "done" && guard < MAX_STEPS) {
    state = step(state)
    guard += 1
  }
  const moHp = sideHp(state.squads, "attacker")
  const qinHp = sideHp(state.squads, "defender")
  void start
  return {
    index,
    turns: state.turn,
    winner: state.winner ?? "draw",
    moHp,
    qinHp,
    moLossRate: moMax ? Math.round(((moMax - moHp) / moMax) * 10000) / 100 : 0,
    qinLossRate: qinMax ? Math.round(((qinMax - qinHp) / qinMax) * 10000) / 100 : 0,
  }
}

/** 同配置連跑 N 場，彙總勝率／平均回合／戰損率。純函數、可單測。 */
export function runSimulation(games = 10): SimReport {
  const squads = createScenario()
  const rows: SimGame[] = []
  for (let index = 0; index < Math.max(1, Math.min(200, games)); index += 1) {
    rows.push(runOne(squads, index))
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
    config: { games: rows.length, scenario: "sandbox/default-12x8", engine: "combat/battle.auto" },
    games: rows,
    winRate: {
      mo: Math.round((moWins / rows.length) * 1000) / 10,
      qin: Math.round((qinWins / rows.length) * 1000) / 10,
      draw: Math.round((draws / rows.length) * 1000) / 10,
    },
    avgTurns: Math.round(avgTurns * 10) / 10,
    lossRate: { mo: Math.round(moLoss * 10) / 10, qin: Math.round(qinLoss * 10) / 10 },
  }
}

export function reportJson(report: SimReport): string {
  return JSON.stringify(report, null, 2)
}

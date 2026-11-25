import type { UnitType } from "../combat/types.ts"

/** B7 可玩 Demo 閉環的唯一資料契約：data/stages.json。 */

export interface EnemyDraft {
  type: UnitType
  count: number
  x: number
  y: number
}

export interface Stage {
  id: string
  name: string
  level: number
  note: string
  enemy: EnemyDraft[]
}

export interface SettleRules {
  winExpPerEnemy: number
  winCoinPerEnemy: number
  loseExpPerEnemy: number
  woundPctOnLose: number
  retreatKeepPct: number
  moraleWin: number
  moraleLose: number
}

export interface StageFile {
  schemaVersion: string
  source: string
  grid: { cols: number; rows: number }
  attacker: { positions: { x: number; y: number }[] }
  stages: Stage[]
  settle: SettleRules
}

export interface DeployedSlot {
  slotIndex: number
  generalId: string
  unit: string
  count: number
  squadId: string
  hpPer: number
}

export type ExpeditionReason = "empty-formation" | "unknown-unit" | "unknown-stage"

export type SettleOutcome = "win" | "lose" | "retreat"

export interface SettleReport {
  outcome: SettleOutcome
  enemyDeployed: number
  enemyKilled: number
  expPerGeneral: number
  levels: { generalId: string; name: string; from: number; to: number }[]
  lootCoin: number
  returned: number
  lost: number
  moraleFrom: number
  moraleTo: number
}

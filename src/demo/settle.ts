import type { BoardState, BoardUnit } from "../combat/board.ts"
import { SANDBOX_UNITS } from "../sandbox/scenario.ts"
import type { GeneralConfig, RosterState } from "../general/types.ts"
import type { InternalConfig, InternalState } from "../internal/types.ts"
import { EMPTY_SLOT, gainExp } from "../general/engine.ts"
import { capOf } from "../internal/engine.ts"
import { overridesIdle, winExpPerEnemyOf } from "../dev/devOverrides.ts"
import type { DeployedSlot, SettleOutcome, SettleReport, StageFile } from "./types.ts"
import type { Stage } from "./types.ts"

/** 存活數＝hp／每兵 hp，四捨五入後夾在 0..出戰數。 */
export function survivorsOf(unit: BoardUnit, deployed: readonly DeployedSlot[], hpPer: number): number {
  const slot = deployed.find((entry) => entry.squadId === unit.id)
  const cap = slot ? slot.count : Math.max(1, Math.round(unit.maxHp / Math.max(1, hpPer)))
  if (unit.hp <= 0) return 0
  return Math.max(0, Math.min(cap, Math.round(unit.hp / Math.max(1, hpPer))))
}

export function outcomeOf(board: BoardState): SettleOutcome {
  if (board.retreated) return "retreat"
  return board.over === "attacker" ? "win" : "lose"
}

export function settleBattle(input: {
  board: BoardState
  roster: RosterState
  internal: InternalState
  config: GeneralConfig
  internalConfig: InternalConfig
  stage: Stage
  file: StageFile
  deployed: readonly DeployedSlot[]
}): { roster: RosterState; internal: InternalState; report: SettleReport } {
  const { board, roster, internal, config, internalConfig, stage, file, deployed } = input
  const rules = file.settle
  const outcome = outcomeOf(board)

  const enemyUnits = board.units.filter((unit) => unit.side === "defender")
  const enemyDeployed = stage.enemy.reduce((total, draft) => total + draft.count, 0)
  let enemyKilled = 0
  for (const unit of enemyUnits) {
    const hpPer = Math.max(1, SANDBOX_UNITS[unit.type].hpPer)
    const count = Math.max(1, Math.round(unit.maxHp / hpPer))
    const alive = unit.hp <= 0 ? 0 : Math.min(count, Math.round(unit.hp / hpPer))
    enemyKilled += count - alive
  }

  const winPer = overridesIdle() ? rules.winExpPerEnemy : winExpPerEnemyOf(rules.winExpPerEnemy)
  const expTotal = Math.floor(outcome === "win" ? enemyDeployed * winPer : enemyKilled * rules.loseExpPerEnemy)
  const lootCoin = outcome === "win" ? Math.floor(enemyDeployed * rules.winCoinPerEnemy) : 0

  const generalIds: string[] = []
  for (const slot of deployed) if (!generalIds.includes(slot.generalId)) generalIds.push(slot.generalId)
  const share = generalIds.length > 0 ? Math.floor(expTotal / generalIds.length) : 0

  let nextRoster: RosterState = roster
  const levels: SettleReport["levels"] = []
  generalIds.forEach((id, index) => {
    const amount = share + (index === 0 ? expTotal - share * generalIds.length : 0)
    const before = nextRoster.generals.find((item) => item.id === id)
    const grown = gainExp(nextRoster, id, amount, config)
    nextRoster = grown.state
    const after = nextRoster.generals.find((item) => item.id === id)
    levels.push({
      generalId: id,
      name: after?.name ?? id,
      from: before?.level ?? 1,
      to: after?.level ?? (before?.level ?? 1),
    })
  })

  const keepPct = outcome === "win" ? 1 : outcome === "retreat" ? rules.retreatKeepPct : rules.woundPctOnLose
  const troops: Record<string, number> = { ...nextRoster.troops }
  let returned = 0
  let lost = 0
  for (const slot of deployed) {
    const unit = board.units.find((item) => item.id === slot.squadId)
    const survivors = unit ? survivorsOf(unit, deployed, slot.hpPer) : 0
    const kept = Math.max(survivors, Math.floor(slot.count * keepPct))
    const back = Math.min(slot.count, kept)
    troops[slot.unit] = (troops[slot.unit] ?? 0) + back
    returned += back
    lost += slot.count - back
  }

  nextRoster = {
    ...nextRoster,
    troops,
    formation: nextRoster.formation.map(() => ({ ...EMPTY_SLOT })),
    clock: internal.clock,
  }

  const moraleFrom = internal.morale
  const moraleTo = Math.round(
    Math.max(
      internalConfig.morale.min,
      Math.min(internalConfig.morale.max, moraleFrom + (outcome === "win" ? rules.moraleWin : rules.moraleLose)),
    ),
  )
  const coinDef = internalConfig.resources.find((def) => def.key === "coin")
  const coinCap = coinDef ? capOf(coinDef) : Number.POSITIVE_INFINITY
  const nextInternal: InternalState = {
    ...internal,
    resources: { ...internal.resources, coin: Math.min(coinCap, internal.resources.coin + lootCoin) },
    morale: moraleTo,
    eventLog: [
      ...internal.eventLog,
      {
        at: internal.clock,
        id: "battle",
        label: `${stage.name} ${outcome === "win" ? "大勝" : outcome === "retreat" ? "撤退" : "敗退"}　殲敵 ${enemyKilled}　回兵 ${returned}`,
      },
    ].slice(-50),
  }

  return {
    roster: nextRoster,
    internal: nextInternal,
    report: {
      outcome,
      enemyDeployed,
      enemyKilled,
      expPerGeneral: share,
      levels,
      lootCoin,
      returned,
      lost,
      moraleFrom,
      moraleTo,
    },
  }
}

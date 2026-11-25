import type { GeneralConfig, RosterState } from "../general/types.ts"
import type { InternalConfig, InternalState } from "../internal/types.ts"
import { capOf } from "../internal/engine.ts"

/**
 * B7 §2.1 徵兵：每 100 兵＝刀幣 300＋糧食 120＋人口 1。
 * 拒絕理由固定三值：no-resource／pop-cap／unknown-unit。
 * 人口同時是資源與上限來源；單一兵種上限＝人口上限 × 4（B7 v0.2 §6.2 記為本批拍板；起始七行最高 1200，須低於此上限）。
 */
export const RECRUIT_BATCH = 100
export const RECRUIT_COST = { coin: 300, food: 120, pop: 1 } as const
export const TROOP_CAP_PER_POP = 4

export function troopCapOf(config: InternalConfig): number {
  const popDef = config.resources.find((def) => def.key === "pop")
  const popCap = popDef ? capOf(popDef) : Number.POSITIVE_INFINITY
  return Number.isFinite(popCap) ? Math.floor(popCap * TROOP_CAP_PER_POP) : Number.POSITIVE_INFINITY
}

export function recruitTroops(
  roster: RosterState,
  internal: InternalState,
  config: GeneralConfig,
  internalConfig: InternalConfig,
  unit: string,
  amount: number,
): {
  roster: RosterState
  internal: InternalState
  ok: boolean
  reason?: "no-resource" | "pop-cap" | "unknown-unit"
  cost?: { coin: number; food: number; pop: number }
  added?: number
} {
  if (!config.troops.some((row) => row.id === unit)) return { roster, internal, ok: false, reason: "unknown-unit" }
  const batches = Math.max(1, Math.floor(amount / RECRUIT_BATCH))
  const added = batches * RECRUIT_BATCH
  const cost = { coin: RECRUIT_COST.coin * batches, food: RECRUIT_COST.food * batches, pop: RECRUIT_COST.pop * batches }

  const current = Math.floor(roster.troops[unit] ?? 0)
  if (current + added > troopCapOf(internalConfig)) return { roster, internal, ok: false, reason: "pop-cap", cost }
  if (internal.resources.pop < cost.pop) return { roster, internal, ok: false, reason: "pop-cap", cost }
  if (internal.resources.coin < cost.coin || internal.resources.food < cost.food) {
    return { roster, internal, ok: false, reason: "no-resource", cost }
  }

  return {
    roster: { ...roster, troops: { ...roster.troops, [unit]: current + added } },
    internal: {
      ...internal,
      resources: {
        ...internal.resources,
        coin: internal.resources.coin - cost.coin,
        food: internal.resources.food - cost.food,
        pop: internal.resources.pop - cost.pop,
      },
    },
    ok: true,
    cost,
    added,
  }
}

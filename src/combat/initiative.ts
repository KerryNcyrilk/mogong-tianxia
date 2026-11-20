import { spdOf } from "./catalog.ts"
import type { UnitType } from "./types.ts"

/** Speeds come from data/units.json, which records the v3.1 §3 table. */
export const SPEED: Record<UnitType, number> = {
  cavalry: spdOf("cavalry"),
  blade: spdOf("blade"),
  beast: spdOf("beast"),
  bow: spdOf("bow"),
  scholar: spdOf("scholar"),
  halberd: spdOf("halberd"),
  shield: spdOf("shield"),
}

/** Lower rank acts first when speed ties. This is the locked listing order. */
export const TIE_RANK: Record<UnitType, number> = {
  cavalry: 0,
  blade: 1,
  beast: 2,
  bow: 3,
  scholar: 4,
  halberd: 5,
  shield: 6,
}

export const UNIT_LABEL: Record<UnitType, string> = {
  cavalry: "騎",
  blade: "刀",
  beast: "神獸",
  bow: "弓",
  scholar: "學者",
  halberd: "戟",
  shield: "盾",
}

export interface InitiativeUnit {
  type: UnitType
  seq: number
}

export function initiativeOrder<T extends InitiativeUnit>(units: readonly T[]): T[] {
  return units.slice().sort((a, b) => {
    const bySpeed = SPEED[b.type] - SPEED[a.type]
    if (bySpeed !== 0) return bySpeed
    const byRank = TIE_RANK[a.type] - TIE_RANK[b.type]
    if (byRank !== 0) return byRank
    return a.seq - b.seq
  })
}

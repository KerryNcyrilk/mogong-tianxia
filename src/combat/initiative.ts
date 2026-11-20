import type { UnitType } from "./types.ts"

/**
 * Grid-slice type speeds for the sandbox roster (v3.1 §3).
 * v4.0 battles do not read this table; they sort each unit's own spd.
 */
export const SPEED: Record<UnitType, number> = {
  cavalry: 7,
  blade: 6,
  beast: 6,
  bow: 4,
  scholar: 4,
  halberd: 4,
  shield: 3,
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

import type { General, Squad, UnitType } from "../combat/types.ts"

export interface SandboxUnitRow {
  atk: number
  def: number
  hpPer: number
  range: number
  move: number
}

/**
 * Sandbox roster numbers. These are the pre-v4 lineup the grid view already
 * shipped with. The official table is data/units.json and is not read here.
 */
export const SANDBOX_UNITS: Record<UnitType, SandboxUnitRow> = {
  cavalry: { atk: 14, def: 8, hpPer: 12, range: 1, move: 3 },
  blade: { atk: 10, def: 8, hpPer: 10, range: 1, move: 2 },
  beast: { atk: 16, def: 12, hpPer: 40, range: 1, move: 2 },
  bow: { atk: 11, def: 6, hpPer: 8, range: 3, move: 2 },
  scholar: { atk: 12, def: 5, hpPer: 7, range: 5, move: 2 },
  halberd: { atk: 10, def: 9, hpPer: 12, range: 1, move: 2 },
  shield: { atk: 6, def: 14, hpPer: 16, range: 1, move: 1 },
}

interface Draft {
  id: string
  side: Squad["side"]
  type: UnitType
  count: number
  x: number
  y: number
  seq: number
  general?: General
}

function squad(draft: Draft): Squad {
  const row = SANDBOX_UNITS[draft.type]
  const hp = draft.count * row.hpPer
  return {
    id: draft.id,
    side: draft.side,
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
    seq: draft.seq,
    general: draft.general ?? null,
  }
}

const moDi: General = {
  id: "mo-di",
  name: "墨翟",
  atk: 80,
  def: 60,
}

export function createScenario(): Squad[] {
  return [
    squad({ id: "mo-cavalry", side: "attacker", type: "cavalry", count: 24, x: 1, y: 2, seq: 1 }),
    squad({
      id: "mo-blade",
      side: "attacker",
      type: "blade",
      count: 28,
      x: 2,
      y: 4,
      seq: 2,
      general: moDi,
    }),
    squad({ id: "mo-bow", side: "attacker", type: "bow", count: 26, x: 0, y: 6, seq: 3 }),
    squad({ id: "mo-shield", side: "attacker", type: "shield", count: 30, x: 2, y: 6, seq: 4 }),
    squad({ id: "qin-halberd", side: "defender", type: "halberd", count: 28, x: 4, y: 4, seq: 5 }),
    squad({ id: "qin-scholar", side: "defender", type: "scholar", count: 22, x: 6, y: 2, seq: 6 }),
    squad({ id: "qin-beast", side: "defender", type: "beast", count: 8, x: 5, y: 6, seq: 7 }),
    squad({ id: "qin-bow", side: "defender", type: "bow", count: 24, x: 7, y: 5, seq: 8 }),
  ]
}

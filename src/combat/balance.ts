import raw from "../../balance.json" with { type: "json" }

export interface Balance {
  HERO_COEF: number
  COUNTER_MULT: number
  COUNTER_WEAK: number
  DMG_FLOOR: number
  TURN_LIMIT: number
}

export const balance: Balance = raw

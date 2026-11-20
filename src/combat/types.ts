export type Side = "attacker" | "defender"

export type UnitType =
  | "cavalry"
  | "blade"
  | "beast"
  | "bow"
  | "scholar"
  | "halberd"
  | "shield"

export interface General {
  id: string
  name: string
  atk: number
  def: number
}

export interface Squad {
  id: string
  side: Side
  type: UnitType
  atk: number
  def: number
  count: number
  hp: number
  maxHp: number
  hpPer: number
  range: number
  move: number
  x: number
  y: number
  seq: number
  general: General | null
}

export interface DamageInput {
  atk: number
  def: number
  count: number
  attackerType: UnitType
  defenderType: UnitType
  attackerGeneral: General | null
  defenderGeneral: General | null
  retaliation: boolean
}

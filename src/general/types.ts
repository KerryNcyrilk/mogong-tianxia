export type EquipSlot = "weapon" | "armor" | "horse"

export type SkillKind = "active" | "passive"

export interface SkillDef {
  id: string
  name: string
  kind: SkillKind
  range?: number
  power?: number
  cooldown?: number
  defPct?: number
  troopPct?: number
  desc: string
}

export interface EquipItem {
  id: string
  name: string
  slot: EquipSlot
  atk: number
  def: number
  lead: number
}

export interface Archetype {
  id: string
  label: string
  atk: number
  def: number
  lead: number
}

export interface PoolEntry {
  id: string
  name: string
  archetype: string
  skills: string[]
  leitmotif: string
}

export interface GeneralConfig {
  schemaVersion: string
  level: { max: number; expBase: number; expGrow: number; perLevel: { atk: number; def: number; lead: number } }
  lead: { capBase: number; capPer: number }
  archetypes: Archetype[]
  tavern: { slots: number; refreshHours: number; cost: { coin: number; jade: number } }
  pool: PoolEntry[]
  equipment: { slots: EquipSlot[]; items: EquipItem[] }
  skills: SkillDef[]
  troops: { id: string; name: string; start: number }[]
  formation: { slots: number; minCount: number }
}

export interface GeneralRecord {
  id: string
  name: string
  archetype: string
  level: number
  exp: number
  equip: Record<EquipSlot, string | null>
  skills: string[]
  recruitedAt: number
}

export interface FormationSlot {
  generalId: string | null
  unit: string | null
  count: number
}

export interface RosterState {
  schema: number
  generals: GeneralRecord[]
  activeId: string | null
  tavern: { day: string; offers: string[] }
  troops: Record<string, number>
  formation: FormationSlot[]
  clock: number
}

export interface GeneralStats {
  atk: number
  def: number
  lead: number
  troopCap: number
}

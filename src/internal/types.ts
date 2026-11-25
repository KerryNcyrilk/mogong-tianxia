export type ResourceKey = "pop" | "jade" | "coin" | "food" | "wood" | "iron" | "stone"

export interface ResourceDef {
  id: string
  key: ResourceKey
  name: string
  rate: number
  cap: { base: number; unit: number; levels: number } | null
  taxable: boolean
}

export interface TaxRate {
  id: "low" | "mid" | "high"
  label: string
  tax: number
  moralePerHour: number
}

export interface BuildingDef {
  kind: string
  label: string
  seconds: number
  cost: Partial<Record<ResourceKey, number>>
}

export interface EventDef {
  id: string
  label: string
  perHour: number
  effect: Record<string, number>
}

export interface InternalConfig {
  schema: number
  tickSeconds: number
  morale: { start: number; min: number; max: number; lowPenalty: number; highBonus: number; lowGate: number; highGate: number }
  tax: { rates: TaxRate[]; default: TaxRate["id"] }
  newbieProtectHours: number
  resources: ResourceDef[]
  start: Record<ResourceKey, number>
  queue: { slots: number }
  buildings: BuildingDef[]
  refundPct: number
  events: EventDef[]
}

export type SlotStatus = "building" | "queued" | "done"

export interface QueueSlot {
  id: string
  kind: string
  label: string
  levelAtStart: number
  seconds: number
  remaining: number
  elapsed: number
  status: SlotStatus
  paid: Partial<Record<ResourceKey, number>>
}

export interface InternalState {
  schema: number
  createdAt: number
  clock: number
  resources: Record<ResourceKey, number>
  levels: Record<string, number>
  morale: number
  tax: TaxRate["id"]
  slots: QueueSlot[]
  rng: number
  seed: number
  eventLog: { at: number; id: string; label: string }[]
}

export interface TickResult {
  state: InternalState
  events: { id: string; label: string; at: number }[]
  blocked: ResourceKey[]
}

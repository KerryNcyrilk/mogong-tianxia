import type {
  BuildingDef,
  EventDef,
  InternalConfig,
  InternalState,
  QueueSlot,
  ResourceKey,
  TaxRate,
} from "./types.ts"

const SAVE_KEY = "mogong.internal.v1"
const SAVE_VERSION = 1

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nextRandom(source: number): { value: number; seed: number } {
  const seed = (source * 1103515245 + 12345) % 2147483648
  return { value: seed / 2147483648, seed }
}

export function capOf(def: InternalConfig["resources"][number]): number {
  if (!def.cap) return Number.POSITIVE_INFINITY
  return def.cap.base + def.cap.unit * def.cap.levels
}

export function moraleMultiplier(state: InternalState, config: InternalConfig): number {
  if (state.morale < config.morale.lowGate) return config.morale.lowPenalty
  if (state.morale >= config.morale.highGate) return config.morale.highBonus
  return 1
}

export function taxRate(state: InternalState, config: InternalConfig): TaxRate {
  return config.tax.rates.find((rate) => rate.id === state.tax) ?? config.tax.rates[0]
}

export function createState(config: InternalConfig, now = Date.now(), seed = 20261124): InternalState {
  const resources = clone(config.start)
  const levels: Record<string, number> = {}
  for (const def of config.resources) levels[def.key] = def.cap?.levels ?? 1
  const slots: QueueSlot[] = Array.from({ length: config.queue.slots }, (_, index) => ({
    id: `slot_${index + 1}`,
    kind: "",
    label: "待建",
    levelAtStart: 0,
    seconds: 0,
    remaining: 0,
    elapsed: 0,
    status: "queued",
    paid: {},
  }))
  return {
    schema: SAVE_VERSION,
    createdAt: now,
    clock: 0,
    resources,
    levels,
    morale: config.morale.start,
    tax: config.tax.default,
    slots,
    rng: seed,
    seed,
    eventLog: [],
  }
}

export function tick(state: InternalState, config: InternalConfig, seconds: number): InternalState {
  const next = clone(state)
  next.clock += seconds
  const multiplier = moraleMultiplier(next, config)
  const rate = taxRate(next, config)

  for (const def of config.resources) {
    const income = (def.rate * seconds) / 3600
    const gross = income * multiplier * (def.taxable ? rate.tax * 5 : 1)
    const cap = capOf({ ...def, cap: def.cap ? { ...def.cap, levels: next.levels[def.key] ?? def.cap.levels } : null })
    next.resources[def.key] = Math.min(cap, next.resources[def.key] + gross)
  }

  const hours = seconds / 3600
  next.morale = Math.max(config.morale.min, Math.min(config.morale.max, next.morale + rate.moralePerHour * hours))

  const progressing = next.slots.filter((slot) => slot.status === "building")
  for (const slot of progressing) {
    slot.remaining = Math.max(0, slot.remaining - seconds)
    slot.elapsed += seconds
    if (slot.remaining === 0) slot.status = "done"
  }
  const building = next.slots.find((slot) => slot.status === "building")
  if (!building) {
    const queued = next.slots.filter((slot) => slot.status === "queued" && slot.kind)
    const promoted = queued[0]
    if (promoted) {
      promoted.status = "building"
    }
  }
  return next
}

export function setTax(state: InternalState, id: TaxRate["id"]): InternalState {
  const next = clone(state)
  next.tax = id
  return next
}

export function canPay(state: InternalState, cost: Partial<Record<ResourceKey, number>>): boolean {
  return Object.entries(cost).every(([key, amount]) => state.resources[key as ResourceKey] >= (amount ?? 0))
}

export function duration(building: BuildingDef, level: number, speed = 1): number {
  return Math.max(1, Math.round(building.seconds * (1 + 0.15 * Math.max(0, level - 1)) / speed))
}

export function enqueue(
  state: InternalState,
  config: InternalConfig,
  kind: string,
): { state: InternalState; ok: boolean; reason?: string } {
  const next = clone(state)
  const building = config.buildings.find((item) => item.kind === kind)
  if (!building) return { state, ok: false, reason: "unknown-building" }
  const free = next.slots.find((slot) => slot.kind === "" || slot.status === "queued")
  if (!free) return { state, ok: false, reason: "queue-full" }
  if (!canPay(next, building.cost)) return { state, ok: false, reason: "not-enough-resource" }

  for (const [key, amount] of Object.entries(building.cost)) {
    next.resources[key as ResourceKey] -= amount ?? 0
  }
  const level = next.levels[kind] ?? 1
  const seconds = duration(building, level + 1)
  const hasBuilder = next.slots.some((slot) => slot.status === "building")
  free.kind = kind
  free.label = building.label
  free.levelAtStart = level
  free.seconds = seconds
  free.remaining = seconds
  free.elapsed = 0
  free.status = hasBuilder ? "queued" : "building"
  free.paid = clone(building.cost)
  return { state: next, ok: true }
}

export function claim(state: InternalState, slotId: string): { state: InternalState; ok: boolean } {
  const next = clone(state)
  const slot = next.slots.find((item) => item.id === slotId)
  if (!slot || slot.status !== "done") return { state, ok: false }
  next.levels[slot.kind] = slot.levelAtStart + 1
  slot.kind = ""
  slot.label = "待建"
  slot.status = "queued"
  slot.paid = {}
  slot.seconds = 0
  slot.remaining = 0
  slot.elapsed = 0
  return { state: next, ok: true }
}

export function cancel(state: InternalState, config: InternalConfig, slotId: string): { state: InternalState; ok: boolean; refunded: Partial<Record<ResourceKey, number>> } {
  const next = clone(state)
  const slot = next.slots.find((item) => item.id === slotId)
  if (!slot || !slot.kind) return { state, ok: false, refunded: {} }
  const refunded: Partial<Record<ResourceKey, number>> = {}
  for (const [key, amount] of Object.entries(slot.paid)) {
    if (key === "coin") continue
    const value = Math.floor((amount ?? 0) * config.refundPct)
    refunded[key as ResourceKey] = value
    next.resources[key as ResourceKey] += value
  }
  slot.kind = ""
  slot.label = "待建"
  slot.paid = {}
  slot.seconds = 0
  slot.remaining = 0
  slot.elapsed = 0
  slot.status = "queued"
  return { state: next, ok: true, refunded }
}

export function isProtected(state: InternalState, config: InternalConfig): boolean {
  const windowMs = config.newbieProtectHours * 3600 * 1000
  return state.createdAt + windowMs > Date.now()
}

export function rollEvents(
  state: InternalState,
  config: InternalConfig,
  hours: number,
): { state: InternalState; events: { id: string; label: string; at: number }[] } {
  const next = clone(state)
  const fired: { id: string; label: string; at: number }[] = []
  if (hours <= 0) return { state: next, events: fired }
  for (const event of config.events) {
    const negative = event.effect.levelDown !== undefined || (event.effect.coin ?? 0) < 0
    if (negative && isProtected(next, config)) continue
    const expected = event.perHour * hours
    const whole = Math.floor(expected)
    const rest = expected - whole
    for (let index = 0; index < whole; index += 1) fire(event)
    if (rest > 0) {
      const random = nextRandom(next.rng)
      next.rng = random.seed
      if (random.value < rest) fire(event)
    }
  }
  return { state: next, events: fired }

  function fire(event: EventDef): void {
    const at = next.clock
    if (event.effect.foodPct) next.resources.food = Math.round(next.resources.food * (1 + event.effect.foodPct))
    if (event.effect.levelDown) {
      const keys = Object.keys(next.levels)
      const random = nextRandom(next.rng)
      next.rng = random.seed
      const key = keys[Math.floor(random.value * keys.length)] ?? keys[0]
      next.levels[key] = Math.max(1, (next.levels[key] ?? 1) - event.effect.levelDown)
    }
    if (event.effect.pop) next.resources.pop += event.effect.pop
    if (event.effect.coin) {
      if (next.resources.coin + event.effect.coin < 0) return
      next.resources.coin += event.effect.coin
    }
    fired.push({ id: event.id, label: event.label, at })
    next.eventLog.push({ at, id: event.id, label: event.label })
    next.eventLog = next.eventLog.slice(-50)
  }
}

export function formatResource(state: InternalState, config: InternalConfig, key: ResourceKey): string {
  const def = config.resources.find((item) => item.key === key)
  const value = Math.floor(state.resources[key])
  if (!def?.cap) return String(value)
  const cap = capOf({ ...def, cap: { ...def.cap, levels: state.levels[key] ?? def.cap.levels } })
  return value >= cap ? `${value}/${cap} 滿` : `${value}/${cap}`
}

export function serialize(state: InternalState): string {
  return JSON.stringify({ version: SAVE_VERSION, state })
}

export function deserialize(raw: string | null, config: InternalConfig): InternalState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version?: number; state?: InternalState }
    if (!parsed?.version || !parsed.state) return null
    if (parsed.version !== SAVE_VERSION) return null
    const merged = createState(config)
    return { ...merged, ...parsed.state, schema: SAVE_VERSION }
  } catch {
    return null
  }
}

export function save(state: InternalState, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(state))
}

export function load(config: InternalConfig, storage: Pick<Storage, "getItem"> = localStorage): InternalState | null {
  return deserialize(storage.getItem(SAVE_KEY), config)
}

export { SAVE_KEY, SAVE_VERSION }

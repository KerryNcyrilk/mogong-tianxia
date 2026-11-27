/**
 * DEV-CONSOLE-V1 執行期覆寫。
 * 只活在記憶體與 localStorage（mg_dev_overrides_v1）。
 * 沒有覆寫時 getter 在第一次讀檔之後只做一次布林判斷，原值原樣返回。
 * 不寫 data/cityLayout.json、data/units.json，也不改 src/combat、src/m0。
 */
import { INTERNAL_CONFIG } from "../internal/config.ts"
import { claim } from "../internal/engine.ts"
import type { InternalConfig, InternalState, ResourceKey } from "../internal/types.ts"

export const STORAGE_KEY = "mg_dev_overrides_v1"

export const RESOURCE_KEYS = ["pop", "jade", "coin", "food", "wood", "iron", "stone"] as const

export const TROOP_IDS = ["blade", "halberd", "bow", "shield", "cavalry", "scholar", "beast"] as const
export type TroopId = (typeof TROOP_IDS)[number]

/** 與 src/demo/recruit.ts 的 RECRUIT_COST 對齊；測試鎖死兩者相等。徵兵基礎價不讀 units.json。 */
export const RECRUIT_BASE = { coin: 300, food: 120, pop: 1 } as const

/** 審計建議：每 100 騎扣 80、每 100 盾扣 50。其餘兵種 0。比例再乘這張表。 */
export const IRON_PER_100: Readonly<Record<string, number>> = { cavalry: 80, shield: 50 }

const DEFAULT_TIMESCALE = 1
const DEFAULT_DRILL_EXP = 12
const DEFAULT_WIN_EXP_MULTIPLIER = 1
const DEFAULT_TROOP_WEIGHT = 0
const DEFAULT_MORALE_THRESHOLD = 0.5
const DEFAULT_IRON_RATIO = 1

export interface IronOverride {
  on: boolean
  ratio: number
}

export interface DevOverrideBag {
  v: 1
  timescale?: number
  start?: Partial<Record<ResourceKey, number>>
  iron?: IronOverride
  unitCost?: Partial<Record<TroopId, number>>
  /** 校場每 60 秒發的經驗。預設 12（現行每分鐘 12）。 */
  drillExp?: number
  /** 乘在 stages.json winExpPerEnemy 上。預設 1。 */
  winExpMultiplier?: number
  /** 0＝棋盤不乘人數；1＝傷害再乘攻擊方人數。 */
  troopDamageWeight?: number
  /** 存活比例低於此值才吃士氣懲罰。最高 0.5，與棋盤硬編碼一致。 */
  moraleThreshold?: number
}

export interface DiffEntry {
  from: number | boolean
  to: number | boolean
}

export interface RecruitJob {
  id: string
  unit: string
  amount: number
}

export interface CityBridge {
  resources: () => Record<ResourceKey, number>
  slots: () => readonly { id: string; label: string; status: string; remaining: number; kind: string }[]
  setResource: (key: ResourceKey, value: number) => void
  addResource: (key: ResourceKey, delta: number) => void
  finishBuild: () => void
  finishRecruit: () => void
  simulateOffline: (seconds: number) => void
  newGame: () => void
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

let memory: Store | null = null
let loaded = false
let fast = false
let current: DevOverrideBag | null = null
let jobSeq = 0
let jobs: RecruitJob[] = []
let cityRev = 0
let bridge: CityBridge | null = null

const listeners = new Set<() => void>()
const cityListeners = new Set<() => void>()

function backing(): Store | null {
  if (memory) return memory
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function isTroop(unit: string): unit is TroopId {
  return (TROOP_IDS as readonly string[]).includes(unit)
}

function normalize(raw: Partial<DevOverrideBag> | null | undefined): DevOverrideBag {
  const bag: DevOverrideBag = { v: 1 }
  if (!raw || typeof raw !== "object") return bag
  if (raw.timescale !== undefined) bag.timescale = Math.round(clampNum(raw.timescale, 1, 100, DEFAULT_TIMESCALE))
  if (raw.drillExp !== undefined) bag.drillExp = clampNum(raw.drillExp, 0, 1_000_000, DEFAULT_DRILL_EXP)
  if (raw.winExpMultiplier !== undefined) {
    bag.winExpMultiplier = clampNum(raw.winExpMultiplier, 0, 1000, DEFAULT_WIN_EXP_MULTIPLIER)
  }
  if (raw.troopDamageWeight !== undefined) {
    bag.troopDamageWeight = clampNum(raw.troopDamageWeight, 0, 1, DEFAULT_TROOP_WEIGHT)
  }
  if (raw.moraleThreshold !== undefined) {
    bag.moraleThreshold = clampNum(raw.moraleThreshold, 0, DEFAULT_MORALE_THRESHOLD, DEFAULT_MORALE_THRESHOLD)
  }
  if (raw.iron && typeof raw.iron === "object") {
    bag.iron = {
      on: Boolean(raw.iron.on),
      ratio: clampNum(raw.iron.ratio, 0, 100, DEFAULT_IRON_RATIO),
    }
  }
  if (raw.start && typeof raw.start === "object") {
    const start: Partial<Record<ResourceKey, number>> = {}
    for (const key of RESOURCE_KEYS) {
      const value = raw.start[key]
      if (value === undefined) continue
      start[key] = clampNum(value, 0, 1e12, INTERNAL_CONFIG.start[key])
    }
    bag.start = start
  }
  if (raw.unitCost && typeof raw.unitCost === "object") {
    const unitCost: Partial<Record<TroopId, number>> = {}
    for (const id of TROOP_IDS) {
      const value = raw.unitCost[id]
      if (value === undefined) continue
      unitCost[id] = clampNum(value, 0, 100, 1)
    }
    bag.unitCost = unitCost
  }
  return bag
}

function strip(bag: DevOverrideBag): DevOverrideBag | null {
  const next: DevOverrideBag = { v: 1 }
  let any = false
  if (bag.timescale !== undefined && bag.timescale !== DEFAULT_TIMESCALE) {
    next.timescale = bag.timescale
    any = true
  }
  if (bag.drillExp !== undefined && bag.drillExp !== DEFAULT_DRILL_EXP) {
    next.drillExp = bag.drillExp
    any = true
  }
  if (bag.winExpMultiplier !== undefined && bag.winExpMultiplier !== DEFAULT_WIN_EXP_MULTIPLIER) {
    next.winExpMultiplier = bag.winExpMultiplier
    any = true
  }
  if (bag.troopDamageWeight !== undefined && bag.troopDamageWeight !== DEFAULT_TROOP_WEIGHT) {
    next.troopDamageWeight = bag.troopDamageWeight
    any = true
  }
  if (bag.moraleThreshold !== undefined && bag.moraleThreshold !== DEFAULT_MORALE_THRESHOLD) {
    next.moraleThreshold = bag.moraleThreshold
    any = true
  }
  if (bag.iron && (bag.iron.on || bag.iron.ratio !== DEFAULT_IRON_RATIO)) {
    next.iron = { on: bag.iron.on, ratio: bag.iron.ratio }
    any = true
  }
  if (bag.start) {
    const start: Partial<Record<ResourceKey, number>> = {}
    for (const key of RESOURCE_KEYS) {
      const value = bag.start[key]
      if (value === undefined || value === INTERNAL_CONFIG.start[key]) continue
      start[key] = value
      any = true
    }
    if (Object.keys(start).length > 0) next.start = start
  }
  if (bag.unitCost) {
    const unitCost: Partial<Record<TroopId, number>> = {}
    for (const id of TROOP_IDS) {
      const value = bag.unitCost[id]
      if (value === undefined || value === 1) continue
      unitCost[id] = value
      any = true
    }
    if (Object.keys(unitCost).length > 0) next.unitCost = unitCost
  }
  return any ? next : null
}

function hydrate(): void {
  loaded = true
  current = null
  fast = true
  const store = backing()
  if (!store) return
  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as Partial<DevOverrideBag>
    current = strip(normalize(parsed))
    fast = current === null
  } catch {
    current = null
    fast = true
  }
}

function touch(): DevOverrideBag | null {
  if (fast) return null
  if (!loaded) hydrate()
  return current
}

function emit(): void {
  for (const listener of listeners) listener()
}

function persist(): void {
  const store = backing()
  if (!store) return
  try {
    if (current === null) store.removeItem(STORAGE_KEY)
    else store.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // 私隱模式只留記憶體
  }
}

function commit(raw: Partial<DevOverrideBag>): void {
  current = strip(normalize({ v: 1, ...raw }))
  fast = current === null
  loaded = true
  persist()
  emit()
}

/** 測試用：把存檔換成記憶體，並清掉已讀快取。 */
export function attachOverrideStorage(next: Store | null): void {
  memory = next
  current = null
  loaded = false
  fast = false
  jobs = []
  jobSeq = 0
}

export function reloadOverrides(): void {
  loaded = false
  fast = false
  current = null
  touch()
}

export function readOverrides(): DevOverrideBag | null {
  return touch()
}

export function subscribeOverrides(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function overridesIdle(): boolean {
  if (fast) return true
  touch()
  return fast
}

export function updateOverrides(patch: Partial<Omit<DevOverrideBag, "v">>): void {
  const base = touch() ?? { v: 1 as const }
  commit({
    ...base,
    ...patch,
    start: patch.start ? { ...base.start, ...patch.start } : base.start,
    unitCost: patch.unitCost ? { ...base.unitCost, ...patch.unitCost } : base.unitCost,
    iron: patch.iron ? { ...(base.iron ?? { on: false, ratio: DEFAULT_IRON_RATIO }), ...patch.iron } : base.iron,
  })
}

export function resetOverrides(): void {
  jobs = []
  jobSeq = 0
  commit({ v: 1 })
  bumpCity()
}

export function scaledTickSeconds(base: number): number {
  if (fast) return base
  const scale = touch()?.timescale
  if (scale === undefined || scale === DEFAULT_TIMESCALE) return base
  return base * scale
}

export function drillExpOf(base: number): number {
  if (fast) return base
  const value = touch()?.drillExp
  return value === undefined ? base : value
}

export function winExpPerEnemyOf(base: number): number {
  if (fast) return base
  const multiplier = touch()?.winExpMultiplier
  if (multiplier === undefined || multiplier === DEFAULT_WIN_EXP_MULTIPLIER) return base
  return base * multiplier
}

export function troopDamageWeight(): number {
  if (fast) return DEFAULT_TROOP_WEIGHT
  return touch()?.troopDamageWeight ?? DEFAULT_TROOP_WEIGHT
}

export function moraleThresholdOf(base = DEFAULT_MORALE_THRESHOLD): number {
  if (fast) return base
  const value = touch()?.moraleThreshold
  return value === undefined ? base : value
}

export function applyStartResources<T extends { resources: Record<ResourceKey, number> }>(state: T): T {
  if (fast) return state
  const start = touch()?.start
  if (!start) return state
  let changed = false
  const resources = { ...state.resources }
  for (const key of RESOURCE_KEYS) {
    const value = start[key]
    if (value === undefined || value === resources[key]) continue
    resources[key] = value
    changed = true
  }
  if (!changed) return state
  return { ...state, resources }
}

export function withResource(state: InternalState, config: InternalConfig, key: ResourceKey, value: number): InternalState {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0
  const def = config.resources.find((item) => item.key === key)
  let levels = state.levels
  if (def?.cap && def.cap.unit > 0) {
    const cap = def.cap.base + def.cap.unit * (state.levels[key] ?? def.cap.levels)
    if (safe > cap) {
      const needed = Math.ceil((safe - def.cap.base) / def.cap.unit)
      levels = { ...state.levels, [key]: Math.max(state.levels[key] ?? 0, needed) }
    }
  }
  return { ...state, levels, resources: { ...state.resources, [key]: safe } }
}

export function finishBuildQueue(state: InternalState): { state: InternalState; finished: number } {
  const ids = state.slots.filter((slot) => slot.kind).map((slot) => slot.id)
  if (ids.length === 0) return { state, finished: 0 }
  let working: InternalState = {
    ...state,
    slots: state.slots.map((slot) =>
      slot.kind ? { ...slot, remaining: 0, elapsed: slot.seconds, status: "done" } : slot,
    ),
  }
  let finished = 0
  for (const id of ids) {
    const result = claim(working, id)
    if (!result.ok) continue
    working = result.state
    finished += 1
  }
  return { state: working, finished }
}

function unitMultiplier(unit: string): number {
  if (fast) return 1
  if (!isTroop(unit)) return 1
  const value = touch()?.unitCost?.[unit]
  return value === undefined ? 1 : value
}

export function ironPerBatch(unit: string): number {
  if (fast) return 0
  const iron = touch()?.iron
  if (!iron?.on) return 0
  const base = IRON_PER_100[unit] ?? 0
  if (base === 0) return 0
  return base * iron.ratio
}

export function priceRecruit(unit: string, batches: number): { coin: number; food: number; pop: number; iron: number } {
  const count = Math.max(0, Math.floor(batches))
  const multiplier = unitMultiplier(unit)
  return {
    coin: Math.round(RECRUIT_BASE.coin * count * multiplier),
    food: Math.round(RECRUIT_BASE.food * count * multiplier),
    pop: RECRUIT_BASE.pop * count,
    iron: Math.round(ironPerBatch(unit) * count),
  }
}

export function overrideDiff(): Record<string, DiffEntry> {
  const bag = touch()
  const diff: Record<string, DiffEntry> = {}
  if (!bag) return diff
  if (bag.timescale !== undefined) diff.timescale = { from: DEFAULT_TIMESCALE, to: bag.timescale }
  if (bag.drillExp !== undefined) diff.drillExp = { from: DEFAULT_DRILL_EXP, to: bag.drillExp }
  if (bag.winExpMultiplier !== undefined) diff.winExpMultiplier = { from: DEFAULT_WIN_EXP_MULTIPLIER, to: bag.winExpMultiplier }
  if (bag.troopDamageWeight !== undefined) diff.troopDamageWeight = { from: DEFAULT_TROOP_WEIGHT, to: bag.troopDamageWeight }
  if (bag.moraleThreshold !== undefined) diff.moraleThreshold = { from: DEFAULT_MORALE_THRESHOLD, to: bag.moraleThreshold }
  if (bag.iron?.on) diff["iron.on"] = { from: false, to: true }
  if (bag.iron && bag.iron.ratio !== DEFAULT_IRON_RATIO) diff["iron.ratio"] = { from: DEFAULT_IRON_RATIO, to: bag.iron.ratio }
  if (bag.start) {
    for (const key of RESOURCE_KEYS) {
      const value = bag.start[key]
      if (value === undefined) continue
      diff[`start.${key}`] = { from: INTERNAL_CONFIG.start[key], to: value }
    }
  }
  if (bag.unitCost) {
    for (const id of TROOP_IDS) {
      const value = bag.unitCost[id]
      if (value === undefined) continue
      diff[`unitCost.${id}`] = { from: 1, to: value }
    }
  }
  return diff
}

export function balanceOverrideJson(): string {
  const bag = touch()
  const unitCost: Record<string, number> = {}
  for (const id of TROOP_IDS) unitCost[id] = bag?.unitCost?.[id] ?? 1
  return JSON.stringify(
    {
      schema: "balance-override.v1",
      start: bag?.start ?? {},
      iron: {
        on: bag?.iron?.on ?? false,
        ratio: bag?.iron?.ratio ?? DEFAULT_IRON_RATIO,
        per100: IRON_PER_100,
      },
      unitCost,
      drillExpPerMinute: bag?.drillExp ?? DEFAULT_DRILL_EXP,
      winExpMultiplier: bag?.winExpMultiplier ?? DEFAULT_WIN_EXP_MULTIPLIER,
      troopDamageWeight: bag?.troopDamageWeight ?? DEFAULT_TROOP_WEIGHT,
      moraleThreshold: bag?.moraleThreshold ?? DEFAULT_MORALE_THRESHOLD,
    },
    null,
    2,
  )
}

export function listRecruitJobs(): readonly RecruitJob[] {
  return jobs
}

export function pushRecruitJob(unit: string, amount: number): RecruitJob {
  jobSeq += 1
  const job = { id: `rq_${jobSeq}`, unit, amount: Math.max(0, Math.floor(amount)) }
  jobs = [...jobs, job]
  bumpCity()
  return job
}

export function takeRecruitJobs(): RecruitJob[] {
  const taken = jobs
  jobs = []
  bumpCity()
  return taken
}

export function bindCity(next: CityBridge): () => void {
  bridge = next
  bumpCity()
  return () => {
    if (bridge === next) bridge = null
    bumpCity()
  }
}

export function cityBridge(): CityBridge | null {
  return bridge
}

export function subscribeCity(listener: () => void): () => void {
  cityListeners.add(listener)
  return () => cityListeners.delete(listener)
}

export function readCityRev(): number {
  return cityRev
}

export function cityHasListeners(): boolean {
  return cityListeners.size > 0
}

export function bumpCity(): void {
  cityRev += 1
  for (const listener of cityListeners) listener()
}

export function consoleRequested(search: string): boolean {
  return new URLSearchParams(search).get("dev") === "1"
}

export function hotkeyAction(input: {
  ctrlKey: boolean
  shiftKey: boolean
  key: string
  code?: string
  targetTag?: string
}): "toggle" | "ignore" {
  const chord = input.ctrlKey && input.shiftKey && input.key.toLowerCase() === "d"
  const tick = input.key === "`" || input.code === "Backquote"
  if (!chord && !tick) return "ignore"
  if (tick && !chord && (input.targetTag === "INPUT" || input.targetTag === "TEXTAREA")) return "ignore"
  return "toggle"
}

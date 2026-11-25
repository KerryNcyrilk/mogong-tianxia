import type { GeneralConfig, GeneralRecord, GeneralStats, RosterState, SkillDef } from "./types.ts"

const SAVE_KEY = "mogong.general.v1"
const SAVE_VERSION = 1

export const EMPTY_SLOT = { generalId: null, unit: null, count: 0 } as const

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function seedOf(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = (hash * 16777619) % 4294967296
  }
  return hash
}

export function dayKey(now = Date.now()): string {
  const date = new Date(now)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

export function expToNext(level: number, config: GeneralConfig): number {
  return Math.round(config.level.expBase * Math.pow(config.level.expGrow, Math.max(0, level - 1)))
}

export function expPct(record: GeneralRecord, config: GeneralConfig): number {
  if (record.level >= config.level.max) return 100
  return Math.min(100, Math.floor((record.exp / expToNext(record.level, config)) * 100))
}

export function skillOf(id: string, config: GeneralConfig): SkillDef | null {
  return config.skills.find((item) => item.id === id) ?? null
}

function archetypeOf(record: GeneralRecord, config: GeneralConfig) {
  return config.archetypes.find((item) => item.id === record.archetype) ?? config.archetypes[0]
}

/** 屬性＝原型基礎 + (等級-1)×每級成長 + 裝備加成；帶兵上限＝(基礎 + 統率×係數)×兵法加成。 */
export function statsOf(record: GeneralRecord, config: GeneralConfig): GeneralStats {
  const archetype = archetypeOf(record, config)
  const grow = config.level.perLevel
  let atk = (archetype?.atk ?? 0) + grow.atk * (record.level - 1)
  let def = (archetype?.def ?? 0) + grow.def * (record.level - 1)
  let lead = (archetype?.lead ?? 0) + grow.lead * (record.level - 1)
  for (const slot of config.equipment.slots) {
    const itemId = record.equip[slot]
    const item = config.equipment.items.find((entry) => entry.id === itemId)
    if (!item) continue
    atk += item.atk
    def += item.def
    lead += item.lead
  }
  let troopPct = 0
  let defPct = 0
  for (const skillId of record.skills) {
    const skill = skillOf(skillId, config)
    if (!skill) continue
    troopPct += skill.troopPct ?? 0
    defPct += skill.defPct ?? 0
  }
  def = Math.round(def * (1 + defPct))
  return {
    atk,
    def,
    lead,
    troopCap: Math.round((config.lead.capBase + lead * config.lead.capPer) * (1 + troopPct)),
  }
}

export function makeGeneral(id: string, config: GeneralConfig, now = Date.now()): GeneralRecord | null {
  const entry = config.pool.find((item) => item.id === id)
  if (!entry) return null
  return {
    id: entry.id,
    name: entry.name,
    archetype: entry.archetype,
    level: 1,
    exp: 0,
    equip: { weapon: null, armor: null, horse: null },
    skills: [...entry.skills],
    recruitedAt: now,
  }
}

export function createRoster(config: GeneralConfig, now = Date.now()): RosterState {
  const troops: Record<string, number> = {}
  for (const row of config.troops) troops[row.id] = row.start
  const starter = makeGeneral(config.pool[0]?.id ?? "g_mozi", config, now)
  return {
    schema: SAVE_VERSION,
    generals: starter ? [starter] : [],
    activeId: starter?.id ?? null,
    tavern: { day: dayKey(now), offers: [] },
    troops,
    formation: Array.from({ length: config.formation.slots }, () => ({ ...EMPTY_SLOT })),
    clock: now,
  }
}

/** 升級曲線：可連續升多級，滿級封頂不再收經驗。 */
export function gainExp(state: RosterState, id: string, amount: number, config: GeneralConfig): { state: RosterState; levels: number } {
  const next = clone(state)
  const record = next.generals.find((item) => item.id === id)
  if (!record || amount <= 0) return { state, levels: 0 }
  let levels = 0
  let rest = amount
  record.exp += rest
  while (record.level < config.level.max && record.exp >= expToNext(record.level, config)) {
    record.exp -= expToNext(record.level, config)
    record.level += 1
    levels += 1
  }
  if (record.level >= config.level.max) record.exp = 0
  return { state: next, levels }
}

export function equip(
  state: RosterState,
  id: string,
  itemId: string,
  config: GeneralConfig,
): { state: RosterState; ok: boolean; reason?: string } {
  const item = config.equipment.items.find((entry) => entry.id === itemId)
  if (!item) return { state, ok: false, reason: "unknown-item" }
  const next = clone(state)
  const record = next.generals.find((entry) => entry.id === id)
  if (!record) return { state, ok: false, reason: "unknown-general" }
  record.equip[item.slot] = item.id
  return { state: next, ok: true }
}

export function unequip(state: RosterState, id: string, slot: "weapon" | "armor" | "horse"): RosterState {
  const next = clone(state)
  const record = next.generals.find((entry) => entry.id === id)
  if (record) record.equip[slot] = null
  return next
}

/** 酒館：每日固定三名候選（同日重算結果一致），已招募者不再出現。 */
export function refreshTavern(state: RosterState, config: GeneralConfig, now = Date.now()): RosterState {
  const day = dayKey(now)
  const next = clone(state)
  if (next.tavern.day === day && next.tavern.offers.length === config.tavern.slots) return next
  const taken = new Set(next.generals.map((item) => item.id))
  const pool = config.pool.filter((item) => !taken.has(item.id))
  const seed = seedOf(`${day}:${pool.length}`)
  const offers: string[] = []
  let cursor = seed
  while (offers.length < config.tavern.slots && pool.length > 0) {
    cursor = (cursor * 1103515245 + 12345) % 2147483648
    const pick = pool[Math.floor((cursor / 2147483648) * pool.length)]
    if (!pick) break
    if (offers.includes(pick.id)) {
      cursor += 1
      continue
    }
    offers.push(pick.id)
  }
  next.tavern = { day, offers }
  return next
}

export function recruit(
  state: RosterState,
  config: GeneralConfig,
  offerId: string,
  wallet: { coin: number; jade: number },
  now = Date.now(),
): { state: RosterState; ok: boolean; reason?: string; cost?: { coin: number; jade: number } } {
  if (!state.tavern.offers.includes(offerId)) return { state, ok: false, reason: "no-offer" }
  if (state.generals.some((item) => item.id === offerId)) return { state, ok: false, reason: "already-recruited" }
  const cost = config.tavern.cost
  if (wallet.coin < cost.coin || wallet.jade < cost.jade) return { state, ok: false, reason: "not-enough-resource" }
  const record = makeGeneral(offerId, config, now)
  if (!record) return { state, ok: false, reason: "no-offer" }
  const next = clone(state)
  next.generals.push(record)
  next.tavern.offers = next.tavern.offers.filter((item) => item !== offerId)
  return { state: next, ok: true, cost }
}

export function setActive(state: RosterState, id: string): { state: RosterState; ok: boolean } {
  if (!state.generals.some((item) => item.id === id)) return { state, ok: false }
  const next = clone(state)
  next.activeId = id
  return { state: next, ok: true }
}

/** 校場編隊：每格一名武將＋一兵種＋兵數；兵數受帶兵上限與兵池限制，離隊即回池。 */
export function setFormation(
  state: RosterState,
  config: GeneralConfig,
  slotIndex: number,
  id: string | null,
  unit: string | null,
  count: number,
): { state: RosterState; ok: boolean; reason?: string } {
  const slot = state.formation[slotIndex]
  if (!slot) return { state, ok: false, reason: "no-slot" }
  const next = clone(state)
  const target = next.formation[slotIndex]
  if (!target) return { state, ok: false, reason: "no-slot" }
  if (slot.generalId) next.troops[slot.unit ?? ""] = (next.troops[slot.unit ?? ""] ?? 0) + slot.count
  target.generalId = null
  target.unit = null
  target.count = 0
  if (id === null) return { state: next, ok: true }
  const record = next.generals.find((item) => item.id === id)
  if (!record) return { state, ok: false, reason: "unknown-general" }
  if (!config.troops.some((row) => row.id === unit)) return { state, ok: false, reason: "unknown-unit" }
  if (next.formation.some((entry, index) => index !== slotIndex && entry.generalId === id)) {
    return { state, ok: false, reason: "general-busy" }
  }
  const cap = Math.min(statsOf(record, config).troopCap, next.troops[unit ?? ""] ?? 0)
  const wanted = Math.floor(count)
  if (wanted < config.formation.minCount || wanted > cap) return { state, ok: false, reason: "bad-count" }
  next.troops[unit ?? ""] = (next.troops[unit ?? ""] ?? 0) - wanted
  target.generalId = id
  target.unit = unit
  target.count = wanted
  return { state: next, ok: true }
}

export function troopRows(state: RosterState, config: GeneralConfig): { name: string; count: number }[] {
  return config.troops.map((row) => ({ name: row.name, count: Math.floor(state.troops[row.id] ?? 0) }))
}

export function formationSummary(state: RosterState, config: GeneralConfig): string[] {
  return state.formation.map((slot, index) => {
    if (!slot.generalId) return `第 ${index + 1} 格空`
    const record = state.generals.find((item) => item.id === slot.generalId)
    const unit = config.troops.find((row) => row.id === slot.unit)
    return `第 ${index + 1} 格 ${record?.name ?? slot.generalId} · ${unit?.name ?? "?"} ${slot.count}`
  })
}

/** 給 B2 戰棋用的武將物件（技能已轉成棋盤可用的主動／被動資料）。 */
export function battleGeneral(
  state: RosterState,
  id: string,
  config: GeneralConfig,
  skillIds?: string[],
): { id: string; name: string; atk: number; def: number; skills: { id: string; name: string; range: number; power: number; cooldown: number }[] } | null {
  const record = state.generals.find((item) => item.id === id)
  if (!record) return null
  const stats = statsOf(record, config)
  const wanted = skillIds ?? record.skills
  const skills = wanted
    .map((skillId) => skillOf(skillId, config))
    .filter((skill): skill is SkillDef => Boolean(skill) && skill?.kind === "active")
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      range: skill.range ?? 1,
      power: skill.power ?? 1,
      cooldown: skill.cooldown ?? 1,
    }))
  return { id: record.id, name: record.name, atk: stats.atk, def: stats.def, skills }
}

export function serialize(state: RosterState): string {
  return JSON.stringify({ version: SAVE_VERSION, state })
}

export function deserialize(raw: string | null, config: GeneralConfig): RosterState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version?: number; state?: RosterState }
    if (!parsed?.version || !parsed.state || parsed.version !== SAVE_VERSION) return null
    const merged = createRoster(config)
    const state = parsed.state
    return {
      ...merged,
      ...state,
      troops: { ...merged.troops, ...state.troops },
      formation: state.formation?.length === config.formation.slots ? state.formation : merged.formation,
      schema: SAVE_VERSION,
    }
  } catch {
    return null
  }
}

export function save(state: RosterState, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(SAVE_KEY, serialize(state))
}

export function load(config: GeneralConfig, storage: Pick<Storage, "getItem"> = localStorage): RosterState | null {
  return deserialize(storage.getItem(SAVE_KEY), config)
}

export { SAVE_KEY, SAVE_VERSION }

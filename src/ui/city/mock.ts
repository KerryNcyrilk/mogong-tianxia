/** Display figures are the B4 examples. Invented strings keep a MOCK_ prefix. */

export interface MockResource {
  id: string
  name: string
  value: string
  yieldText: string
  format: "cap" | "int" | "pair"
}

export interface MockQueueSlot {
  id: string
  name: string
  level: number
  seconds: number
  status: "building" | "queued"
}

export interface MockCombatEntry {
  id: string
  name: string
  disabled: true
  note: "戰鬥系統待 B6"
}

export const MOCK_LORD = {
  name: "墨翟",
  prestige: "1280",
  peerage: "亭侯",
  alliance: "墨門",
  city: "墨城",
} as const

export const MOCK_GENERAL = {
  name: "MOCK_墨翟",
  stat: "MOCK_攻 42 防 36",
  level: 12,
  expPct: 64,
  status: "待命",
} as const

export const MOCK_RESOURCES: readonly MockResource[] = [
  { id: "res_pop", name: "人口", value: "320/500", yieldText: "+12/時", format: "cap" },
  { id: "res_jade", name: "玉石", value: "112", yieldText: "+1/時", format: "int" },
  { id: "res_coin", name: "刀幣", value: "245608", yieldText: "+360/時", format: "int" },
  { id: "res_food", name: "糧食", value: "51298/63002", yieldText: "+480/時", format: "pair" },
  { id: "res_wood", name: "木材", value: "51298/63002", yieldText: "+480/時", format: "pair" },
  { id: "res_iron", name: "生鐵", value: "51298/63002", yieldText: "+240/時", format: "pair" },
  { id: "res_stone", name: "石頭", value: "51298/63002", yieldText: "+240/時", format: "pair" },
]

export const MOCK_TROOPS = [
  { name: "刀兵", count: "MOCK_1200" },
  { name: "戟兵", count: "MOCK_800" },
  { name: "弓兵", count: "MOCK_960" },
  { name: "盾兵", count: "MOCK_640" },
  { name: "騎兵", count: "MOCK_320" },
  { name: "學者", count: "MOCK_40" },
  { name: "神獸", count: "MOCK_1" },
] as const

/** Two building rows and one queued row. Third name and the non-example timers are assumed. */
export const MOCK_QUEUE: readonly MockQueueSlot[] = [
  { id: "queue_farm", name: "農田", level: 17, seconds: 29 * 60 + 59, status: "building" },
  { id: "queue_storage", name: "倉庫", level: 13, seconds: 2 * 60 * 60 + 15 * 60, status: "building" },
  { id: "queue_wait", name: "兵營", level: 6, seconds: 5 * 60 * 60, status: "queued" },
]

export const MOCK_COMBAT_ENTRIES: readonly MockCombatEntry[] = [
  { id: "combat_drill", name: "校場", disabled: true, note: "戰鬥系統待 B6" },
  { id: "combat_muster", name: "點兵場", disabled: true, note: "戰鬥系統待 B6" },
  { id: "action_arena", name: "競技", disabled: true, note: "戰鬥系統待 B6" },
]

export const MOCK_CHAT_TABS = [
  { id: "chat_all", label: "綜合" },
  { id: "chat_world", label: "世界" },
  { id: "chat_party", label: "組隊" },
  { id: "chat_alliance", label: "聯盟" },
  { id: "chat_dm", label: "私聊" },
] as const

export const MOCK_CHAT_SEED = ["MOCK_主城頻道已開啟"] as const

export const MOCK_ACTIONS = [
  { id: "action_quest", label: "任務" },
  { id: "action_build", label: "建築" },
  { id: "action_alliance", label: "聯盟" },
  { id: "action_arena", label: "競技" },
  { id: "action_mentor", label: "師徒" },
  { id: "action_team", label: "組隊" },
  { id: "action_forum", label: "論壇" },
  { id: "action_help", label: "幫助" },
  { id: "action_recharge", label: "充值" },
  { id: "action_shop", label: "商城" },
] as const

export function formatHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
}

export function queueTitle(slot: MockQueueSlot): string {
  return slot.level > 0 ? `${slot.name} ${slot.level}級` : slot.name
}

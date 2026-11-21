/**
 * 1280×720 baseline. 1920×1080 is scale(UI_1280, 1.5), never a second hand-written set.
 * Zoom steps stay outside this tree so they are not multiplied.
 * The camera anchor is the safe-rect center and does scale with the HUD.
 * The focus tile lives in src/city/camera.ts so it is not multiplied.
 */
import { ARTBOARD_H, ARTBOARD_W, ORIGIN_X, ORIGIN_Y } from "../../city/coords.ts"

export interface UiNode {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  group: string
  fontRole?: "body" | "value"
  fontSize?: number
  hit?: "control" | "ring"
}

export interface UiProfile {
  screenW: number
  screenH: number
  safe: { x: number; y: number; w: number; h: number }
  camera: { anchorX: number; anchorY: number }
  borderOuter: number
  borderInner: number
  nodes: UiNode[]
}

export const STYLE = {
  alpha: 1,
  panel: "#2B1F17",
  panelRaise: "#3A2A1C",
  border: "#1A120C",
  gold: "#C8A96B",
  text: "#E8DCC0",
  textMuted: "#9C8F78",
  building: "#6E8B4F",
  queued: "#6B625A",
  complete: "#C9A227",
  cinnabar: "#A5342A",
  grass: "#A09B60",
  fontTitle: '"Noto Serif SC", "Source Han Serif", SimSun, serif',
  fontValue: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
} as const

export const CAMERA_ZOOMS = [0.4, 0.5, 1.0, 1.2] as const
export const CAMERA_DEFAULT_ZOOM = 0.5
export const ARTBOARD = { w: ARTBOARD_W, h: ARTBOARD_H } as const
export const ART_ORIGIN = { x: ORIGIN_X, y: ORIGIN_Y } as const

const RESOURCE_ROWS = [
  ["res_pop", "人口"],
  ["res_jade", "玉石"],
  ["res_coin", "刀幣"],
  ["res_food", "糧食"],
  ["res_wood", "木材"],
  ["res_iron", "生鐵"],
  ["res_stone", "石頭"],
] as const

const TROOP_ROWS = ["刀兵", "戟兵", "弓兵", "盾兵", "騎兵", "學者", "神獸"] as const

const CHAT_TABS = [
  ["chat_all", "綜合"],
  ["chat_world", "世界"],
  ["chat_party", "組隊"],
  ["chat_alliance", "聯盟"],
  ["chat_dm", "私聊"],
] as const

const ACTION_CELLS = [
  ["action_quest", "任務", 671, 653],
  ["action_build", "建築", 815, 653],
  ["action_alliance", "聯盟", 959, 653],
  ["action_arena", "競技", 671, 679],
  ["action_mentor", "師徒", 815, 679],
  ["action_team", "組隊", 959, 679],
] as const

const SMALL_CELLS = [
  ["action_forum", "論壇", 671],
  ["action_help", "幫助", 775],
  ["action_recharge", "充值", 879],
  ["action_shop", "商城", 983],
] as const

function resourceNodes(): UiNode[] {
  const nodes: UiNode[] = []
  RESOURCE_ROWS.forEach(([id, label], index) => {
    const y = 144 + index * 32
    nodes.push(
      { id, label: `${label}行`, x: 0, y, w: 276, h: 32, group: "resource" },
      { id: `${id}_icon`, label: `${label}圖標`, x: 14, y: y + 6, w: 18, h: 21, group: "resource" },
      {
        id: `${id}_value`,
        label: `${label}數值`,
        x: 42,
        y: y + 8,
        w: 96,
        h: 18,
        group: "resource",
        fontRole: "value",
        fontSize: 12,
      },
      {
        id: `${id}_yield`,
        label: `${label}產量`,
        x: 146,
        y: y + 10,
        w: 68,
        h: 14,
        group: "resource",
        fontRole: "body",
        fontSize: 10,
      },
      { id: `${id}_plus`, label: `${label}加號`, x: 236, y: y + 6, w: 24, h: 20, group: "resource" },
      { id: `${id}_plus_hit`, label: `${label}加號點擊`, x: 232, y, w: 32, h: 32, group: "resource", hit: "control" },
    )
  })
  return nodes
}

function troopNodes(): UiNode[] {
  const nodes: UiNode[] = []
  TROOP_ROWS.forEach((label, index) => {
    const y = 542 + index * 24
    const id = `troop_${index}`
    nodes.push(
      { id, label, x: 12, y, w: 252, h: 24, group: "troops", fontRole: "body", fontSize: 12 },
      {
        id: `${id}_count`,
        label: `${label}數量`,
        x: 168,
        y,
        w: 84,
        h: 24,
        group: "troops",
        fontRole: "value",
        fontSize: 12,
      },
    )
  })
  return nodes
}

function chatNodes(): UiNode[] {
  const nodes: UiNode[] = []
  CHAT_TABS.forEach(([id, label], index) => {
    const x = 280 + index * 76
    nodes.push(
      { id, label, x, y: 654, w: 76, h: 22, group: "chat", fontRole: "body", fontSize: 10 },
      { id: `${id}_hit`, label: `${label}點擊`, x, y: 650, w: 76, h: 32, group: "chat", hit: "control" },
    )
  })
  nodes.push(
    { id: "chat_input", label: "輸入行", x: 280, y: 682, w: 383, h: 30, group: "chat" },
    {
      id: "chat_field",
      label: "輸入框",
      x: 280,
      y: 682,
      w: 331,
      h: 30,
      group: "chat",
      fontRole: "body",
      fontSize: 12,
    },
    { id: "chat_send", label: "發送", x: 611, y: 682, w: 52, h: 30, group: "chat", fontRole: "body", fontSize: 12 },
    { id: "chat_send_hit", label: "發送點擊", x: 611, y: 682, w: 52, h: 32, group: "chat", hit: "control" },
  )
  return nodes
}

function actionNodes(): UiNode[] {
  const nodes: UiNode[] = []
  ACTION_CELLS.forEach(([id, label, x, y]) => {
    const hitY = y === 653 ? 650 : 679
    nodes.push(
      { id, label, x, y, w: 140, h: 24, group: "actions", fontRole: "body", fontSize: 10 },
      { id: `${id}_hit`, label: `${label}點擊`, x, y: hitY, w: 140, h: 32, group: "actions", hit: "control" },
    )
  })
  SMALL_CELLS.forEach(([id, label, x]) => {
    nodes.push(
      { id, label, x, y: 703, w: 100, h: 16, group: "actions", fontRole: "body", fontSize: 10 },
      { id: `${id}_hit`, label: `${label}點擊`, x, y: 688, w: 100, h: 32, group: "actions", hit: "control" },
    )
  })
  return nodes
}

function queueNodes(): UiNode[] {
  const slots = [
    ["queue_farm", "農田隊列", 652],
    ["queue_storage", "倉庫隊列", 675],
    ["queue_wait", "排隊隊列", 698],
  ] as const
  const nodes: UiNode[] = []
  slots.forEach(([id, label, y], index) => {
    nodes.push(
      { id, label, x: 1122, y, w: 158, h: 22, group: "queue" },
      { id: `${id}_bar`, label: `${label}色條`, x: 1122, y, w: 4, h: 22, group: "queue" },
      {
        id: `${id}_name`,
        label: `${label}名稱`,
        x: 1128,
        y,
        w: 146,
        h: 10,
        group: "queue",
        fontRole: "body",
        fontSize: 10,
      },
      {
        id: `${id}_time`,
        label: `${label}倒數`,
        x: 1128,
        y: y + 10,
        w: 146,
        h: 12,
        group: "queue",
        fontRole: "value",
        fontSize: 12,
      },
    )
    if (index < slots.length - 1) {
      nodes.push({ id: `queue_sep_${index}`, label: "隊列分隔", x: 1122, y: y + 22, w: 158, h: 1, group: "queue" })
    }
  })
  return nodes
}

function baselineNodes(): UiNode[] {
  return [
    { id: "area_left", label: "左直欄", x: 0, y: 0, w: 276, h: 720, group: "area" },
    { id: "area_chat", label: "聊天列", x: 276, y: 650, w: 391, h: 70, group: "area" },
    { id: "area_actions", label: "功能格", x: 667, y: 650, w: 455, h: 70, group: "area" },
    { id: "area_queue", label: "建造隊列", x: 1122, y: 650, w: 158, h: 70, group: "area" },
    { id: "corner_cluster", label: "右上圓鈕區", x: 1206, y: 8, w: 44, h: 152, group: "corner" },
    { id: "ring_exit", label: "出城回城", x: 1208, y: 8, w: 40, h: 40, group: "corner", fontRole: "body", fontSize: 12 },
    { id: "ring_exit_hit", label: "出城回城點擊", x: 1206, y: 6, w: 44, h: 44, group: "corner", hit: "ring" },
    { id: "ring_explore", label: "探險", x: 1208, y: 52, w: 40, h: 40, group: "corner", fontRole: "body", fontSize: 12 },
    { id: "ring_explore_hit", label: "探險點擊", x: 1206, y: 50, w: 44, h: 44, group: "corner", hit: "ring" },
    { id: "ring_intel", label: "情報", x: 1208, y: 96, w: 40, h: 40, group: "corner", fontRole: "body", fontSize: 12 },
    { id: "ring_intel_hit", label: "情報點擊", x: 1206, y: 94, w: 44, h: 44, group: "corner", hit: "ring" },
    { id: "combat_drill", label: "校場", x: 288, y: 16, w: 168, h: 36, group: "combat", fontRole: "body", fontSize: 12, hit: "control" },
    { id: "combat_muster", label: "點兵場", x: 464, y: 16, w: 184, h: 36, group: "combat", fontRole: "body", fontSize: 12, hit: "control" },
    { id: "monarch_card", label: "君主卡", x: 0, y: 0, w: 276, h: 112, group: "left" },
    { id: "avatar", label: "頭像框", x: 12, y: 12, w: 72, h: 72, group: "left" },
    { id: "monarch_name", label: "君主名", x: 92, y: 12, w: 120, h: 26, group: "left", fontRole: "body", fontSize: 22 },
    { id: "prestige", label: "聲望", x: 92, y: 40, w: 78, h: 18, group: "left", fontRole: "value", fontSize: 12 },
    { id: "peerage", label: "爵位", x: 92, y: 60, w: 100, h: 18, group: "left", fontRole: "body", fontSize: 12 },
    { id: "alliance", label: "聯盟", x: 92, y: 80, w: 100, h: 10, group: "left", fontRole: "body", fontSize: 10 },
    { id: "treasury", label: "寶庫", x: 196, y: 10, w: 36, h: 26, group: "left", fontRole: "body", fontSize: 10 },
    { id: "treasury_hit", label: "寶庫點擊", x: 196, y: 8, w: 36, h: 32, group: "left", hit: "control" },
    { id: "mail", label: "信件", x: 238, y: 10, w: 30, h: 26, group: "left", fontRole: "body", fontSize: 10 },
    { id: "mail_hit", label: "信件點擊", x: 236, y: 8, w: 32, h: 32, group: "left", hit: "control" },
    { id: "salary", label: "領俸祿", x: 12, y: 90, w: 84, h: 18, group: "left", fontRole: "body", fontSize: 10 },
    { id: "salary_hit", label: "領俸祿點擊", x: 12, y: 80, w: 84, h: 32, group: "left", hit: "control" },
    { id: "ranking", label: "排行", x: 102, y: 90, w: 60, h: 18, group: "left", fontRole: "body", fontSize: 10 },
    { id: "ranking_hit", label: "排行點擊", x: 102, y: 80, w: 60, h: 32, group: "left", hit: "control" },
    { id: "city_name", label: "城池名列", x: 0, y: 112, w: 276, h: 32, group: "left", fontRole: "body", fontSize: 16 },
    ...resourceNodes(),
    { id: "general_panel", label: "武將面板", x: 0, y: 368, w: 276, h: 352, group: "left" },
    { id: "tab_general", label: "武將", x: 12, y: 376, w: 64, h: 26, group: "left", fontRole: "body", fontSize: 12 },
    { id: "tab_general_hit", label: "武將點擊", x: 12, y: 373, w: 64, h: 32, group: "left", hit: "control" },
    { id: "tab_troops", label: "兵力", x: 78, y: 376, w: 64, h: 26, group: "left", fontRole: "body", fontSize: 12 },
    { id: "tab_troops_hit", label: "兵力點擊", x: 78, y: 373, w: 64, h: 32, group: "left", hit: "control" },
    { id: "general_card", label: "武將卡", x: 12, y: 410, w: 252, h: 120, group: "left" },
    { id: "general_name", label: "武將名", x: 24, y: 422, w: 220, h: 22, group: "left", fontRole: "body", fontSize: 16 },
    { id: "general_stat", label: "武將數值", x: 24, y: 450, w: 220, h: 18, group: "left", fontRole: "value", fontSize: 12 },
    ...troopNodes(),
    ...chatNodes(),
    ...actionNodes(),
    ...queueNodes(),
  ]
}

export const UI_1280: UiProfile = {
  screenW: 1280,
  screenH: 720,
  safe: { x: 276, y: 0, w: 1004, h: 650 },
  camera: { anchorX: 778, anchorY: 325 },
  borderOuter: 2,
  borderInner: 1,
  nodes: baselineNodes(),
}

export function scale<T>(value: T, factor: number): T {
  if (typeof value === "number") return (value * factor) as T
  if (Array.isArray(value)) return value.map((item) => scale(item, factor)) as T
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) output[key] = scale(item, factor)
    return output as T
  }
  return value
}

export const UI_1920: UiProfile = scale(UI_1280, 1.5)

const areaWidth = UI_1280.nodes
  .filter((item) => item.group === "area")
  .reduce((sum, item) => sum + item.w, 0)

if (areaWidth !== UI_1280.screenW) {
  throw new Error(`city ui areas must sum to ${UI_1280.screenW}, got ${areaWidth}`)
}

export function uiNode(profile: UiProfile, id: string): UiNode {
  const found = profile.nodes.find((item) => item.id === id)
  if (!found) throw new Error(`unknown ui node ${id}`)
  return found
}

export function controlNode(profile: UiProfile, id: string): UiNode {
  return profile.nodes.find((item) => item.id === `${id}_hit`) ?? uiNode(profile, id)
}

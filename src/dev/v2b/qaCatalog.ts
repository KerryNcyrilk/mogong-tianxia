/** 音效、Toast、離線秒數。文案沿用主城既有句子，不新增一套彈窗。 */
export const SFX_TRACKS = [
  { id: "click", label: "點擊" },
  { id: "bell", label: "鐘聲" },
  { id: "horn", label: "號角" },
  { id: "clash", label: "交擊" },
  { id: "drum", label: "戰鼓" },
] as const

export const TOAST_PRESETS = [
  { id: "resource", text: "資源不足" },
  { id: "queue", text: "營造隊列已滿" },
  { id: "pop", text: "人口已滿" },
  { id: "level", text: "官府 升至 Lv.2" },
  { id: "mute", text: "已靜音" },
  { id: "sound", text: "音效已開" },
] as const

export const OFFLINE_PRESETS = [
  { id: "1m", label: "1 分", seconds: 60 },
  { id: "10m", label: "10 分", seconds: 600 },
  { id: "1h", label: "1 小時", seconds: 3600 },
  { id: "2h", label: "2 小時", seconds: 7200 },
  { id: "12h", label: "12 小時", seconds: 12 * 3600 },
] as const

export type SfxId = (typeof SFX_TRACKS)[number]["id"]

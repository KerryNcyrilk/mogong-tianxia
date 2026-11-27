/** Board3D（2.5D 棋盤）參數化：只存記憶體＋localStorage，零改紅線資料檔。 */
export interface Board3DPreset {
  /** CSS perspective，600–2500px */
  perspective: number
  /** rotateX 角度，0–60° */
  rotateX: number
  /** 整體縮放，0.7–1.15 */
  scale: number
  /** 棋盤底部落影高度（px），0–48 */
  lift: number
}

export const PRESET_KEY = "mg_board3d_preset_v1"
export const PRESET_EVENT = "mg-board3d-preset"

export const B3D_RANGES = {
  perspective: [600, 2500] as const,
  rotateX: [0, 60] as const,
  scale: [0.7, 1.15] as const,
  lift: [0, 48] as const,
}

export const DEFAULT_BOARD3D: Board3DPreset = { perspective: 1500, rotateX: 33, scale: 0.9, lift: 0 }

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function clampPreset(raw: Partial<Board3DPreset>): Board3DPreset {
  return {
    perspective: Math.round(clamp(Number(raw.perspective), B3D_RANGES.perspective[0], B3D_RANGES.perspective[1], DEFAULT_BOARD3D.perspective)),
    rotateX: Math.round(clamp(Number(raw.rotateX), B3D_RANGES.rotateX[0], B3D_RANGES.rotateX[1], DEFAULT_BOARD3D.rotateX)),
    scale: Math.round(clamp(Number(raw.scale), B3D_RANGES.scale[0], B3D_RANGES.scale[1], DEFAULT_BOARD3D.scale) * 100) / 100,
    lift: Math.round(clamp(Number(raw.lift), B3D_RANGES.lift[0], B3D_RANGES.lift[1], DEFAULT_BOARD3D.lift)),
  }
}

/** `?b3d=1500,33,0.9` 這類證據／開發參數。 */
export function parsePresetQuery(value: string | null | undefined): Board3DPreset | null {
  if (!value) return null
  const parts = value.split(",").map((item) => Number(item.trim()))
  if (parts.length < 2 || parts.some((item) => !Number.isFinite(item))) return null
  return clampPreset({ perspective: parts[0], rotateX: parts[1], scale: parts[2], lift: parts[3] })
}

export function loadPreset(): Board3DPreset {
  if (typeof window === "undefined") return DEFAULT_BOARD3D
  let query: Board3DPreset | null = null
  try {
    query = parsePresetQuery(new URLSearchParams(window.location.search).get("b3d"))
  } catch {
    query = null
  }
  if (query) return query
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    if (!raw) return DEFAULT_BOARD3D
    return clampPreset(JSON.parse(raw) as Partial<Board3DPreset>)
  } catch {
    return DEFAULT_BOARD3D
  }
}

export function savePreset(preset: Board3DPreset): void {
  const safe = clampPreset(preset)
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(safe))
  } catch {
    // 私隱模式忽略
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PRESET_EVENT))
}

export function clearPreset(): void {
  try {
    localStorage.removeItem(PRESET_KEY)
  } catch {
    // 私隱模式忽略
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PRESET_EVENT))
}

export function presetToCss(preset: Board3DPreset): { wrapper: Record<string, string>; board: Record<string, string> } {
  return {
    wrapper: {
      perspective: `${preset.perspective}px`,
      perspectiveOrigin: "50% 0%",
      padding: "4px 0 64px",
    },
    board: {
      transform: `rotateX(${preset.rotateX}deg) scale(${preset.scale})`,
      transformOrigin: "50% 46%",
      marginBottom: `${preset.lift}px`,
    },
  }
}

/** 可匯出成 `board3d-preset.json` 的內容。 */
export function presetJson(preset: Board3DPreset): string {
  return JSON.stringify({ schema: "board3d-preset.v1", preset: clampPreset(preset) }, null, 2)
}

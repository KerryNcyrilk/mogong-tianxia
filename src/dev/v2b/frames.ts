import { UI_1280, UI_1920 } from "../../ui/city/tokens.ts"

export interface FrameBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FramePreset {
  id: "1280" | "1366" | "1920"
  w: number
  h: number
  /** 1366 沒有官方安全區，保持 null。 */
  safe: FrameBox | null
}

export const FRAME_PRESETS: readonly FramePreset[] = [
  { id: "1280", w: UI_1280.screenW, h: UI_1280.screenH, safe: { ...UI_1280.safe } },
  { id: "1366", w: 1366, h: 768, safe: null },
  { id: "1920", w: UI_1920.screenW, h: UI_1920.screenH, safe: { ...UI_1920.safe } },
]

export function frameById(id: string): FramePreset | null {
  return FRAME_PRESETS.find((item) => item.id === id) ?? null
}

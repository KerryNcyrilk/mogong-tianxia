import { artboardFrame, profileOf, v3CoverFrame, type ScreenBox } from "../../ui/city/rects.ts"

export interface MapFrames {
  scale: number
  leftW: number
  barH: number
  mapW: number
  mapH: number
  /** 主城實際鋪圖框（zoom 0.4 不夠大時會拉滿安全區）。 */
  cover: ScreenBox
  /** 未拉伸的 zoom=0.4 畫框。 */
  zoom04: ScreenBox
}

/**
 * 與 CityScreen 同一組版面：左欄 276、底欄 70、vh>950 用 1920 檔、v3 固定 zoom 0.4。
 * 多邊形疊在 cover 上；zoom=0.4 邊界畫 zoom04。
 */
export function mapFrames(vw: number, vh: number): MapFrames {
  const scale = Math.max(0.72, Math.min(vh / 720, 1.9))
  const leftW = 276 * scale
  const barH = 70 * scale
  const mapW = Math.max(320, vw - leftW)
  const mapH = Math.max(240, vh - barH)
  const profile = profileOf(vh > 950 ? 1920 : 1280)
  const fitted = { ...profile, screenW: mapW, screenH: mapH, safe: { x: 0, y: 0, w: mapW, h: mapH } }
  return {
    scale,
    leftW,
    barH,
    mapW,
    mapH,
    cover: v3CoverFrame(0.4, fitted),
    zoom04: artboardFrame(0.4, fitted),
  }
}

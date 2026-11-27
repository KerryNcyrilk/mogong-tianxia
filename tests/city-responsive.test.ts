import { describe, expect, it } from "vitest"
import { COMPACT_BREAKPOINT, cityFrame } from "../src/ui/city/rects.ts"

describe("主城版面自適應", () => {
  it("窄屏（手機直向）地圖鋪滿整屏，唔留左欄", () => {
    const f = cityFrame(390, 844)
    expect(f.compact).toBe(true)
    expect(f.leftW).toBe(0)
    expect(f.mapW).toBe(390)
    expect(f.mapH).toBe(844 - f.barH)
    expect(f.mapH).toBeGreaterThan(600)
    expect(f.drawerScale).toBeGreaterThan(0.9)
  })

  it("手機橫向同樣鋪滿", () => {
    const f = cityFrame(844, 390)
    expect(f.compact).toBe(true)
    expect(f.mapW).toBe(844)
    expect(f.mapH).toBe(390 - f.barH)
    expect(f.barH).toBeGreaterThanOrEqual(86)
  })

  it("橫向桌面維持左欄＋底欄，且總寬剛好等於視窗", () => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]] as const) {
      const f = cityFrame(w, h)
      expect(f.compact).toBe(false)
      expect(f.leftW + f.mapW).toBe(w)
      expect(f.mapH + f.barH).toBeCloseTo(h, 6)
      expect(f.mapW).toBeGreaterThan(w * 0.6)
    }
  })

  it("斷點兩側行為一致，唔會出現 mapW 被 max(320) 頂爆", () => {
    expect(cityFrame(COMPACT_BREAKPOINT - 1, 800).compact).toBe(true)
    expect(cityFrame(COMPACT_BREAKPOINT, 800).compact).toBe(false)
    for (const w of [320, 390, 480, 768, 899]) {
      const f = cityFrame(w, 720)
      expect(f.mapW).toBe(w)
      expect(f.mapH).toBeGreaterThan(0)
    }
  })
})

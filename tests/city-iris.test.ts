import raw from "../data/cityLayout.json" with { type: "json" }
import { DEFAULT_FOCUS, clampFocusPoint, tileFocusPoint, worldToFocusTile } from "../src/city/camera.ts"
import { zoneAabb, zoneToProjectedPolygon } from "../src/city/coords.ts"
import { parseCityLayout } from "../src/city/layout.ts"
import { fitDisplay } from "../src/ui/city/display.ts"
import { SAFE_RECT, worldBoxToScreen } from "../src/ui/city/rects.ts"
import { UI_1280 } from "../src/ui/city/tokens.ts"
import { describe, expect, it } from "vitest"

const layout = parseCityLayout(raw)

function screenBox(id: string, zoom: number) {
  const zone = layout.zones.find((item) => item.id === id)
  if (!zone) throw new Error(`missing ${id}`)
  return worldBoxToScreen(zoneAabb(zone), zoom, UI_1280)
}

function contains(outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.w <= outer.x + outer.w + 1e-6 &&
    inner.y + inner.h <= outer.y + outer.h + 1e-6
  )
}

describe("iris v1 city", () => {
  it("loads the 28×24 layout and the official focus", () => {
    expect(layout.grid.cols).toBe(28)
    expect(layout.grid.rows).toBe(24)
    expect(layout.zones).toHaveLength(37)
    expect(layout.zones.find((zone) => zone.id === "gate_s")).toMatchObject({ x: 9, y: 22, w: 3, h: 2 })
    expect(layout.zones.find((zone) => zone.id === "gov")).toMatchObject({ x: 13, y: 8, w: 7, h: 8 })
    expect(layout.zones.find((zone) => zone.id === "drill")).toMatchObject({ x: 4, y: 8, w: 7, h: 8 })
    expect(layout.zones.find((zone) => zone.id === "beacon")).toMatchObject({ x: 26, y: 2, w: 2, h: 2 })
    expect(zoneToProjectedPolygon({ x: 0, y: 0, w: 1, h: 1 })[0]).toEqual({ x: 1200, y: 192 })
    expect(zoneToProjectedPolygon({ x: 0, y: 23, w: 1, h: 1 })[0]).toEqual({ x: 96, y: 744 })
    expect(zoneToProjectedPolygon({ x: 27, y: 0, w: 1, h: 1 })[0]).toEqual({ x: 2496, y: 840 })
    expect(DEFAULT_FOCUS).toEqual(tileFocusPoint(14, 13))
    expect(clampFocusPoint(DEFAULT_FOCUS)).toEqual(DEFAULT_FOCUS)
    expect(clampFocusPoint(tileFocusPoint(0, 40))).toEqual(tileFocusPoint(1, 22))
    const edge = clampFocusPoint({ x: -4000, y: 8000 })
    const tile = worldToFocusTile(edge)
    expect(tile.col).toBeGreaterThanOrEqual(1)
    expect(tile.col).toBeLessThanOrEqual(26)
    expect(tile.row).toBeGreaterThanOrEqual(0)
    expect(tile.row).toBeLessThanOrEqual(22)
  })

  it("keeps gov, drill, and the south gate inside the safe rect", () => {
    for (const id of ["gov", "drill", "gate_s"]) {
      expect(contains(SAFE_RECT, screenBox(id, 0.5))).toBe(true)
    }
  })

  it("looks from the south toward the north at zoom 0.4", () => {
    const gate = screenBox("gate_s", 0.4)
    const north = screenBox("wall_n", 0.4)
    const forest = screenBox("forest", 0.4)
    expect(gate.y + gate.h / 2).toBeGreaterThan(north.y + north.h / 2)
    expect(gate.x + gate.w / 2).toBeLessThan(640)
    expect(forest.y).toBeLessThan(gate.y)
    for (const id of ["wall_w", "wall_e", "wall_s_w", "forest", "beacon"]) {
      const box = screenBox(id, 0.4)
      expect(box.x + box.w).toBeGreaterThan(276)
      expect(box.x).toBeLessThan(1280)
      expect(box.y + box.h).toBeGreaterThan(0)
      expect(box.y).toBeLessThan(650)
    }
  })

  it("scales the HUD from the 1280×720 frame", () => {
    expect(fitDisplay(1280, 720).scale).toBe(1)
    expect(fitDisplay(1600, 900).scale).toBe(1.25)
    expect(fitDisplay(1920, 1080).scale).toBe(1.5)
    expect(fitDisplay(2560, 1440).scale).toBe(2)
    expect(fitDisplay(3840, 2160).scale).toBe(2)
    const wide = fitDisplay(2560, 1080)
    expect(wide.scale).toBe(1.5)
    expect(wide.hudX).toBeGreaterThan(0)
    expect(fitDisplay(1440, 900).hudY).toBeGreaterThan(0)
    const portrait = fitDisplay(720, 1280)
    expect(portrait.portrait).toBe(true)
    expect(portrait.scale).toBe(0.75)
  })
})

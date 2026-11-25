import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { zoneToProjectedPolygon } from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"

/**
 * B7 預留接口：把整城熱區描成 data/cityHotspots.json。
 * 現階段用 cityLayout.json 的區塊 AABB 作佔位多邊形；Iris 交出
 * public/art/v3/city_overview_2496x1440.png 後，同一 schema 直接換成手描多邊形即可。
 */
const ARTBOARD = { w: 2496, h: 1440 }
const ART_ORIGIN = { x: 1056, y: 192 }

const HOTSPOTS = [
  { id: "gov", zone: "gov", label: "官府", action: "官府" },
  { id: "drill", zone: "drill", label: "校場", action: "出征" },
  { id: "barrack", zone: "barrack", label: "點兵場", action: "徵兵" },
  { id: "market", zone: "market", label: "市集", action: "市集" },
  { id: "gate_s", zone: "gate_s", label: "南門", action: "出城" },
  { id: "farm", zone: "farm", label: "農田", action: "農田" },
  { id: "storage", zone: "storage", label: "倉庫", action: "倉庫" },
  { id: "barracks", zone: "barracks", label: "兵營", action: "兵營" },
]

const layout = loadCityLayoutFile()
const zones = layout.zones

const hotspots = HOTSPOTS.map((entry) => {
  const zone = zones.find((item) => item.id === entry.zone)
  if (!zone) throw new Error(`missing zone ${entry.zone}`)
  // 直接用投影後的多邊形（等軸菱形四點），不是 AABB：熱區要貼住建築本身。
  const projected = zoneToProjectedPolygon(zone, ART_ORIGIN)
  const points = []
  for (const point of projected) {
    const rounded = { x: Math.round(point.x), y: Math.round(point.y) }
    if (!points.some((item) => item.x === rounded.x && item.y === rounded.y)) points.push(rounded)
  }
  for (const point of points) {
    if (point.x < 0 || point.y < 0 || point.x > ARTBOARD.w || point.y > ARTBOARD.h) {
      throw new Error(`hotspot ${entry.id} out of artboard`)
    }
  }
  return { id: entry.id, label: entry.label, action: entry.action, polygon: points }
})

const out = {
  schemaVersion: "cityHotspots.b7.v0.1",
  source: "scripts/hotspots-build.mjs（讀 data/cityLayout.json，佔位多邊形；Iris 交整城底圖後同 schema 換手描）",
  canvas: ARTBOARD,
  origin: ART_ORIGIN,
  hotspots,
}

const path = resolve(import.meta.dirname, "../data/cityHotspots.json")
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, "utf8")
process.stdout.write(`wrote ${path} (${hotspots.length} hotspots)\n`)

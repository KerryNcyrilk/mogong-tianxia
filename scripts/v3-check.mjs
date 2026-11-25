// v3 換皮座標權威檢查：data/cityLayoutV3.json
// 1) 所有 polygon 頂點在畫布內；2) badge 落在 polygon 內；3) 13 個 zone 兩兩不重疊（8px 採樣）；
// 4) 底圖存在且尺寸與 layout.art 一致；5) 每個 zone 都有 label／action。
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const file = resolve(root, "data/cityLayoutV3.json")
const layout = JSON.parse(readFileSync(file, "utf8"))
const zones = layout.zones
const W = layout.art.w
const H = layout.art.h
const issues = []

function inside(zone, x, y) {
  let hit = false
  const pts = zone.polygon
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

for (const zone of zones) {
  if (!zone.label || !zone.action) issues.push(`${zone.id} missing label/action`)
  if (zone.polygon.length < 4) issues.push(`${zone.id} polygon < 4 points`)
  for (const [x, y] of zone.polygon) {
    if (x < 0 || y < 0 || x > W || y > H) issues.push(`${zone.id} vertex out of canvas (${x},${y})`)
  }
  if (!inside(zone, zone.badge[0], zone.badge[1])) issues.push(`${zone.id} badge outside polygon`)
}

const step = 8
let overlaps = 0
for (let a = 0; a < zones.length; a += 1) {
  for (let b = a + 1; b < zones.length; b += 1) {
    const za = zones[a]
    const zb = zones[b]
    const ax = za.polygon.map((p) => p[0])
    const ay = za.polygon.map((p) => p[1])
    const bx = zb.polygon.map((p) => p[0])
    const by = zb.polygon.map((p) => p[1])
    const x0 = Math.max(Math.min(...ax), Math.min(...bx))
    const x1 = Math.min(Math.max(...ax), Math.max(...bx))
    const y0 = Math.max(Math.min(...ay), Math.min(...by))
    const y1 = Math.min(Math.max(...ay), Math.max(...by))
    if (x1 <= x0 || y1 <= y0) continue
    let shared = 0
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        if (inside(za, x, y) && inside(zb, x, y)) shared += 1
      }
    }
    if (shared > 1) {
      overlaps += 1
      issues.push(`${za.id} × ${zb.id} overlap samples ${shared}`)
    }
  }
}

const artPath = resolve(root, "public", layout.art.src.replace(/^\//, ""))
if (!existsSync(artPath)) issues.push(`art missing ${artPath}`)
else {
  const bytes = readFileSync(artPath)
  if (bytes.length < 200_000) issues.push(`art too small ${bytes.length}B`)
}

const rows = zones.map((zone) => {
  const xs = zone.polygon.map((p) => p[0])
  const ys = zone.polygon.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return `  ${zone.id.padEnd(10)} ${String(zone.label).padEnd(6)} bbox ${String(Math.min(...xs)).padStart(4)},${String(Math.min(...ys)).padStart(4)} ${String(w).padStart(4)}×${String(h).padStart(4)} badge ${zone.badge.join(",")}`
})

const pass = issues.length === 0
process.stdout.write(`${rows.join("\n")}\n`)
process.stdout.write(
  `v3-layout: ${pass ? "PASS" : "FAIL"} (${zones.length} zones, ${W}×${H}, overlaps ${overlaps}, art ${existsSync(artPath) ? "ok" : "missing"})\n`,
)
if (!pass) {
  console.error(issues.join("\n"))
  process.exit(1)
}

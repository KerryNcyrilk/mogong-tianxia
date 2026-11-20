import { CELL, COLS, ROWS, TILE_H } from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"

/** Ids in data/cityLayout.json order. md5 e380c3abaea0e451008b2c03fcd5ae13. */
const EXPECTED_IDS = [
  "wall_n",
  "wall_w",
  "wall_e",
  "wall_s_a",
  "wall_s_b",
  "gate_s",
  "road_main",
  "road_gate_link",
  "road_v3",
  "road_h1",
  "road_h2",
  "road_v2",
  "plaza",
  "gov",
  "drill",
  "drill_ground",
  "barrack",
  "horse",
  "market",
  "infirmary",
  "shrine",
  "house_w",
  "house_e",
  "farm",
  "pond",
  "cherry",
  "grove_nw",
  "grove_ne",
  "storage",
  "barracks",
  "herb",
]

const OVERLAP_WHITELIST = [["drill", "drill_ground"]]

function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function contains(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

function insideBoard(zone) {
  return (
    Number.isInteger(zone.x) &&
    Number.isInteger(zone.y) &&
    Number.isInteger(zone.w) &&
    Number.isInteger(zone.h) &&
    zone.w >= 1 &&
    zone.h >= 1 &&
    zone.x >= 0 &&
    zone.y >= 0 &&
    zone.x + zone.w <= COLS &&
    zone.y + zone.h <= ROWS
  )
}

function whitelisted(a, b) {
  const left = a < b ? a : b
  const right = a < b ? b : a
  return OVERLAP_WHITELIST.some(([p, q]) => p === left && q === right)
}

function pairName(a, b) {
  return a < b ? `${a}×${b}` : `${b}×${a}`
}

function overlapConflicts(zones) {
  const conflicts = []
  for (let i = 0; i < zones.length; i += 1) {
    const left = zones[i]
    for (let j = i + 1; j < zones.length; j += 1) {
      const right = zones[j]
      if (!intersects(left, right) || whitelisted(left.id, right.id)) continue
      conflicts.push(pairName(left.id, right.id))
    }
  }
  conflicts.sort()
  return conflicts
}

function drillClear(zones) {
  const drill = zones.find((zone) => zone.id === "drill")
  const ground = zones.find((zone) => zone.id === "drill_ground")
  if (!drill || !ground || !contains(drill, ground)) return "FAIL"
  const blocked = zones.some(
    (zone) => zone.id !== "drill" && zone.id !== "drill_ground" && intersects(zone, ground),
  )
  return blocked ? "FAIL" : "PASS"
}

function idsMatch(zones) {
  if (zones.length !== 31 || EXPECTED_IDS.length !== 31) return false
  if (new Set(EXPECTED_IDS).size !== 31) return false
  const seen = new Set(zones.map((zone) => zone.id))
  if (seen.size !== 31) return false
  return EXPECTED_IDS.every((id) => seen.has(id))
}

function gridMatches(grid) {
  return grid.tile_px === CELL && grid.tile_h_px === TILE_H && grid.cols === COLS && grid.rows === ROWS
}

let layout
try {
  layout = loadCityLayoutFile()
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

const zones = layout.zones
const conflicts = overlapConflicts(zones)
const bounds = zones.every(insideBoard) ? "PASS" : "FAIL"
const overlap = conflicts.length === 0 ? "PASS" : "FAIL"
const overlapTail = conflicts.length === 0 ? "" : ` ${conflicts.join(" ")}`
const clear = drillClear(zones)
const delivery = idsMatch(zones) && gridMatches(layout.grid) ? "PASS" : "FAIL"

process.stdout.write(
  [
    `zones: ${zones.length}`,
    `bounds: ${bounds}`,
    `overlap: ${overlap} (${conflicts.length} conflicts)${overlapTail}`,
    `drill-clear: ${clear}`,
    `delivery: ${delivery}`,
  ].join("\n") + "\n",
)

process.exit(bounds === "PASS" && overlap === "PASS" && clear === "PASS" && delivery === "PASS" ? 0 : 1)

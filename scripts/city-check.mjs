import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  ARTBOARD_H,
  ARTBOARD_W,
  CELL,
  COLS,
  ORIGIN_X,
  ORIGIN_Y,
  PROJECTED_H,
  PROJECTED_W,
  ROWS,
  TILE_H,
  zoneToProjectedPolygon,
} from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"

const RETIRED_MD5 = "e380c3abaea0e451008b2c03fcd5ae13"

/** Iris v1 zone order and footprints. Do not invent coordinates. */
const EXPECTED = [
  ["forest", 1, 0, 5, 3],
  ["iron_mine", 7, 0, 5, 3],
  ["farm", 16, 0, 5, 3],
  ["quarry", 22, 0, 4, 3],
  ["wall_n", 0, 3, 28, 1],
  ["wall_w", 0, 4, 1, 19],
  ["wall_e", 27, 4, 1, 19],
  ["wall_s_w", 0, 23, 9, 1],
  ["gate_s", 9, 22, 3, 2],
  ["wall_s_e", 12, 23, 16, 1],
  ["beacon", 26, 2, 2, 2],
  ["blacksmith", 1, 5, 3, 3],
  ["stable", 4, 4, 4, 3],
  ["barracks", 8, 4, 3, 2],
  ["house_w", 1, 8, 3, 8],
  ["warehouse", 1, 16, 3, 3],
  ["house_sw", 1, 19, 3, 3],
  ["drill_row", 4, 7, 4, 1],
  ["drill", 4, 8, 7, 8],
  ["road_main", 11, 6, 2, 16],
  ["road_east", 20, 4, 1, 18],
  ["road_gate", 9, 21, 4, 1],
  ["market", 13, 4, 6, 3],
  ["gov", 13, 8, 7, 8],
  ["plaza", 13, 16, 7, 2],
  ["road_mid", 4, 16, 7, 2],
  ["house_c", 4, 18, 4, 4],
  ["house_s", 13, 18, 7, 4],
  ["council", 8, 19, 3, 2],
  ["academy", 21, 4, 3, 3],
  ["staff_hall", 24, 4, 3, 3],
  ["cherry", 21, 7, 3, 3],
  ["warrior_lodge", 24, 7, 3, 3],
  ["clinic", 21, 10, 3, 3],
  ["pond", 24, 10, 3, 3],
  ["embassy", 23, 13, 4, 3],
  ["house_e", 21, 16, 6, 6],
]

/** Overlaps that are drawn in the Iris file: beacon sits on the north wall, the gate road joins the main road. */
const OVERLAP_WHITELIST = [
  ["beacon", "wall_n"],
  ["road_gate", "road_main"],
]

const here = dirname(fileURLToPath(import.meta.url))

function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
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
  if (!drill || drill.x !== 4 || drill.y !== 8 || drill.w !== 7 || drill.h !== 8) return "FAIL"
  const blocked = zones.some((zone) => zone.id !== "drill" && intersects(zone, drill))
  return blocked ? "FAIL" : "PASS"
}

function gateLine(zones) {
  const gates = zones.filter((zone) => zone.kind === "gate")
  const gate = zones.find((zone) => zone.id === "gate_s")
  const pass =
    gates.length === 1 &&
    gate &&
    gate.kind === "gate" &&
    gate.x === 9 &&
    gate.y === 22 &&
    gate.w === 3 &&
    gate.h === 2 &&
    !zones.some((zone) => zone.kind === "gate" && zone.y <= 3)
  return pass ? "PASS" : "FAIL"
}

function beaconLine(zones) {
  const beacon = zones.find((zone) => zone.id === "beacon")
  const wall = zones.find((zone) => zone.id === "wall_n")
  const pass =
    beacon &&
    wall &&
    beacon.x === 26 &&
    beacon.y === 2 &&
    beacon.w === 2 &&
    beacon.h === 2 &&
    beacon.y + beacon.h <= 4 &&
    intersects(beacon, wall)
  return pass ? "PASS" : "FAIL"
}

function beltLine(zones) {
  const ids = ["forest", "iron_mine", "farm", "quarry"]
  const pass = ids.every((id) => {
    const zone = zones.find((item) => item.id === id)
    return zone && zone.y === 0 && zone.y + zone.h === 3
  })
  return pass ? "PASS" : "FAIL"
}

function delivery(zones, grid) {
  if (zones.length !== 37 || EXPECTED.length !== 37) return false
  if (grid.tile_px !== CELL || grid.tile_h_px !== TILE_H || grid.cols !== COLS || grid.rows !== ROWS) return false
  if (grid.originX !== ORIGIN_X || grid.originY !== ORIGIN_Y) return false
  if (grid.artboardW !== ARTBOARD_W || grid.artboardH !== ARTBOARD_H) return false
  if (grid.planeW !== PROJECTED_W || grid.planeH !== PROJECTED_H) return false
  return EXPECTED.every((row, index) => {
    const zone = zones[index]
    return zone.id === row[0] && zone.x === row[1] && zone.y === row[2] && zone.w === row[3] && zone.h === row[4]
  })
}

function originOk() {
  const north = zoneToProjectedPolygon({ x: 0, y: 0, w: 1, h: 1 })
  const southWest = zoneToProjectedPolygon({ x: 0, y: 23, w: 1, h: 1 })
  const northEast = zoneToProjectedPolygon({ x: 27, y: 0, w: 1, h: 1 })
  return (
    COLS === 28 &&
    ROWS === 24 &&
    ORIGIN_X === 1200 &&
    ORIGIN_Y === 192 &&
    PROJECTED_W === 2496 &&
    PROJECTED_H === 1248 &&
    ARTBOARD_W === 2688 &&
    ARTBOARD_H === 1536 &&
    north[0].x === 1200 &&
    north[0].y === 192 &&
    southWest[0].x === 96 &&
    southWest[0].y === 744 &&
    northEast[0].x === 2496 &&
    northEast[0].y === 840
  )
}

function hashes() {
  const current = readFileSync(resolve(here, "../data/cityLayout.json"))
  const archive = readFileSync(resolve(here, "../data/archive/cityLayout.doubao-28x20.NOT-AUTHORITATIVE.json"))
  const currentMd5 = createHash("md5").update(current).digest("hex")
  const archiveMd5 = createHash("md5").update(archive).digest("hex")
  return { currentMd5, archiveMd5, pass: archiveMd5 === RETIRED_MD5 && currentMd5 !== RETIRED_MD5 }
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
const gate = gateLine(zones)
const beacon = beaconLine(zones)
const belt = beltLine(zones)
const origin = originOk() ? "PASS" : "FAIL"
const hash = hashes()
const authority = hash.pass ? "PASS" : "FAIL"
const delivered = delivery(zones, layout.grid) ? "PASS" : "FAIL"

if (!hash.pass) {
  console.error(`authority current=${hash.currentMd5} archive=${hash.archiveMd5}`)
}

process.stdout.write(
  [
    `grid: ${COLS}×${ROWS}`,
    `origin: ${ORIGIN_X},${ORIGIN_Y} ${origin}`,
    `zones: ${zones.length}`,
    `bounds: ${bounds}`,
    `overlap: ${overlap} (${conflicts.length} conflicts)${overlapTail}`,
    `drill-clear: ${clear}`,
    `gate: ${gate}`,
    `beacon: ${beacon}`,
    `belt: ${belt}`,
    `authority: ${authority}`,
    `delivery: ${delivered}`,
  ].join("\n") + "\n",
)

process.exit(
  bounds === "PASS" &&
    overlap === "PASS" &&
    clear === "PASS" &&
    gate === "PASS" &&
    beacon === "PASS" &&
    belt === "PASS" &&
    origin === "PASS" &&
    authority === "PASS" &&
    delivered === "PASS"
    ? 0
    : 1,
)

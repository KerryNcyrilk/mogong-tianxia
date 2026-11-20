/**
 * Loader for data/cityLayout.json.
 * Field names stay as they are in the official file.
 * v1 role / builtin / campus / kebab-case ids are not accepted.
 * barrack (營房) and barracks (兵營) are different kinds.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CELL, COLS, ROWS, TILE_H } from "./coords.ts"

const ID_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/

/** Closed set of layer values on the official file. */
export const LAYERS = ["wall", "ground", "building", "deco"] as const

export type CityLayer = (typeof LAYERS)[number]

/**
 * Closed set of kind values that actually appear in data/cityLayout.json
 * (md5 e380c3abaea0e451008b2c03fcd5ae13). Do not merge barrack and barracks.
 */
export const ZONE_KINDS = [
  "barrack",
  "barracks",
  "cherry",
  "clinic",
  "dirt",
  "drill_field",
  "farm",
  "gate",
  "gov",
  "house",
  "market",
  "plaza",
  "road_main",
  "road_minor",
  "shrine",
  "stable",
  "storage",
  "tree",
  "wall",
  "water",
] as const

export type ZoneKind = (typeof ZONE_KINDS)[number]

export interface CityZone {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  layer: CityLayer
  kind: ZoneKind
  sprite: string
  count?: number
  note?: string
}

export type CityMeta = Record<string, unknown>

export interface CityGrid {
  tile_px: number
  tile_h_px: number
  cols: number
  rows: number
}

export interface CityLayout {
  meta: CityMeta
  grid: CityGrid
  zones: CityZone[]
}

const defaultLayoutPath = fileURLToPath(new URL("../../data/cityLayout.json", import.meta.url))

function fail(message: string): never {
  throw new Error(`city layout: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCityLayer(value: string): value is CityLayer {
  return (LAYERS as readonly string[]).includes(value)
}

function isZoneKind(value: string): value is ZoneKind {
  return (ZONE_KINDS as readonly string[]).includes(value)
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${label} must be an integer`)
  return value
}

function readZone(value: unknown, index: number): CityZone {
  if (!isRecord(value)) fail(`zones[${index}] must be an object`)
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) {
    const shown = typeof value.id === "string" ? JSON.stringify(value.id) : "missing"
    fail(`zones[${index}] id ${shown} must match ${ID_PATTERN}`)
  }
  const id = value.id
  if (typeof value.name !== "string" || value.name.trim() === "") {
    fail(`zone ${id}: name must be a non-empty string`)
  }
  const x = readInteger(value.x, `zone ${id} x`)
  const y = readInteger(value.y, `zone ${id} y`)
  const w = readInteger(value.w, `zone ${id} w`)
  const h = readInteger(value.h, `zone ${id} h`)
  if (w < 1 || h < 1) fail(`zone ${id}: w and h must be >= 1`)
  if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) {
    fail(`zone ${id}: footprint must lie inside ${COLS}×${ROWS}`)
  }
  if (typeof value.layer !== "string" || !isCityLayer(value.layer)) {
    fail(`zone ${id}: layer must be wall, ground, building, or deco`)
  }
  if (typeof value.kind !== "string" || !isZoneKind(value.kind)) {
    fail(`zone ${id}: kind must be one of ${ZONE_KINDS.join(" ")}`)
  }
  if (typeof value.sprite !== "string" || value.sprite.trim() === "") {
    fail(`zone ${id}: sprite must be a non-empty string`)
  }
  const zone: CityZone = {
    id,
    name: value.name,
    x,
    y,
    w,
    h,
    layer: value.layer,
    kind: value.kind,
    sprite: value.sprite,
  }
  if ("count" in value && value.count !== undefined) {
    if (typeof value.count !== "number" || !Number.isInteger(value.count) || value.count < 1) {
      fail(`zone ${id}: count must be a positive integer`)
    }
    zone.count = value.count
  }
  if ("note" in value && value.note !== undefined) {
    if (typeof value.note !== "string") fail(`zone ${id}: note must be a string`)
    zone.note = value.note
  }
  return zone
}

function readGrid(value: unknown): CityGrid {
  if (!isRecord(value)) fail("grid must be an object")
  const tile_px = readInteger(value.tile_px, "grid.tile_px")
  const tile_h_px = readInteger(value.tile_h_px, "grid.tile_h_px")
  const cols = readInteger(value.cols, "grid.cols")
  const rows = readInteger(value.rows, "grid.rows")
  if (tile_px !== CELL || tile_h_px !== TILE_H || cols !== COLS || rows !== ROWS) {
    fail(
      `grid must be tile_px=${CELL} tile_h_px=${TILE_H} cols=${COLS} rows=${ROWS}, got ${tile_px} ${tile_h_px} ${cols} ${rows}`,
    )
  }
  return { ...value, tile_px, tile_h_px, cols, rows }
}

export function parseCityLayout(input: unknown): CityLayout {
  if (!isRecord(input)) fail("root must be an object")
  if (!Array.isArray(input.zones)) fail("zones must be an array")
  if (input.zones.length !== 31) fail(`zones length must be 31, got ${input.zones.length}`)
  const zones = input.zones.map((zone, index) => readZone(zone, index))
  const seen = new Set<string>()
  for (const zone of zones) {
    if (seen.has(zone.id)) fail(`zone ${zone.id}: duplicate id`)
    seen.add(zone.id)
  }
  if (!isRecord(input.meta)) fail("meta must be an object")
  return { meta: input.meta, grid: readGrid(input.grid), zones }
}

export function loadCityLayout(json: string): CityLayout {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON"
    throw new Error(message)
  }
  return parseCityLayout(parsed)
}

/** Node-only. Scripts call this; the browser should pass JSON text to loadCityLayout. */
export function loadCityLayoutFile(path: string = defaultLayoutPath): CityLayout {
  return loadCityLayout(readFileSync(path, "utf8"))
}

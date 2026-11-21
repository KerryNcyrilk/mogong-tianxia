/**
 * Loader for data/cityLayout.json (Iris v1, 28×24).
 * The retired Doubao 28×20 file is not accepted.
 * Zones carry id, name, footprint, and kind. layer/sprite are not required.
 */
import { ARTBOARD_H, ARTBOARD_W, CELL, COLS, ORIGIN_X, ORIGIN_Y, PROJECTED_H, PROJECTED_W, ROWS, TILE_H } from "./coords.ts"

const ID_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/
const ZONE_COUNT = 37

/** Closed set of kind values in the Iris v1 file. */
export const ZONE_KINDS = [
  "cherry",
  "civic",
  "drill",
  "farm",
  "gate",
  "gov",
  "housing",
  "military",
  "mine",
  "plaza",
  "pond",
  "quarry",
  "resource",
  "road",
  "special",
  "storage",
  "wall",
  "workshop",
] as const

export type ZoneKind = (typeof ZONE_KINDS)[number]

export interface CityZone {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  kind: ZoneKind
  note?: string
}

export type CityMeta = Record<string, unknown>

export interface CityGrid {
  tile_px: number
  tile_h_px: number
  cols: number
  rows: number
  artboardW: number
  artboardH: number
  originX: number
  originY: number
  planeW: number
  planeH: number
  focusTile: readonly [number, number]
  zoom: number
  zoomMin: number
  zoomMax: number
}

export interface CityLayout {
  meta: CityMeta
  grid: CityGrid
  zones: CityZone[]
}

function fail(message: string): never {
  throw new Error(`city layout: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isZoneKind(value: string): value is ZoneKind {
  return (ZONE_KINDS as readonly string[]).includes(value)
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${label} must be an integer`)
  return value
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be a finite number`)
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
  if (typeof value.kind !== "string" || !isZoneKind(value.kind)) {
    fail(`zone ${id}: kind must be one of ${ZONE_KINDS.join(" ")}`)
  }
  const zone: CityZone = { id, name: value.name, x, y, w, h, kind: value.kind }
  if ("note" in value && value.note !== undefined) {
    if (typeof value.note !== "string") fail(`zone ${id}: note must be a string`)
    zone.note = value.note
  }
  return zone
}

function readPair(value: unknown, label: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) fail(`${label} must be a pair`)
  return [readInteger(value[0], `${label}[0]`), readInteger(value[1], `${label}[1]`)]
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
  if (!isRecord(value.artboard_default)) fail("grid.artboard_default must be an object")
  const artboard = value.artboard_default
  const artboardW = readInteger(artboard.width, "artboard.width")
  const artboardH = readInteger(artboard.height, "artboard.height")
  if (!isRecord(artboard.projected_plane)) fail("artboard.projected_plane must be an object")
  const planeW = readInteger(artboard.projected_plane.width, "projected_plane.width")
  const planeH = readInteger(artboard.projected_plane.height, "projected_plane.height")
  if (!isRecord(artboard.origin)) fail("artboard.origin must be an object")
  const originX = readInteger(artboard.origin.OX, "origin.OX")
  const originY = readInteger(artboard.origin.OY, "origin.OY")
  if (
    artboardW !== ARTBOARD_W ||
    artboardH !== ARTBOARD_H ||
    planeW !== PROJECTED_W ||
    planeH !== PROJECTED_H ||
    originX !== ORIGIN_X ||
    originY !== ORIGIN_Y
  ) {
    fail(
      `artboard must be ${ARTBOARD_W}×${ARTBOARD_H}, plane ${PROJECTED_W}×${PROJECTED_H}, origin ${ORIGIN_X},${ORIGIN_Y}`,
    )
  }
  if (!isRecord(value.camera_default)) fail("grid.camera_default must be an object")
  const camera = value.camera_default
  const focusTile = readPair(camera.focus_tile, "camera.focus_tile")
  const zoom = readNumber(camera.zoom, "camera.zoom")
  if (!Array.isArray(camera.zoom_range) || camera.zoom_range.length !== 2) fail("camera.zoom_range must be a pair")
  const zoomMin = readNumber(camera.zoom_range[0], "camera.zoom_range[0]")
  const zoomMax = readNumber(camera.zoom_range[1], "camera.zoom_range[1]")
  if (focusTile[0] !== 14 || focusTile[1] !== 13 || zoom !== 0.5 || zoomMin !== 0.4 || zoomMax !== 1.2) {
    fail("camera must focus tile [14, 13] at zoom 0.5 with range 0.4–1.2")
  }
  return {
    tile_px,
    tile_h_px,
    cols,
    rows,
    artboardW,
    artboardH,
    originX,
    originY,
    planeW,
    planeH,
    focusTile,
    zoom,
    zoomMin,
    zoomMax,
  }
}

export function parseCityLayout(input: unknown): CityLayout {
  if (!isRecord(input)) fail("root must be an object")
  if (!Array.isArray(input.zones)) fail("zones must be an array")
  if (input.zones.length !== ZONE_COUNT) fail(`zones length must be ${ZONE_COUNT}, got ${input.zones.length}`)
  const zones = input.zones.map((zone, index) => readZone(zone, index))
  const seen = new Set<string>()
  for (const zone of zones) {
    if (seen.has(zone.id)) fail(`zone ${zone.id}: duplicate id`)
    seen.add(zone.id)
  }
  if (!isRecord(input.meta)) fail("meta must be an object")
  if (input.meta.version !== "iris-v1") fail("meta.version must be iris-v1")
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

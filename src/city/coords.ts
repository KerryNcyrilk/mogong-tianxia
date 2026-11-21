/**
 * Logical tiles are square. The projected diamond is 2:1.
 * Iris v1 authority: 28×24, artboard 2688×1536.
 * North tip of tile (x,y): sx=(x-y)×48+1200, sy=(x+y)×24+192.
 * Screen y grows south, so a camera on this plane looks from south toward north.
 * TILE_H is the diamond height, not the logical row pitch.
 */

export const CELL = 96
export const TILE_W = 96
export const TILE_H = 48
export const COLS = 28
export const ROWS = 24
export const LOGICAL_W = 2688
export const LOGICAL_H = 2304
export const PROJECTED_W = 2496
export const PROJECTED_H = 1248
export const ARTBOARD_W = 2688
export const ARTBOARD_H = 1536
export const ORIGIN_X = 1200
export const ORIGIN_Y = 192

/** Artboard origin. The retired 28×20 plane used (960, 0) and is not authoritative. */
export const PROJECTED_ORIGIN = { x: ORIGIN_X, y: ORIGIN_Y } as const

if (LOGICAL_W !== COLS * CELL || LOGICAL_H !== ROWS * CELL) {
  throw new Error("logical board size must be COLS*CELL by ROWS*CELL")
}

if (TILE_W !== CELL || TILE_H * 2 !== CELL) {
  throw new Error("projected diamond must be CELL wide and CELL/2 tall")
}

if (PROJECTED_W !== (COLS + ROWS) * 48 || PROJECTED_H !== (COLS + ROWS) * 24) {
  throw new Error("projected plane must be (COLS+ROWS)*48 by (COLS+ROWS)*24")
}

if (PROJECTED_ORIGIN.x !== 1200 || PROJECTED_ORIGIN.y !== 192) {
  throw new Error("Iris v1 projected origin must be (1200, 192)")
}

if (ARTBOARD_W !== 2688 || ARTBOARD_H !== 1536) {
  throw new Error("Iris v1 artboard must be 2688×1536")
}

const planeLeft = (0 - ROWS) * 48 + ORIGIN_X
const planeRight = COLS * 48 + ORIGIN_X
const planeBottom = (COLS + ROWS) * 24 + ORIGIN_Y
if (planeLeft < 0 || ORIGIN_Y < 0 || planeRight > ARTBOARD_W || planeBottom > ARTBOARD_H) {
  throw new Error("projected plane must sit inside the artboard")
}

export interface TilePoint {
  col: number
  row: number
}

export interface LogicalPoint {
  x: number
  y: number
}

export interface ProjectedPoint {
  x: number
  y: number
}

export interface ProjectedOrigin {
  x: number
  y: number
}

export interface ZoneFootprint {
  x: number
  y: number
  w: number
  h: number
}

export interface ScreenBox {
  x: number
  y: number
  w: number
  h: number
}

/** Clockwise diamond: top (north), right, bottom (south), left. */
export type ProjectedPolygon = readonly [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint]

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`)
}

export function inBounds(col: number, row: number): boolean {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < COLS && row >= 0 && row < ROWS
}

/** Logical top-left of an integer tile. x = col * 96, y = row * 96. */
export function tileToLogical(col: number, row: number): LogicalPoint {
  assertInteger(col, "col")
  assertInteger(row, "row")
  return { x: col * CELL, y: row * CELL }
}

/** Integer tile under a logical pixel. Fractional pixels are allowed; the index is floored. */
export function logicalToTile(x: number, y: number): TilePoint {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("logical coordinates must be finite")
  }
  return { col: Math.floor(x / CELL), row: Math.floor(y / CELL) }
}

/**
 * 2:1 diamond of a logical footprint.
 * Default origin is the Iris artboard (1200, 192):
 * north = (x-y)×48+1200, (x+y)×24+192.
 * width = (w+h)×48, height = (w+h)×24.
 * The south vertex is the sprite foot-anchor.
 */
export function zoneToProjectedPolygon(
  zone: ZoneFootprint,
  origin: ProjectedOrigin = PROJECTED_ORIGIN,
): ProjectedPolygon {
  assertInteger(zone.x, "zone.x")
  assertInteger(zone.y, "zone.y")
  assertInteger(zone.w, "zone.w")
  assertInteger(zone.h, "zone.h")
  assertInteger(origin.x, "origin.x")
  assertInteger(origin.y, "origin.y")
  const { x, y, w, h } = zone
  const ox = origin.x
  const oy = origin.y
  const top = { x: (x - y) * 48 + ox, y: (x + y) * 24 + oy }
  const right = { x: (x + w - y) * 48 + ox, y: (x + w + y) * 24 + oy }
  const bottom = { x: (x + w - (y + h)) * 48 + ox, y: (x + w + y + h) * 24 + oy }
  const left = { x: (x - (y + h)) * 48 + ox, y: (x + y + h) * 24 + oy }
  return [top, right, bottom, left]
}

/** Axis-aligned bounds of a footprint diamond on the artboard. */
export function zoneAabb(zone: ZoneFootprint, origin: ProjectedOrigin = PROJECTED_ORIGIN): ScreenBox {
  const polygon = zoneToProjectedPolygon(zone, origin)
  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Logical tiles are square. The projected diamond is 2:1.
 * TILE_H is the diamond height, not the logical row pitch.
 * Logical y is row * CELL. Do not use row * TILE_H as a row pitch.
 */

export const CELL = 96
export const TILE_W = 96
export const TILE_H = 48
export const COLS = 28
export const ROWS = 20
export const LOGICAL_W = 2688
export const LOGICAL_H = 1920
export const PROJECTED_W = 2304
export const PROJECTED_H = 1152

/** 960 = ROWS * 48, so the leftmost projected point of the 28×20 plane sits at x = 0. */
export const PROJECTED_ORIGIN = { x: 960, y: 0 } as const

if (LOGICAL_W !== COLS * CELL || LOGICAL_H !== ROWS * CELL) {
  throw new Error("logical board size must be COLS*CELL by ROWS*CELL")
}

if (TILE_W !== CELL || TILE_H * 2 !== CELL) {
  throw new Error("projected diamond must be CELL wide and CELL/2 tall")
}

if (PROJECTED_W !== (COLS + ROWS) * 48 || PROJECTED_H !== (COLS + ROWS) * 24) {
  throw new Error("projected plane must be (COLS+ROWS)*48 by (COLS+ROWS)*24")
}

if (PROJECTED_ORIGIN.x !== ROWS * 48 || PROJECTED_ORIGIN.y !== 0) {
  throw new Error("default projected origin must put the leftmost point at 0")
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

/** Clockwise diamond: top, right, bottom, left. */
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
 * Default origin is the 2304×1152 plane (960, 0):
 * left = (x-(y+h))*48+960, top = (x+y)*24,
 * right = (x+w-y)*48+960, bottom = (x+w+y+h)*24.
 * Pass another origin (the 2496×1440 artboard uses 1056, 192) instead of a second formula.
 * width = (w+h)*48, height = (w+h)*24.
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

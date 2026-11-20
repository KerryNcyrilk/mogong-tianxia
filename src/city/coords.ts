/** Orthogonal integer grid. No hex, and no axonometric skew beyond 96×48. */

export const TILE_W = 96
export const TILE_H = 48
export const COLS = 28
export const ROWS = 20

/**
 * Logical canvas required by the city skeleton.
 * 2688 = COLS * TILE_W. 1920 = ROWS * TILE_H * 2.
 * Tile placement itself stays on a 96×48 pitch, so the 20 rows occupy y 0..960.
 */
export const BOARD_W = 2688
export const BOARD_H = 1920

if (BOARD_W !== COLS * TILE_W || BOARD_H !== ROWS * TILE_H * 2) {
  throw new Error("logical board size does not match the tile constants")
}

/** Paint order. Do not reorder. */
export const LAYERS = ["ground", "road", "building", "overlay"] as const

export type CityLayer = (typeof LAYERS)[number]

export interface TilePoint {
  col: number
  row: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export function isCityLayer(value: string): value is CityLayer {
  return (LAYERS as readonly string[]).includes(value)
}

export function inBounds(col: number, row: number): boolean {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < COLS && row >= 0 && row < ROWS
}

function assertIntegerTile(col: number, row: number): void {
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    throw new Error("tile coordinates must be integers")
  }
}

/** Top-left pixel of an integer tile. x = col * 96, y = row * 48. */
export function tileToScreen(col: number, row: number): ScreenPoint {
  assertIntegerTile(col, row)
  return { x: col * TILE_W, y: row * TILE_H }
}

/** Integer tile under a pixel. Pixels may be fractional; the tile index is not. */
export function screenToTile(x: number, y: number): TilePoint {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("screen coordinates must be finite")
  }
  return { col: Math.floor(x / TILE_W), row: Math.floor(y / TILE_H) }
}

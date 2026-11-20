export const GRID_COLS = 12
export const GRID_ROWS = 8

export interface Cell {
  x: number
  y: number
}

export interface GridSquad {
  id: string
  x: number
  y: number
}

export type PlaceResult =
  | { ok: true; units: GridSquad[] }
  | { ok: false; reason: "out-of-bounds" | "occupied" }

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_COLS && y < GRID_ROWS
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function placeSquad(units: readonly GridSquad[], squad: GridSquad): PlaceResult {
  if (!inBounds(squad.x, squad.y)) return { ok: false, reason: "out-of-bounds" }
  if (units.some((unit) => unit.x === squad.x && unit.y === squad.y)) {
    return { ok: false, reason: "occupied" }
  }
  return { ok: true, units: [...units, squad] }
}

export function occupancy(units: readonly GridSquad[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const unit of units) {
    if (!inBounds(unit.x, unit.y)) {
      throw new Error(`out-of-bounds:${unit.x},${unit.y}`)
    }
    const key = cellKey(unit.x, unit.y)
    if (map.has(key)) throw new Error(`occupied:${key}`)
    map.set(key, unit.id)
  }
  return map
}

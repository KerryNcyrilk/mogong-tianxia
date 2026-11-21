/**
 * Main-city camera. Zoom scales the world around the focus tile.
 * The HUD anchor is screen-space and is not applied here.
 * Clamp keeps the focus tile inside x 1–26, y 0–22 so the north resource belt
 * stays on this same camera.
 */
import { ORIGIN_X, ORIGIN_Y } from "./coords.ts"

export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 1.2
export const DEFAULT_ZOOM = 0.5
export const FOCUS_TILE = { col: 14, row: 13 } as const
export const FOCUS_CLAMP = { minCol: 1, maxCol: 26, minRow: 0, maxRow: 22 } as const

export interface WorldPoint {
  x: number
  y: number
}

export interface FocusTile {
  col: number
  row: number
}

/** Center of a tile diamond. This is the camera focus point, south of the north tip by 24px. */
export function tileFocusPoint(col: number, row: number): WorldPoint {
  return {
    x: (col - row) * 48 + ORIGIN_X,
    y: (col + row + 1) * 24 + ORIGIN_Y,
  }
}

export function worldToFocusTile(point: WorldPoint): FocusTile {
  const along = (point.x - ORIGIN_X) / 48
  const across = (point.y - ORIGIN_Y) / 24 - 1
  return { col: (along + across) / 2, row: (across - along) / 2 }
}

export function clampFocusPoint(point: WorldPoint): WorldPoint {
  const tile = worldToFocusTile(point)
  const col = Math.min(FOCUS_CLAMP.maxCol, Math.max(FOCUS_CLAMP.minCol, tile.col))
  const row = Math.min(FOCUS_CLAMP.maxRow, Math.max(FOCUS_CLAMP.minRow, tile.row))
  return tileFocusPoint(col, row)
}

export const DEFAULT_FOCUS: WorldPoint = tileFocusPoint(FOCUS_TILE.col, FOCUS_TILE.row)

/** Move the focus by a world delta and clamp. Screen-right is +x, screen-down is +y. */
export function panFocus(focus: WorldPoint, worldDx: number, worldDy: number): WorldPoint {
  return clampFocusPoint({ x: focus.x + worldDx, y: focus.y + worldDy })
}

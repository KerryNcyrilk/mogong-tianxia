/**
 * ASSUMED alignment of Iris's painted overview.
 *
 * The JPG is one 1280×720 plate of the whole city, south looking north.
 * It is not per-building art, and its pixels are not measured into tile coordinates.
 * Zone footprints stay in data/cityLayout.json.
 *
 * At the default camera (zoom 0.5, focus tile 14,13, anchor at the 1280 safe-rect
 * center) the plate fills the 1280×720 viewport exactly, so /city matches the
 * composite's world framing. World size is therefore the plate divided by zoom:
 * 2560×1440. The plate origin sits at focus - anchor/zoom.
 */
import { DEFAULT_FOCUS, DEFAULT_ZOOM } from "./camera.ts"

const ANCHOR_X = 778
const ANCHOR_Y = 325
const PLATE_W = 1280
const PLATE_H = 720

export const OVERVIEW_SRC = "/art/board/iris-v1-town-overview.jpg"

export const OVERVIEW_WORLD = {
  x: DEFAULT_FOCUS.x - ANCHOR_X / DEFAULT_ZOOM,
  y: DEFAULT_FOCUS.y - ANCHOR_Y / DEFAULT_ZOOM,
  w: PLATE_W / DEFAULT_ZOOM,
  h: PLATE_H / DEFAULT_ZOOM,
} as const

const left = (OVERVIEW_WORLD.x - DEFAULT_FOCUS.x) * DEFAULT_ZOOM + ANCHOR_X
const top = (OVERVIEW_WORLD.y - DEFAULT_FOCUS.y) * DEFAULT_ZOOM + ANCHOR_Y
if (left !== 0 || top !== 0 || OVERVIEW_WORLD.w * DEFAULT_ZOOM !== PLATE_W || OVERVIEW_WORLD.h * DEFAULT_ZOOM !== PLATE_H) {
  throw new Error("overview plate must fill the 1280×720 viewport at the default camera")
}

import { ARTBOARD_H, ARTBOARD_W } from "../../city/coords.ts"
import { DEFAULT_FOCUS, type WorldPoint } from "../../city/camera.ts"
import {
  ARTBOARD,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_ZOOMS,
  UI_1280,
  UI_1920,
  type UiNode,
  type UiProfile,
} from "./tokens.ts"

export interface ScreenBox {
  x: number
  y: number
  w: number
  h: number
}

export const AREA_IDS = ["area_left", "area_chat", "area_actions", "area_queue"] as const
export const SUBJECT_IDS = ["gov", "drill", "gate_s"] as const

/** Safe viewport at the 1280 baseline: (276,0) through (1280,650). */
export const SAFE_RECT: ScreenBox = UI_1280.safe

/** 1920 safe rect is the scaled baseline, not a second measurement. */
export const SAFE_RECT_1920: ScreenBox = UI_1920.safe

export const CAMERA = {
  zooms: CAMERA_ZOOMS,
  zoom: CAMERA_DEFAULT_ZOOM,
  focus: DEFAULT_FOCUS,
  anchor: { x: UI_1280.camera.anchorX, y: UI_1280.camera.anchorY },
  anchor1920: { x: UI_1920.camera.anchorX, y: UI_1920.camera.anchorY },
} as const

export function profileOf(size: 1280 | 1920): UiProfile {
  return size === 1280 ? UI_1280 : UI_1920
}

/**
 * UI rectangles do not take zoom. Callers still pass zoom so a check can
 * prove the returned list is identical at 0.4 / 0.5 / 1.0 / 1.2.
 */
export function layoutAt(zoom: number, profile: UiProfile): readonly UiNode[] {
  void zoom
  return profile.nodes
}

export function resolutionScale(profile: UiProfile): number {
  return profile.screenW / UI_1280.screenW
}

if (ARTBOARD.w !== ARTBOARD_W || ARTBOARD.h !== ARTBOARD_H) {
  throw new Error("UI artboard must match the Iris v1 artboard")
}

/**
 * World layer frame relative to the HUD origin.
 * The focus tile stays on the safe-rect center while zoom changes.
 * 1920 multiplies zoom by the 1.5 screen scale so the composition matches.
 */
export function artboardFrame(zoom: number, profile: UiProfile, focus: WorldPoint = DEFAULT_FOCUS): ScreenBox {
  const resScale = resolutionScale(profile)
  return {
    x: (0 - focus.x) * zoom * resScale + profile.camera.anchorX,
    y: (0 - focus.y) * zoom * resScale + profile.camera.anchorY,
    w: ARTBOARD_W * zoom * resScale,
    h: ARTBOARD_H * zoom * resScale,
  }
}

/** Artboard pixel box → HUD pixel box. Same formula as artboardFrame. */
export function worldBoxToScreen(
  box: ScreenBox,
  zoom: number,
  profile: UiProfile,
  focus: WorldPoint = DEFAULT_FOCUS,
): ScreenBox {
  const resScale = resolutionScale(profile)
  return {
    x: (box.x - focus.x) * zoom * resScale + profile.camera.anchorX,
    y: (box.y - focus.y) * zoom * resScale + profile.camera.anchorY,
    w: box.w * zoom * resScale,
    h: box.h * zoom * resScale,
  }
}

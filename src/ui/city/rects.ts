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
  offset: { x: UI_1280.camera.offsetX, y: UI_1280.camera.offsetY },
  offset1920: { x: UI_1920.camera.offsetX, y: UI_1920.camera.offsetY },
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

/** World layer frame. 1920 multiplies zoom by the 1.5 screen scale so the composition matches. */
export function artboardFrame(zoom: number, profile: UiProfile): ScreenBox {
  const resScale = resolutionScale(profile)
  return {
    x: profile.camera.offsetX,
    y: profile.camera.offsetY,
    w: ARTBOARD.w * zoom * resScale,
    h: ARTBOARD.h * zoom * resScale,
  }
}

/** Artboard pixel box → screen pixel box. Same formula as artboardFrame. */
export function worldBoxToScreen(box: ScreenBox, zoom: number, profile: UiProfile): ScreenBox {
  const resScale = resolutionScale(profile)
  return {
    x: box.x * zoom * resScale + profile.camera.offsetX,
    y: box.y * zoom * resScale + profile.camera.offsetY,
    w: box.w * zoom * resScale,
    h: box.h * zoom * resScale,
  }
}

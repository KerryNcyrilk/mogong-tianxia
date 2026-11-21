/**
 * HUD fit. The 1280×720 frame scales as a whole. The world may extend
 * outside that frame; panels are not restretched to fill the window.
 */

export interface DisplayFit {
  scale: number
  stageW: number
  stageH: number
  hudX: number
  hudY: number
  portrait: boolean
  scroll: boolean
}

export const LOCKS = {
  "1280": { w: 1280, h: 720, scale: 1 },
  "1366": { w: 1366, h: 768, scale: 1 },
  "1600": { w: 1600, h: 900, scale: 1.25 },
  "1920": { w: 1920, h: 1080, scale: 1.5 },
  "2560": { w: 2560, h: 1440, scale: 2 },
  "3840": { w: 3840, h: 2160, scale: 2 },
} as const

export type LockSize = keyof typeof LOCKS

const MIN_SCALE = 0.75
const MAX_SCALE = 2
const DESIGN_W = 1280
const DESIGN_H = 720
const SIXTEEN_NINE = 16 / 9

function snap(value: number): number {
  const steps = [0.75, 1, 1.25, 1.5, 2]
  for (const step of steps) {
    if (Math.abs(value - step) <= 0.02) return step
  }
  return value
}

function placed(viewW: number, viewH: number, scale: number, portrait: boolean, scroll: boolean): DisplayFit {
  const hudW = DESIGN_W * scale
  const hudH = DESIGN_H * scale
  const stageW = scroll ? Math.max(viewW, hudW) : viewW
  const stageH = scroll ? Math.max(viewH, hudH) : viewH
  return {
    scale,
    stageW,
    stageH,
    hudX: Math.max(0, (stageW - hudW) / 2),
    hudY: Math.max(0, (stageH - hudH) / 2),
    portrait,
    scroll,
  }
}

export function fitDisplay(viewW: number, viewH: number): DisplayFit {
  if (!(viewW >= 1) || !(viewH >= 1)) {
    return placed(DESIGN_W, DESIGN_H, 1, false, false)
  }
  const preset = Object.values(LOCKS).find((item) => item.w === viewW && item.h === viewH)
  if (preset) return placed(viewW, viewH, preset.scale, false, false)

  const portrait = viewH > viewW
  let raw: number
  if (portrait) raw = Math.min(viewW / DESIGN_W, viewH / DESIGN_H)
  else if (viewW / viewH > SIXTEEN_NINE + 0.02) raw = viewH / DESIGN_H
  else raw = viewW / DESIGN_W

  raw = snap(raw)
  let scroll = false
  if (raw < MIN_SCALE) {
    raw = MIN_SCALE
    scroll = true
  }
  if (raw > MAX_SCALE) raw = MAX_SCALE
  return placed(viewW, viewH, raw, portrait, scroll)
}

for (const [key, item] of Object.entries(LOCKS)) {
  const fit = fitDisplay(item.w, item.h)
  if (fit.scale !== item.scale) throw new Error(`preset ${key} scale ${fit.scale} !== ${item.scale}`)
  if (key === "1366" && (fit.hudX !== 43 || fit.hudY !== 24)) {
    throw new Error("1366×768 must letterbox the 1280×720 HUD at scale 1")
  }
  if (key === "1920" && fit.hudX !== 0) throw new Error("1920 HUD must fill the stage at scale 1.5")
  if (key === "3840" && (fit.scale !== 2 || fit.hudX <= 0)) throw new Error("3840 must keep HUD at scale 2")
}

const ultrawide = fitDisplay(2560, 1080)
if (ultrawide.scale !== 1.5 || ultrawide.hudX <= 0) throw new Error("ultrawide must extend the world beside a height-scaled HUD")

const tenBySixteen = fitDisplay(1440, 900)
if (!(tenBySixteen.hudY > 0) || tenBySixteen.portrait) throw new Error("16:10 must keep a 16:9 HUD and extend the ground")

if (fitDisplay(400, 300).scale !== MIN_SCALE) throw new Error("HUD must not shrink below 0.75")

const portraitFit = fitDisplay(720, 1280)
if (!portraitFit.portrait || portraitFit.scale !== MIN_SCALE) throw new Error("portrait keeps the landscape HUD")

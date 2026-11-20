import type { UnitType } from "../combat/types.ts"

/**
 * Art slots for 行術 · Iris.
 * Combat and layout read this map only. Replace `src` or the file it points at.
 * Do not rename `key`. Placeholder files are stamped 佔位 and are not final art.
 */
export type ArtFormat = "svg" | "png" | "webp"

export interface ArtSlot {
  key: string
  src: string
  width: number
  height: number
  format: ArtFormat
  status: "placeholder"
  label: string
}

function slot(
  key: string,
  src: string,
  width: number,
  height: number,
  format: ArtFormat,
  label: string,
): ArtSlot {
  return { key, src, width, height, format, status: "placeholder", label }
}

export const unitArt: Record<UnitType, ArtSlot> = {
  cavalry: slot("unit.cavalry", "/art/units/cavalry.svg", 256, 256, "svg", "騎"),
  blade: slot("unit.blade", "/art/units/blade.svg", 256, 256, "svg", "刀"),
  halberd: slot("unit.halberd", "/art/units/halberd.svg", 256, 256, "svg", "戟"),
  bow: slot("unit.bow", "/art/units/bow.svg", 256, 256, "svg", "弓"),
  shield: slot("unit.shield", "/art/units/shield.svg", 256, 256, "svg", "盾"),
  scholar: slot("unit.scholar", "/art/units/scholar.svg", 256, 256, "svg", "學者"),
  beast: slot("unit.beast", "/art/units/beast.svg", 256, 256, "svg", "神獸"),
}

export const markerArt = {
  generalAura: slot("marker.general-aura", "/art/markers/general-aura.svg", 256, 256, "svg", "武將光環"),
}

export const boardArt = {
  ground: slot("board.ground", "/art/board/ground.svg", 1536, 1024, "svg", "十二乘八地面"),
}

export const chromeArt = {
  initiative: slot("chrome.initiative", "/art/chrome/initiative.svg", 480, 96, "svg", "先攻條"),
  hp: slot("chrome.hp", "/art/chrome/hp.svg", 256, 32, "svg", "兵力條"),
  buttons: slot("chrome.buttons", "/art/chrome/buttons.svg", 480, 96, "svg", "操作按鈕"),
  log: slot("chrome.log", "/art/chrome/log.svg", 640, 800, "svg", "戰報面板"),
}

export const artManifest = {
  units: unitArt,
  markers: markerArt,
  board: boardArt,
  chrome: chromeArt,
}

/** Stand-in colors. Iris can retint here; layout code should not invent a second palette. */
export const artTheme = {
  paper: "#e7dcc6",
  ink: "#1b1712",
  attacker: "#243e66",
  defender: "#7c312c",
  aura: "#8a6a32",
  hpAttacker: "#8ea4c8",
  hpDefender: "#c48a84",
  muted: "#5c5348",
}

export function allArtSlots(): ArtSlot[] {
  return [
    ...Object.values(unitArt),
    markerArt.generalAura,
    boardArt.ground,
    ...Object.values(chromeArt),
  ]
}

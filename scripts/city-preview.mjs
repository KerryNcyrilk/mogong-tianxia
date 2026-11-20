import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ROWS, zoneToProjectedPolygon } from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"

const ARTBOARD_W = 2496
const ARTBOARD_H = 1440
const ORIGIN_X = 1056
const ORIGIN_Y = 192
const STROKE = "#3A2A1C"

/** Flat fills only. ground / drill dirt use the official palette; the others are named in B3 v2.1. */
const LAYER_FILL = {
  ground: "#7E9A56",
  wall: "#C8C6BE",
  building: "#2C3A46",
  deco: "#6B7038",
}
const DRILL_GROUND_FILL = "#C9B292"
const PAINT_RANK = { ground: 0, wall: 1, building: 2, deco: 3 }

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, "../public/art/board/city-placeholder.svg")

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function anchorOf(zone) {
  return (zone.y + zone.h) * 24
}

function labelSize(id, width) {
  const fitted = Math.floor(width / Math.max(id.length * 0.6, 1))
  return Math.max(10, Math.min(14, fitted))
}

function paintOrder(zones) {
  const drill = zones.find((zone) => zone.id === "drill")
  const drillAnchor = drill ? anchorOf(drill) : null
  return zones
    .map((zone, index) => {
      let anchor = anchorOf(zone)
      // Strict south-edge order paints drill after drill_ground and covers the inset.
      // Lift the child onto the parent's anchor so file order draws it just above drill.
      if (zone.id === "drill_ground" && drillAnchor !== null && anchor < drillAnchor) anchor = drillAnchor
      return { zone, index, anchor, rank: PAINT_RANK[zone.layer] }
    })
    .sort((a, b) => a.anchor - b.anchor || a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.zone)
}

function zoneFill(zone) {
  if (zone.id === "drill_ground") return DRILL_GROUND_FILL
  return LAYER_FILL[zone.layer]
}

function labelFill(zone) {
  return zone.layer === "building" ? "#F4F0E6" : "#1A120C"
}

function zoneMarkup(zone) {
  const polygon = zoneToProjectedPolygon(zone, { x: ORIGIN_X, y: ORIGIN_Y })
  for (const point of polygon) {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
      throw new Error(`zone ${zone.id}: projected vertex is not an integer`)
    }
  }
  const [top, right, bottom, left] = polygon
  const center = {
    x: (2 * zone.x + zone.w - 2 * zone.y - zone.h) * 24 + ORIGIN_X,
    y: (2 * zone.x + 2 * zone.y + zone.w + zone.h) * 12 + ORIGIN_Y,
  }
  if (center.x !== (left.x + right.x) / 2 || center.y !== (top.y + bottom.y) / 2) {
    throw new Error(`zone ${zone.id}: label center does not match the diamond`)
  }
  const size = labelSize(zone.id, right.x - left.x)
  if (size < 10) throw new Error(`zone ${zone.id}: label would be smaller than 10px`)
  const dash = zone.id === "drill_ground" ? ` stroke-dasharray="8 6"` : ""
  const points = polygon.map((point) => `${point.x},${point.y}`).join(" ")
  return [
    `  <g id="zone-${escapeXml(zone.id)}" data-layer="${zone.layer}" data-kind="${zone.kind}">`,
    `    <title>${escapeXml(zone.name)}</title>`,
    `    <polygon points="${points}" fill="${zoneFill(zone)}" stroke="${STROKE}" stroke-width="2"${dash}/>`,
    `    <text x="${center.x}" y="${center.y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${size}" fill="${labelFill(zone)}">${escapeXml(zone.id)}</text>`,
    `  </g>`,
  ].join("\n")
}

let svg
try {
  const layout = loadCityLayoutFile()
  const artboard = layout.grid.artboard_default
  const margin = artboard && typeof artboard === "object" ? artboard.margin : undefined
  if (
    !artboard ||
    artboard.width !== ARTBOARD_W ||
    artboard.height !== ARTBOARD_H ||
    !margin ||
    margin.left !== 96 ||
    margin.top !== 192
  ) {
    throw new Error("official artboard_default does not match 2496×1440 with margin left 96 top 192")
  }
  if (ORIGIN_X !== ROWS * 48 + margin.left || ORIGIN_Y !== margin.top) {
    throw new Error("ORIGIN must be the 960 projected origin plus the artboard margin")
  }
  const painted = paintOrder(layout.zones)
  if (painted.length !== layout.zones.length) throw new Error("preview skipped a zone")
  const ids = new Set(painted.map((zone) => zone.id))
  if (ids.size !== layout.zones.length) throw new Error("preview skipped a zone id")
  svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ARTBOARD_W}" height="${ARTBOARD_H}" viewBox="0 0 ${ARTBOARD_W} ${ARTBOARD_H}">`,
    `  <desc>主城佔位菱形。31 區，透明背景，無紋理無陰影。Artboard ${ARTBOARD_W}×${ARTBOARD_H}，origin (${ORIGIN_X},${ORIGIN_Y})。</desc>`,
    painted.map(zoneMarkup).join("\n"),
    `</svg>`,
    ``,
  ].join("\n")
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, svg)
process.stdout.write(`${outPath}\n${ARTBOARD_W}×${ARTBOARD_H}\n`)

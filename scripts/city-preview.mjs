import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BOARD_H, BOARD_W, COLS, LAYERS, ROWS, TILE_H, TILE_W, tileToScreen } from "../src/city/coords.ts"
import { loadCityLayout } from "../src/city/zones.ts"

const here = dirname(fileURLToPath(import.meta.url))
const defaultLayout = resolve(here, "../src/city/fixtures/city-layout.fixture.json")
const defaultOut = resolve(here, "../public/art/board/city-placeholder.svg")
const layoutPath = process.argv[2] ? resolve(process.argv[2]) : defaultLayout
const outPath = process.argv[3] ? resolve(process.argv[3]) : defaultOut

const ROLE_FILL = {
  building: "#243e66",
  reserve: "#8a6a32",
  "pending-gameplay": "#6e675c",
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function labelSize(id, width) {
  const fitted = Math.floor(width / Math.max(id.length * 0.62, 1))
  return Math.max(10, Math.min(18, fitted))
}

let layout
try {
  layout = loadCityLayout(readFileSync(layoutPath, "utf8"))
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

const rank = new Map(LAYERS.map((layer, index) => [layer, index]))
const painted = layout.zones
  .map((zone, index) => ({ zone, index }))
  .sort((a, b) => (rank.get(a.zone.layer) ?? 0) - (rank.get(b.zone.layer) ?? 0) || a.index - b.index)
  .map((entry) => entry.zone)

const grid = []
for (let col = 0; col <= COLS; col += 1) {
  const x = col * TILE_W
  grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ROWS * TILE_H}"/>`)
}
for (let row = 0; row <= ROWS; row += 1) {
  const y = row * TILE_H
  grid.push(`<line x1="0" y1="${y}" x2="${COLS * TILE_W}" y2="${y}"/>`)
}

const blocks = painted.map((zone) => {
  const origin = tileToScreen(zone.rect.x, zone.rect.y)
  const width = zone.rect.w * TILE_W
  const height = zone.rect.h * TILE_H
  const fill = ROLE_FILL[zone.role]
  const size = labelSize(zone.id, width)
  return [
    `<g id="zone-${escapeXml(zone.id)}" data-role="${zone.role}" data-layer="${zone.layer}">`,
    `<title>${escapeXml(zone.name)}</title>`,
    `<rect x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" fill="${fill}" stroke="#1b1712" stroke-width="2"/>`,
    `<text x="${origin.x + width / 2}" y="${origin.y + height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="WenQuanYi Micro Hei, sans-serif" font-size="${size}" fill="#f6efe2">${escapeXml(zone.id)}</text>`,
    `</g>`,
  ].join("")
})

const svg = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD_W}" height="${BOARD_H}" viewBox="0 0 ${BOARD_W} ${BOARD_H}">`,
  `<desc>佔位色塊。畫布 ${BOARD_W}×${BOARD_H}，格子 ${TILE_W}×${TILE_H}，正交整數格。本圖依所給 JSON 繪製；測試夾具不是官方 31 區座標。</desc>`,
  `<rect width="${BOARD_W}" height="${BOARD_H}" fill="#efe6d4"/>`,
  `<g fill="none" stroke="#1b1712" stroke-width="1" opacity="0.28">${grid.join("")}</g>`,
  blocks.join(""),
  `<text x="48" y="1020" font-family="WenQuanYi Micro Hei, sans-serif" font-size="28" fill="#1b1712">測試夾具 · 非交付座標 · 官方 31 區 cityLayout.json 尚未提供</text>`,
  `<text x="48" y="1060" font-family="WenQuanYi Micro Hei, sans-serif" font-size="22" fill="#5c5348">canvas ${BOARD_W}×${BOARD_H} · tile ${TILE_W}×${TILE_H} · orthogonal · zones ${layout.zones.length}</text>`,
  `</svg>`,
  ``,
].join("\n")

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, svg)
process.stdout.write(`${outPath}\n${BOARD_W}×${BOARD_H}\n`)

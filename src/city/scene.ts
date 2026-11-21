/**
 * Placeholder city drawn from Iris v1 footprints.
 * Foot-anchor is the south tip of each diamond. Sprites y-sort by that anchor.
 * Old P0 canvases are not used. Sub-sprites stay inside their official zone.
 * Stable art is fences and white tents only.
 */
import type { CityLayout, CityZone } from "./layout.ts"
import { PALETTE } from "./palette.ts"
import {
  ARTBOARD_H,
  ARTBOARD_W,
  type ProjectedPoint,
  type ZoneFootprint,
  zoneToProjectedPolygon,
} from "./coords.ts"

interface Sprite {
  anchor: number
  rank: number
  seq: number
  body: string
}

const RANK_WALL = 1
const RANK_TREE = 2
const RANK_BUILDING = 3
const RANK_GATE = 4
const RANK_BEACON = 5
const RANK_FLAG = 6

function round(value: number): number {
  return Math.round(value)
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function southAnchor(zone: ZoneFootprint): number {
  return (zone.x + zone.w + zone.y + zone.h) * 24 + 192
}

function diamond(zone: ZoneFootprint): readonly [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint] {
  return zoneToProjectedPolygon(zone)
}

function pts(points: readonly ProjectedPoint[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ")
}

function polygon(points: readonly ProjectedPoint[], fill: string, stroke?: string, width = 1): string {
  const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"` : ""
  return `<polygon points="${pts(points)}" fill="${fill}"${strokeAttr}/>`
}

function expand(points: readonly ProjectedPoint[], amount: number): ProjectedPoint[] {
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length
  return points.map((point) => {
    const dx = point.x - cx
    const dy = point.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: point.x + (dx / len) * amount, y: point.y + (dy / len) * amount }
  })
}

function lift(point: ProjectedPoint, height: number): ProjectedPoint {
  return { x: point.x, y: point.y - height }
}

function extrude(zone: ZoneFootprint, height: number, roof: string, left: string, right: string, eaves = 0): string {
  const [north, east, south, west] = diamond(zone)
  const roofPoints = [lift(north, height), lift(east, height), lift(south, height), lift(west, height)]
  const cap = eaves > 0 ? expand(roofPoints, eaves) : roofPoints
  const westFace = [west, south, lift(south, height), lift(west, height)]
  const eastFace = [east, south, lift(south, height), lift(east, height)]
  const ridge =
    eaves >= 6
      ? `<line x1="${round(lift(north, height).x)}" y1="${round(lift(north, height).y)}" x2="${round(lift(south, height).x)}" y2="${round(lift(south, height).y)}" stroke="${PALETTE.goldRidge}" stroke-width="2"/>`
      : ""
  return `${polygon(westFace, left)}${polygon(eastFace, right)}${polygon(cap, roof, PALETTE.ink, 1)}${ridge}`
}

function assertInside(parent: ZoneFootprint, child: ZoneFootprint): void {
  if (
    child.x < parent.x ||
    child.y < parent.y ||
    child.x + child.w > parent.x + parent.w ||
    child.y + child.h > parent.y + parent.h
  ) {
    throw new Error(`sprite ${child.x},${child.y} ${child.w}×${child.h} escaped its zone`)
  }
}

function claim(zone: CityZone, claimed: Set<string>): string {
  if (claimed.has(zone.id)) return ""
  claimed.add(zone.id)
  return ` id="zone-${zone.id}"`
}

function pushGround(ground: string[], zone: CityZone, body: string, claimed: Set<string>): void {
  ground.push(`<g${claim(zone, claimed)} data-zone="${zone.id}"><title>${escapeXml(zone.name)}</title>${body}</g>`)
}

function pushSprite(
  sprites: Sprite[],
  zone: CityZone,
  body: string,
  anchorZone: ZoneFootprint,
  rank: number,
  claimed: Set<string>,
): void {
  sprites.push({
    anchor: southAnchor(anchorZone),
    rank,
    seq: sprites.length,
    body: `<g${claim(zone, claimed)} data-zone="${zone.id}"><title>${escapeXml(zone.name)}</title>${body}</g>`,
  })
}

function splitSpan(length: number, prefer: number): number[] {
  if (length <= prefer) return [length]
  const parts: number[] = []
  let left = length
  while (left > prefer) {
    if (left === prefer + 1) break
    parts.push(prefer)
    left -= prefer
  }
  parts.push(left)
  return parts
}

function lots(zone: ZoneFootprint, preferW: number, preferH: number): ZoneFootprint[] {
  const cols = splitSpan(zone.w, preferW)
  const rows = splitSpan(zone.h, preferH)
  const out: ZoneFootprint[] = []
  let y = zone.y
  for (const h of rows) {
    let x = zone.x
    for (const w of cols) {
      const lot = { x, y, w, h }
      assertInside(zone, lot)
      out.push(lot)
      x += w
    }
    y += h
  }
  return out
}

function tiles(zone: ZoneFootprint): ZoneFootprint[] {
  const out: ZoneFootprint[] = []
  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    for (let x = zone.x; x < zone.x + zone.w; x += 1) out.push({ x, y, w: 1, h: 1 })
  }
  return out
}

function hall(
  sprites: Sprite[],
  zone: CityZone,
  lot: ZoneFootprint,
  height: number,
  claimed: Set<string>,
  rank = RANK_BUILDING,
): void {
  assertInside(zone, lot)
  pushSprite(
    sprites,
    zone,
    extrude(lot, height, PALETTE.blueGlaze, PALETTE.officialGrey, PALETTE.officialGreyDark, 8),
    lot,
    rank,
    claimed,
  )
}

function house(sprites: Sprite[], zone: CityZone, lot: ZoneFootprint, claimed: Set<string>): void {
  assertInside(zone, lot)
  const height = 42 + ((lot.x * 3 + lot.y * 5) % 3) * 8
  const roof = (lot.x + lot.y) % 2 === 0 ? PALETTE.clay : PALETTE.clayAlt
  pushSprite(sprites, zone, extrude(lot, height, roof, PALETTE.plaster, PALETTE.plasterDark, 5), lot, RANK_BUILDING, claimed)
}

function treeBody(tile: ZoneFootprint, crown: string, highlight: string, scale: number): string {
  const [, , south] = diamond(tile)
  const height = 36 * scale
  const radius = 16 * scale
  const top = south.y - height
  return `<line x1="${round(south.x)}" y1="${round(south.y)}" x2="${round(south.x)}" y2="${round(top)}" stroke="${PALETTE.trunk}" stroke-width="3"/>
    <circle cx="${round(south.x)}" cy="${round(top)}" r="${round(radius)}" fill="${crown}"/>
    <circle cx="${round(south.x - radius * 0.35)}" cy="${round(top - radius * 0.25)}" r="${round(radius * 0.55)}" fill="${highlight}"/>`
}

function paintWall(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  for (const tile of tiles(zone)) {
    pushSprite(
      sprites,
      zone,
      extrude(tile, 36, PALETTE.wallRammed, PALETTE.wallRammedLight, PALETTE.wallRammedDark, 0),
      tile,
      RANK_WALL,
      claimed,
    )
  }
}

function paintHouses(sprites: Sprite[], zone: CityZone, preferW: number, preferH: number, claimed: Set<string>): void {
  for (const lot of lots(zone, preferW, preferH)) house(sprites, zone, lot, claimed)
}

function paintGate(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const towers: Array<ZoneFootprint & { height: number }> = [
    { x: 9, y: 22, w: 1, h: 2, height: 84 },
    { x: 11, y: 22, w: 1, h: 2, height: 84 },
    { x: 10, y: 22, w: 1, h: 2, height: 62 },
  ]
  for (const tower of towers) {
    assertInside(zone, tower)
    pushSprite(
      sprites,
      zone,
      extrude(tower, tower.height, PALETTE.blueGlaze, PALETTE.officialGrey, PALETTE.officialGreyDark, 6),
      tower,
      RANK_GATE,
      claimed,
    )
  }
  const [, , south] = diamond({ x: 10, y: 23, w: 1, h: 1 })
  pushSprite(
    sprites,
    zone,
    `<ellipse cx="${round(south.x)}" cy="${round(south.y - 22)}" rx="16" ry="12" fill="${PALETTE.arch}"/>`,
    { x: 10, y: 23, w: 1, h: 1 },
    RANK_GATE,
    claimed,
  )
}

function paintBeacon(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const height = 118
  const [north] = diamond(zone)
  const fireY = north.y - height
  const fire = `<polygon points="${round(north.x)},${round(fireY - 22)} ${round(north.x - 10)},${round(fireY)} ${round(north.x + 10)},${round(fireY)}" fill="${PALETTE.fire}"/>
    <polygon points="${round(north.x)},${round(fireY - 12)} ${round(north.x - 5)},${round(fireY)} ${round(north.x + 5)},${round(fireY)}" fill="${PALETTE.fireCore}"/>`
  pushSprite(
    sprites,
    zone,
    `${extrude(zone, height, PALETTE.officialGrey, PALETTE.wallRammedLight, PALETTE.wallRammedDark, 4)}${fire}`,
    zone,
    RANK_BEACON,
    claimed,
  )
}

function paintStable(ground: string[], sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const [north, east, south, west] = diamond(zone)
  const posts = [north, east, south, west]
    .map((point) => `<rect x="${round(point.x) - 3}" y="${round(point.y) - 14}" width="6" height="14" fill="${PALETTE.fence}"/>`)
    .join("")
  pushGround(ground, zone, `${polygon(diamond(zone), "none", PALETTE.fence, 4)}${posts}`, claimed)
  const tents: ZoneFootprint[] = [
    { x: 5, y: 5, w: 2, h: 1 },
    { x: 5, y: 6, w: 2, h: 1 },
  ]
  for (const tent of tents) {
    assertInside(zone, tent)
    pushSprite(sprites, zone, extrude(tent, 28, PALETTE.tent, PALETTE.tent, PALETTE.tentShade, 2), tent, RANK_BUILDING, claimed)
  }
}

function paintGov(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const pieces: Array<{ lot: ZoneFootprint; height: number; roof: string; left: string; right: string; eaves: number }> = [
    { lot: { x: 13, y: 8, w: 7, h: 1 }, height: 22, roof: PALETTE.officialGrey, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 0 },
    { lot: { x: 13, y: 9, w: 1, h: 6 }, height: 22, roof: PALETTE.officialGrey, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 0 },
    { lot: { x: 19, y: 9, w: 1, h: 6 }, height: 22, roof: PALETTE.officialGrey, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 0 },
    { lot: { x: 13, y: 15, w: 2, h: 1 }, height: 22, roof: PALETTE.officialGrey, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 0 },
    { lot: { x: 18, y: 15, w: 2, h: 1 }, height: 22, roof: PALETTE.officialGrey, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 0 },
    { lot: { x: 15, y: 15, w: 3, h: 1 }, height: 14, roof: PALETTE.stairs, left: PALETTE.stairs, right: PALETTE.roadJoint, eaves: 0 },
    { lot: { x: 14, y: 10, w: 1, h: 3 }, height: 58, roof: PALETTE.blueGlaze, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 6 },
    { lot: { x: 18, y: 10, w: 1, h: 3 }, height: 58, roof: PALETTE.blueGlaze, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 6 },
    { lot: { x: 15, y: 9, w: 3, h: 4 }, height: 96, roof: PALETTE.blueGlaze, left: PALETTE.officialGrey, right: PALETTE.officialGreyDark, eaves: 12 },
  ]
  for (const piece of pieces) {
    assertInside(zone, piece.lot)
    const body =
      piece.eaves > 0
        ? extrude(piece.lot, piece.height, piece.roof, piece.left, piece.right, piece.eaves)
        : extrude(piece.lot, piece.height, piece.roof, piece.left, piece.right, 0)
    pushSprite(sprites, zone, body, piece.lot, RANK_BUILDING, claimed)
  }
}

function paintMarket(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const stalls: Array<{ lot: ZoneFootprint; roof: string }> = [
    { lot: { x: 13, y: 4, w: 2, h: 2 }, roof: PALETTE.awningRed },
    { lot: { x: 15, y: 4, w: 2, h: 2 }, roof: PALETTE.awningGold },
    { lot: { x: 17, y: 4, w: 2, h: 2 }, roof: PALETTE.blueGlaze },
    { lot: { x: 14, y: 6, w: 2, h: 1 }, roof: PALETTE.awningRed },
    { lot: { x: 16, y: 6, w: 2, h: 1 }, roof: PALETTE.awningGold },
  ]
  for (const stall of stalls) {
    assertInside(zone, stall.lot)
    pushSprite(
      sprites,
      zone,
      extrude(stall.lot, 30, stall.roof, PALETTE.plaster, PALETTE.plasterDark, 4),
      stall.lot,
      RANK_BUILDING,
      claimed,
    )
  }
}

function paintForest(ground: string[], sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  pushGround(ground, zone, polygon(diamond(zone), PALETTE.grassForest), claimed)
  for (const tile of tiles(zone)) {
    const scale = 0.85 + ((tile.x * 3 + tile.y) % 3) * 0.18
    pushSprite(sprites, zone, treeBody(tile, PALETTE.grassForest, PALETTE.hill, scale), tile, RANK_TREE, claimed)
  }
}

function paintFarm(ground: string[], zone: CityZone, claimed: Set<string>): void {
  const [north, east, south, west] = diamond(zone)
  const minX = Math.min(west.x, north.x)
  const maxX = Math.max(east.x, south.x)
  const minY = north.y
  const maxY = south.y
  let bands = ""
  for (let y = minY; y < maxY; y += 12) {
    const fill = Math.round((y - minY) / 12) % 2 === 0 ? PALETTE.fieldA : PALETTE.fieldB
    bands += `<rect x="${round(minX)}" y="${round(y)}" width="${round(maxX - minX)}" height="12" fill="${fill}"/>`
  }
  pushGround(
    ground,
    zone,
    `<clipPath id="clip-${zone.id}">${polygon(diamond(zone), PALETTE.fieldA)}</clipPath><g clip-path="url(#clip-${zone.id})">${bands}</g>`,
    claimed,
  )
}

function paintRocks(sprites: Sprite[], zone: CityZone, lotsIn: ZoneFootprint[], claimed: Set<string>): void {
  for (const lot of lotsIn) {
    assertInside(zone, lot)
    pushSprite(sprites, zone, extrude(lot, 18, PALETTE.rock, PALETTE.rock, PALETTE.rockDark, 0), lot, RANK_BUILDING, claimed)
  }
}

function paintPond(ground: string[], zone: CityZone, claimed: Set<string>): void {
  const [north, east, south, west] = diamond(zone)
  const cx = (west.x + east.x) / 2
  const cy = (north.y + south.y) / 2
  const rx = (east.x - west.x) / 5
  const ry = (south.y - north.y) / 5
  pushGround(
    ground,
    zone,
    `${polygon(diamond(zone), PALETTE.pondDeep, PALETTE.stairs, 3)}<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" fill="${PALETTE.pond}"/><ellipse cx="${round(cx - rx * 0.2)}" cy="${round(cy - ry * 0.2)}" rx="${round(rx * 0.45)}" ry="${round(ry * 0.45)}" fill="${PALETTE.pondLight}"/>`,
    claimed,
  )
}

function paintCherry(sprites: Sprite[], zone: CityZone, claimed: Set<string>): void {
  const spots: ZoneFootprint[] = [
    { x: 21, y: 7, w: 1, h: 1 },
    { x: 23, y: 7, w: 1, h: 1 },
    { x: 22, y: 8, w: 1, h: 1 },
    { x: 21, y: 9, w: 1, h: 1 },
    { x: 23, y: 9, w: 1, h: 1 },
  ]
  for (const spot of spots) {
    assertInside(zone, spot)
    pushSprite(sprites, zone, treeBody(spot, PALETTE.cherry, PALETTE.cherryLight, 1.35), spot, RANK_TREE, claimed)
  }
}

function paintFlags(sprites: Sprite[], drill: CityZone): void {
  const corners = [
    { x: drill.x, y: drill.y, w: 1, h: 1 },
    { x: drill.x + drill.w - 1, y: drill.y, w: 1, h: 1 },
    { x: drill.x, y: drill.y + drill.h - 1, w: 1, h: 1 },
    { x: drill.x + drill.w - 1, y: drill.y + drill.h - 1, w: 1, h: 1 },
  ]
  for (const corner of corners) {
    assertInside(drill, corner)
    const [, , south] = diamond(corner)
    const body = `<line x1="${round(south.x)}" y1="${round(south.y)}" x2="${round(south.x)}" y2="${round(south.y - 34)}" stroke="${PALETTE.pillar}" stroke-width="2"/>
      <polygon points="${round(south.x)},${round(south.y - 34)} ${round(south.x + 16)},${round(south.y - 28)} ${round(south.x)},${round(south.y - 22)}" fill="${PALETTE.awningRed}"/>`
    sprites.push({
      anchor: southAnchor(corner),
      rank: RANK_FLAG,
      seq: sprites.length,
      body: `<g data-zone="drill">${body}</g>`,
    })
  }
}

function paintZone(zone: CityZone, ground: string[], sprites: Sprite[], claimed: Set<string>): void {
  switch (zone.id) {
    case "forest":
      paintForest(ground, sprites, zone, claimed)
      return
    case "iron_mine":
      pushGround(ground, zone, polygon(diamond(zone), PALETTE.mine), claimed)
      paintRocks(sprites, zone, [
        { x: 8, y: 1, w: 2, h: 1 },
        { x: 10, y: 0, w: 1, h: 2 },
      ], claimed)
      return
    case "farm":
      paintFarm(ground, zone, claimed)
      return
    case "quarry":
      pushGround(ground, zone, polygon(diamond(zone), PALETTE.rock), claimed)
      paintRocks(sprites, zone, [
        { x: 23, y: 1, w: 2, h: 1 },
        { x: 22, y: 0, w: 1, h: 2 },
      ], claimed)
      return
    case "wall_n":
    case "wall_w":
    case "wall_e":
    case "wall_s_w":
    case "wall_s_e":
      paintWall(sprites, zone, claimed)
      return
    case "gate_s":
      paintGate(sprites, zone, claimed)
      return
    case "beacon":
      paintBeacon(sprites, zone, claimed)
      return
    case "blacksmith": {
      const main = { x: 1, y: 6, w: 3, h: 2 }
      const chimney = { x: 1, y: 5, w: 1, h: 1 }
      assertInside(zone, main)
      assertInside(zone, chimney)
      pushSprite(sprites, zone, extrude(main, 46, PALETTE.clayDark, PALETTE.plasterDark, PALETTE.officialGreyDark, 4), main, RANK_BUILDING, claimed)
      pushSprite(sprites, zone, extrude(chimney, 74, PALETTE.officialGrey, PALETTE.rock, PALETTE.rockDark, 0), chimney, RANK_BUILDING, claimed)
      return
    }
    case "stable":
      paintStable(ground, sprites, zone, claimed)
      return
    case "barracks":
      pushSprite(sprites, zone, extrude(zone, 40, PALETTE.blueGlazeDark, PALETTE.plaster, PALETTE.plasterDark, 4), zone, RANK_BUILDING, claimed)
      return
    case "house_w":
      paintHouses(sprites, zone, 3, 2, claimed)
      return
    case "warehouse":
      pushSprite(sprites, zone, extrude(zone, 52, PALETTE.rock, PALETTE.plaster, PALETTE.plasterDark, 4), zone, RANK_BUILDING, claimed)
      return
    case "house_sw":
      paintHouses(sprites, zone, 3, 2, claimed)
      return
    case "drill_row":
      pushSprite(sprites, zone, extrude(zone, 36, PALETTE.blueGlazeDark, PALETTE.plaster, PALETTE.plasterDark, 3), zone, RANK_BUILDING, claimed)
      return
    case "drill":
      pushGround(ground, zone, polygon(diamond(zone), PALETTE.drillDirt, PALETTE.drillCap, 8), claimed)
      paintFlags(sprites, zone)
      return
    case "road_main":
    case "road_east":
    case "road_gate":
    case "road_mid": {
      const [north, , south] = diamond(zone)
      const line = `<line x1="${round(north.x)}" y1="${round(north.y)}" x2="${round(south.x)}" y2="${round(south.y)}" stroke="${PALETTE.roadJoint}" stroke-width="2"/>`
      pushGround(ground, zone, `${polygon(diamond(zone), PALETTE.roadFill, PALETTE.roadJoint, 3)}${line}`, claimed)
      return
    }
    case "market":
      paintMarket(sprites, zone, claimed)
      return
    case "gov":
      paintGov(sprites, zone, claimed)
      return
    case "plaza":
      pushGround(ground, zone, polygon(diamond(zone), PALETTE.stairs, PALETTE.roadJoint, 2), claimed)
      return
    case "house_c":
      paintHouses(sprites, zone, 2, 2, claimed)
      return
    case "house_s":
      paintHouses(sprites, zone, 3, 2, claimed)
      return
    case "council":
    case "academy":
    case "staff_hall":
    case "warrior_lodge":
    case "clinic":
      hall(sprites, zone, zone, zone.id === "clinic" ? 52 : 64, claimed)
      return
    case "cherry":
      paintCherry(sprites, zone, claimed)
      return
    case "pond":
      paintPond(ground, zone, claimed)
      return
    case "embassy": {
      const wing = { x: 23, y: 13, w: 4, h: 2 }
      assertInside(zone, wing)
      pushSprite(sprites, zone, extrude({ x: 23, y: 15, w: 4, h: 1 }, 18, PALETTE.officialGrey, PALETTE.officialGrey, PALETTE.officialGreyDark, 0), { x: 23, y: 15, w: 4, h: 1 }, RANK_BUILDING, claimed)
      hall(sprites, zone, wing, 70, claimed)
      return
    }
    case "house_e":
      paintHouses(sprites, zone, 2, 2, claimed)
      return
    default:
      throw new Error(`no placeholder for zone ${zone.id}`)
  }
}

function backdrop(): string {
  const hills = [
    [180, 110, 160, 46],
    [520, 96, 210, 52],
    [980, 120, 240, 48],
    [1460, 88, 220, 50],
    [1960, 112, 200, 44],
    [2400, 100, 180, 48],
  ]
    .map(([cx, cy, rx, ry], index) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${index % 2 === 0 ? PALETTE.hillFar : PALETTE.hill}"/>`)
    .join("")
  return `<rect width="${ARTBOARD_W}" height="${ARTBOARD_H}" fill="${PALETTE.grassOuter}"/><rect width="${ARTBOARD_W}" height="160" fill="${PALETTE.sky}"/>${hills}`
}

export function renderCitySvg(layout: CityLayout): string {
  const claimed = new Set<string>()
  const ground: string[] = [backdrop(), polygon(diamond({ x: 1, y: 4, w: 26, h: 19 }), PALETTE.grassInner)]
  const sprites: Sprite[] = []
  for (const zone of layout.zones) paintZone(zone, ground, sprites, claimed)
  for (const zone of layout.zones) {
    if (!claimed.has(zone.id)) throw new Error(`zone ${zone.id} was not drawn`)
  }
  sprites.sort((a, b) => a.anchor - b.anchor || a.rank - b.rank || a.seq - b.seq)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ARTBOARD_W} ${ARTBOARD_H}" width="100%" height="100%" data-layout="iris-v1">`,
    `<desc>Iris v1 主城佔位。28×24，artboard ${ARTBOARD_W}×${ARTBOARD_H}，原點 (1200,192)。由南望北。</desc>`,
    ...ground,
    ...sprites.map((sprite) => sprite.body),
    `</svg>`,
  ].join("")
}

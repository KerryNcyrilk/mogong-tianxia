import { V3_LAYOUT } from "../../demo/cityV3.ts"

/** 信裡寫出的最高級。官方表沒有滿級欄，這只是校準器暫定。 */
export const PROVISIONAL_MAX_LEVEL = 10 as const
export const LAYOUT_DIFF_SCHEMA = "layout-v3-diff.v1"

export type LevelPreset = 1 | 5 | 10

export interface CalZone {
  id: string
  label: string
  levelKind: string | null
  fixedLevel: number | null
  polygon: [number, number][]
  badge: [number, number]
  badgeOffset: [number, number]
  level: number | null
  building: boolean
}

export interface LayoutDiffZone {
  id: string
  polygon: [number, number][]
  badgeOffset: [number, number]
  level: number | null
  building: boolean
}

export interface LayoutV3Diff {
  schema: typeof LAYOUT_DIFF_SCHEMA
  source: "data/cityLayoutV3.json"
  art: { w: number; h: number }
  provisionalMaxLevel: typeof PROVISIONAL_MAX_LEVEL
  note: string
  zones: LayoutDiffZone[]
}

interface Snapshot {
  zones: CalZone[]
}

const listeners = new Set<() => void>()

function artSize(): { w: number; h: number } {
  return { w: V3_LAYOUT.art.w, h: V3_LAYOUT.art.h }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function copyPoly(points: readonly (readonly [number, number])[]): [number, number][] {
  return points.map((point) => [point[0], point[1]])
}

function samePoly(left: readonly (readonly [number, number])[], right: readonly (readonly [number, number])[]): boolean {
  if (left.length !== right.length) return false
  return left.every((point, index) => point[0] === right[index]?.[0] && point[1] === right[index]?.[1])
}

function freshZones(): CalZone[] {
  return V3_LAYOUT.zones.map((zone) => ({
    id: zone.id,
    label: zone.label,
    levelKind: zone.levelKind ?? null,
    fixedLevel: zone.fixedLevel ?? null,
    polygon: copyPoly(zone.polygon),
    badge: [zone.badge[0], zone.badge[1]],
    badgeOffset: [0, 0],
    level: null,
    building: false,
  }))
}

let snapshot: Snapshot = { zones: freshZones() }

function commit(zones: CalZone[]): void {
  snapshot = { zones }
  for (const listener of listeners) listener()
}

function replace(id: string, next: CalZone): boolean {
  const index = snapshot.zones.findIndex((zone) => zone.id === id)
  if (index < 0) return false
  const zones = snapshot.zones.slice()
  zones[index] = next
  commit(zones)
  return true
}

export function subscribeCalibrator(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readCalibrator(): Snapshot {
  return snapshot
}

export function resetCalibrator(): void {
  commit(freshZones())
}

export function artPoint(x: number, y: number): [number, number] {
  const { w, h } = artSize()
  return [clampInt(x, 0, w), clampInt(y, 0, h)]
}

export function moveVertex(zoneId: string, index: number, x: number, y: number): boolean {
  const zone = snapshot.zones.find((item) => item.id === zoneId)
  if (!zone || index < 0 || index >= zone.polygon.length) return false
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  const polygon = copyPoly(zone.polygon)
  polygon[index] = artPoint(x, y)
  return replace(zoneId, { ...zone, polygon })
}

/** x、y 是名牌在原圖上的絕對座標，偏移相對 badge 原點。 */
export function moveBadge(zoneId: string, x: number, y: number): boolean {
  const zone = snapshot.zones.find((item) => item.id === zoneId)
  if (!zone || !Number.isFinite(x) || !Number.isFinite(y)) return false
  const [ax, ay] = artPoint(x, y)
  return replace(zoneId, { ...zone, badgeOffset: [ax - zone.badge[0], ay - zone.badge[1]] })
}

export function batchBuildingLevel(level: LevelPreset): string[] {
  const ids: string[] = []
  const zones = snapshot.zones.map((zone) => {
    if (!zone.levelKind) return zone
    ids.push(zone.id)
    return { ...zone, level }
  })
  commit(zones)
  return ids
}

export function toggleBuilding(zoneId: string): boolean {
  const zone = snapshot.zones.find((item) => item.id === zoneId)
  if (!zone) return false
  return replace(zoneId, { ...zone, building: !zone.building })
}

export function setAllBuilding(building: boolean): void {
  commit(snapshot.zones.map((zone) => ({ ...zone, building })))
}

export function resetZone(zoneId: string): boolean {
  const source = freshZones().find((zone) => zone.id === zoneId)
  if (!source) return false
  return replace(zoneId, source)
}

export function layoutV3Diff(): LayoutV3Diff {
  const zones: LayoutDiffZone[] = []
  for (const zone of snapshot.zones) {
    const source = V3_LAYOUT.zones.find((item) => item.id === zone.id)
    if (!source) continue
    const polygonChanged = !samePoly(zone.polygon, source.polygon)
    const badgeChanged = zone.badgeOffset[0] !== 0 || zone.badgeOffset[1] !== 0
    const levelChanged = zone.level !== null
    const buildingChanged = zone.building
    if (!polygonChanged && !badgeChanged && !levelChanged && !buildingChanged) continue
    zones.push({
      id: zone.id,
      polygon: copyPoly(zone.polygon),
      badgeOffset: [zone.badgeOffset[0], zone.badgeOffset[1]],
      level: zone.level,
      building: zone.building,
    })
  }
  return {
    schema: LAYOUT_DIFF_SCHEMA,
    source: "data/cityLayoutV3.json",
    art: { w: V3_LAYOUT.art.w, h: V3_LAYOUT.art.h },
    provisionalMaxLevel: PROVISIONAL_MAX_LEVEL,
    note: "滿級暫映射為 Lv.10，不是官方滿級。此檔只供校準，不回寫 data/cityLayoutV3.json。",
    zones,
  }
}

export function layoutV3DiffJson(): string {
  return JSON.stringify(layoutV3Diff(), null, 2)
}

export function shownLevel(zone: CalZone): number | null {
  if (zone.level !== null) return zone.level
  if (zone.fixedLevel !== null) return zone.fixedLevel
  if (zone.levelKind) return 1
  return null
}

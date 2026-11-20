import { COLS, ROWS, isCityLayer } from "./coords.ts"
import type { CityLayer } from "./coords.ts"

export const ZONE_ROLES = ["building", "reserve", "pending-gameplay"] as const

export type ZoneRole = (typeof ZONE_ROLES)[number]

export interface ZoneRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CityZone {
  id: string
  name: string
  role: ZoneRole
  rect: ZoneRect
  layer: CityLayer
  builtin: boolean
}

export interface CityLayout {
  schemaVersion: string | null
  source: string | null
  /** False when the file does not claim to be the official delivery table. */
  delivery: boolean
  zones: CityZone[]
}

export interface CityCheck {
  zoneCount: number
  bounds: "PASS" | "FAIL"
  overlap: "PASS" | "FAIL"
  conflicts: readonly string[]
  campusClear: "PASS" | "FAIL"
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function fail(message: string): never {
  throw new Error(`city layout: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isZoneRole(value: string): value is ZoneRole {
  return (ZONE_ROLES as readonly string[]).includes(value)
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${label} must be an integer`)
  return value
}

function readRect(value: unknown, id: string): ZoneRect {
  if (!isRecord(value)) fail(`${id} rect must be an object`)
  const rect = {
    x: readInteger(value.x, `${id} rect.x`),
    y: readInteger(value.y, `${id} rect.y`),
    w: readInteger(value.w, `${id} rect.w`),
    h: readInteger(value.h, `${id} rect.h`),
  }
  if (rect.w < 1 || rect.h < 1) fail(`${id} rect size must be at least 1`)
  return rect
}

function readZone(value: unknown, index: number): CityZone {
  if (!isRecord(value)) fail(`zones[${index}] must be an object`)
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) {
    fail(`zones[${index}].id must be lowercase kebab-case`)
  }
  if (typeof value.name !== "string" || value.name.trim() === "" || value.name !== value.name.trim()) {
    fail(`${value.id} name must be a non-empty string`)
  }
  if (typeof value.role !== "string" || !isZoneRole(value.role)) {
    fail(`${value.id} role must be building, reserve, or pending-gameplay`)
  }
  if (typeof value.layer !== "string" || !isCityLayer(value.layer)) {
    fail(`${value.id} layer must be ground, road, building, or overlay`)
  }
  if (typeof value.builtin !== "boolean") fail(`${value.id} builtin must be a boolean`)
  return {
    id: value.id,
    name: value.name,
    role: value.role,
    rect: readRect(value.rect, value.id),
    layer: value.layer,
    builtin: value.builtin,
  }
}

/** Parse a layout object. Zone rows come only from the JSON; there is no baked-in table. */
export function parseCityLayout(input: unknown): CityLayout {
  if (!isRecord(input)) fail("root must be an object")
  if (!Array.isArray(input.zones)) fail("zones must be an array")
  if ("schemaVersion" in input && input.schemaVersion !== undefined && typeof input.schemaVersion !== "string") {
    fail("schemaVersion must be a string")
  }
  if ("source" in input && input.source !== undefined && typeof input.source !== "string") {
    fail("source must be a string")
  }
  if ("delivery" in input && input.delivery !== undefined && typeof input.delivery !== "boolean") {
    fail("delivery must be a boolean")
  }
  const zones = input.zones.map((zone, index) => readZone(zone, index))
  const seen = new Set<string>()
  for (const zone of zones) {
    if (seen.has(zone.id)) fail(`duplicate id ${zone.id}`)
    seen.add(zone.id)
  }
  return {
    schemaVersion: typeof input.schemaVersion === "string" ? input.schemaVersion : null,
    source: typeof input.source === "string" ? input.source : null,
    delivery: input.delivery === true,
    zones,
  }
}

export function loadCityLayout(json: string): CityLayout {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON"
    fail(`JSON: ${message}`)
  }
  return parseCityLayout(parsed)
}

export function rectInsideBoard(rect: ZoneRect): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= COLS && rect.y + rect.h <= ROWS
}

/** Half-open rectangles. Shared edges are not intersections. */
export function rectsIntersect(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function conflictName(left: string, right: string): string {
  return left < right ? `${left}×${right}` : `${right}×${left}`
}

/**
 * campus-clear passes only when exactly one zone has id `campus`, role `building`,
 * a rect inside the 28×20 board, and no intersection with any other zone.
 */
export function checkCityLayout(layout: CityLayout): CityCheck {
  const bounds = layout.zones.every((zone) => rectInsideBoard(zone.rect)) ? "PASS" : "FAIL"
  const conflicts: string[] = []
  for (let i = 0; i < layout.zones.length; i += 1) {
    const left = layout.zones[i]
    if (!left) continue
    for (let j = i + 1; j < layout.zones.length; j += 1) {
      const right = layout.zones[j]
      if (!right) continue
      if (rectsIntersect(left.rect, right.rect)) conflicts.push(conflictName(left.id, right.id))
    }
  }
  conflicts.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const campuses = layout.zones.filter((zone) => zone.id === "campus")
  const campus = campuses[0]
  const campusClear =
    campuses.length === 1 &&
    campus !== undefined &&
    campus.role === "building" &&
    rectInsideBoard(campus.rect) &&
    layout.zones.every((zone) => zone.id === "campus" || !rectsIntersect(campus.rect, zone.rect))
      ? "PASS"
      : "FAIL"
  return {
    zoneCount: layout.zones.length,
    bounds,
    overlap: conflicts.length === 0 ? "PASS" : "FAIL",
    conflicts,
    campusClear,
  }
}

/** Exactly four lines. Conflicting id pairs are appended to the overlap line. */
export function formatCityCheck(result: CityCheck): string {
  const pairs = result.conflicts.length === 0 ? "" : ` ${result.conflicts.join(" ")}`
  return [
    `zones: ${result.zoneCount}`,
    `bounds: ${result.bounds}`,
    `overlap: ${result.overlap} (${result.conflicts.length} conflicts)${pairs}`,
    `campus-clear: ${result.campusClear}`,
  ].join("\n").concat("\n")
}

export function cityCheckPassed(result: CityCheck): boolean {
  return result.bounds === "PASS" && result.overlap === "PASS" && result.campusClear === "PASS"
}

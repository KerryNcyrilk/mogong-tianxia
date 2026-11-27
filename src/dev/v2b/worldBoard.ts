/**
 * 40×40 開發棋盤。不是 Phase 3 玩法，也不讀草案樣本座標。
 * 關卡點只是標記，不寫 data/stages.json。
 */
export const WORLD_COLS = 40
export const WORLD_ROWS = 40
export const MARKER_KINDS = ["monster", "resource", "stage"] as const
export type MarkerKind = (typeof MARKER_KINDS)[number]

export interface WorldMarker {
  id: string
  kind: MarkerKind
  x: number
  y: number
}

export interface MarchMark {
  markerId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  instant: boolean
  arrived: boolean
}

export interface WorldSnapshot {
  fog: boolean
  coords: boolean
  instantMarch: boolean
  markers: readonly WorldMarker[]
  march: MarchMark | null
}

const listeners = new Set<() => void>()
let seq = 0
let snapshot: WorldSnapshot = {
  fog: false,
  coords: false,
  instantMarch: false,
  markers: [],
  march: null,
}

function emit(next: WorldSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

function cellOk(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WORLD_COLS && y >= 0 && y < WORLD_ROWS
}

export function subscribeWorld(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readWorld(): WorldSnapshot {
  return snapshot
}

export function resetWorld(): void {
  seq = 0
  emit({ fog: false, coords: false, instantMarch: false, markers: [], march: null })
}

export function setFog(fog: boolean): void {
  emit({ ...snapshot, fog })
}

export function setCoords(coords: boolean): void {
  emit({ ...snapshot, coords })
}

export function setInstantMarch(instantMarch: boolean): void {
  emit({ ...snapshot, instantMarch })
}

export function spawnMarker(
  kind: string,
  x: number,
  y: number,
): { ok: true; marker: WorldMarker } | { ok: false; reason: "kind" | "range" | "occupied" } {
  if (!MARKER_KINDS.includes(kind as MarkerKind)) return { ok: false, reason: "kind" }
  if (!cellOk(x, y)) return { ok: false, reason: "range" }
  if (snapshot.markers.some((marker) => marker.x === x && marker.y === y)) return { ok: false, reason: "occupied" }
  seq += 1
  const marker: WorldMarker = { id: `mk_${seq}`, kind: kind as MarkerKind, x, y }
  emit({ ...snapshot, markers: [...snapshot.markers, marker] })
  return { ok: true, marker }
}

/**
 * 瞬達開：標記立刻落到目標，seconds 為 0。
 * 瞬達關：標記留在原格，不套用任何官方行軍秒數（玩法尚未實作）。
 */
export function marchTo(
  markerId: string,
  x: number,
  y: number,
): { ok: true; arrived: boolean; seconds: 0 | null } | { ok: false; reason: "missing" | "range" | "occupied" } {
  const marker = snapshot.markers.find((item) => item.id === markerId)
  if (!marker) return { ok: false, reason: "missing" }
  if (!cellOk(x, y)) return { ok: false, reason: "range" }
  const instant = snapshot.instantMarch
  const occupied = snapshot.markers.some((item) => item.id !== markerId && item.x === x && item.y === y)
  if (instant && occupied) return { ok: false, reason: "occupied" }
  const march: MarchMark = {
    markerId,
    fromX: marker.x,
    fromY: marker.y,
    toX: x,
    toY: y,
    instant,
    arrived: instant,
  }
  const markers = instant
    ? snapshot.markers.map((item) => (item.id === markerId ? { ...item, x, y } : item))
    : snapshot.markers
  emit({ ...snapshot, markers, march })
  return { ok: true, arrived: instant, seconds: instant ? 0 : null }
}

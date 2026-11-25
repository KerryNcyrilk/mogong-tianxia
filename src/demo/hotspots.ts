import hotspotsJson from "../../data/cityHotspots.json"

/** B7 §2.3 預留：整城熱區真源 data/cityHotspots.json（2496×1440 藝術板像素座標）。 */
export interface HotspotPoint {
  x: number
  y: number
}

export interface Hotspot {
  id: string
  label: string
  action: string
  polygon: HotspotPoint[]
}

export interface HotspotFile {
  schemaVersion: string
  source: string
  canvas: { w: number; h: number }
  origin: HotspotPoint
  hotspots: Hotspot[]
}

export const HOTSPOT_FILE = hotspotsJson as unknown as HotspotFile

export interface HotspotBox {
  x: number
  y: number
  w: number
  h: number
}

export function hotspotBox(hotspot: Hotspot): HotspotBox {
  const xs = hotspot.polygon.map((point) => point.x)
  const ys = hotspot.polygon.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function hotspotAt(point: HotspotPoint, file: HotspotFile = HOTSPOT_FILE): Hotspot | null {
  for (const hotspot of file.hotspots) {
    const box = hotspotBox(hotspot)
    if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return hotspot
  }
  return null
}

export function assertHotspotFile(file: HotspotFile = HOTSPOT_FILE): void {
  if (file.schemaVersion !== "cityHotspots.b7.v0.1") throw new Error("cityHotspots.json schema mismatch")
  if (file.canvas.w !== 2496 || file.canvas.h !== 1440) throw new Error("cityHotspots canvas must be 2496×1440")
  if (file.hotspots.length < 4) throw new Error("cityHotspots needs at least 4 hotspots")
  const ids = new Set<string>()
  for (const hotspot of file.hotspots) {
    if (!hotspot.id || ids.has(hotspot.id)) throw new Error(`hotspot id duplicate ${hotspot.id}`)
    ids.add(hotspot.id)
    if (hotspot.polygon.length < 3) throw new Error(`hotspot ${hotspot.id} polygon needs 3+ points`)
    for (const point of hotspot.polygon) {
      if (point.x < 0 || point.y < 0 || point.x > file.canvas.w || point.y > file.canvas.h) {
        throw new Error(`hotspot ${hotspot.id} point out of canvas ${point.x},${point.y}`)
      }
    }
  }
  for (const id of ["gov", "drill", "barrack", "gate_s"]) {
    if (!ids.has(id)) throw new Error(`cityHotspots missing ${id}`)
  }
}

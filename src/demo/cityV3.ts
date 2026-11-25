import layoutJson from "../../data/cityLayoutV3.json"

/**
 * v3 換皮座標權威：data/cityLayoutV3.json（2496×1440 原圖像素）。
 * 舊 data/cityLayout.json 不動，灰盒渲染繼續讀它。
 */
export interface V3Zone {
  id: string
  label: string
  kind: string
  levelKind?: string
  action: string
  tag?: string
  badge: [number, number]
  polygon: [number, number][]
}

export interface V3Layout {
  schema: number
  id: string
  note: string
  art: { src: string; w: number; h: number }
  zones: V3Zone[]
}

export const V3_LAYOUT = layoutJson as V3Layout

export interface V3Box {
  x: number
  y: number
  w: number
  h: number
}

export function zoneBounds(zone: V3Zone): V3Box {
  const xs = zone.polygon.map((point) => point[0])
  const ys = zone.polygon.map((point) => point[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function zoneById(id: string): V3Zone | null {
  return V3_LAYOUT.zones.find((zone) => zone.id === id) ?? null
}

export function v3zones(): V3Zone[] {
  return V3_LAYOUT.zones
}

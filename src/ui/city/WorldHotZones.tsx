import { useState } from "react"
import cityLayoutJson from "../../../data/cityLayout.json"
import { zoneToProjectedPolygon } from "../../city/coords.ts"
import { loadCityLayout } from "../../city/layout.ts"
import { worldBoxToScreen, type ScreenBox } from "./rects.ts"
import { ART_ORIGIN, STYLE, type UiProfile } from "./tokens.ts"

/**
 * E3-5: the 160×50 banners are gone. 校場 and 點兵場 are world zones, so the hot
 * zone is measured from data/cityLayout.json → projected → screen, never hand-picked
 * px. It is rendered as a plain overlay (not a UiNode) so the safe-area line stays
 * meaningful: UI rectangles still never cover a subject, the hot zone is the subject.
 */
const LAYOUT = loadCityLayout(JSON.stringify(cityLayoutJson))

const HOT_ZONES = [
  { id: "drill", name: "校場", note: "B7 已接通・出征" },
  { id: "barrack", name: "點兵場", note: "B7 已接通・徵兵" },
] as const

const CARD = { w: 160, h: 64 } as const

function zoneScreenBox(id: string, zoom: number, profile: UiProfile): ScreenBox {
  const zone = LAYOUT.zones.find((item) => item.id === id)
  if (!zone) throw new Error(`missing zone ${id}`)
  const polygon = zoneToProjectedPolygon(zone, ART_ORIGIN)
  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return worldBoxToScreen({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, zoom, profile)
}

export function WorldHotZones({
  profile,
  zoom,
  onAction,
}: {
  profile: UiProfile
  zoom: number
  onAction: (message: string) => void
}) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <>
      {HOT_ZONES.map((zone) => {
        const box = zoneScreenBox(zone.id, zoom, profile)
        const open = active === zone.id
        const cardX = Math.max(0, box.x + box.w / 2 - CARD.w / 2)
        const cardY = Math.max(0, box.y - CARD.h - 8)
        return (
          <div key={zone.id}>
            <button
              type="button"
              aria-label={zone.name}
              title={zone.name}
              onMouseEnter={() => setActive(zone.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(zone.id)}
              onBlur={() => setActive(null)}
              onClick={() => {
                setActive(open ? null : zone.id)
                onAction(`MOCK_${zone.name}`)
              }}
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                padding: 0,
                border: 0,
                background: "transparent",
                boxShadow: open ? `inset 0 0 0 1px ${STYLE.gold}` : "none",
                cursor: "pointer",
                zIndex: 2,
              }}
            />
            {open ? (
              <div
                style={{
                  position: "absolute",
                  left: cardX,
                  top: cardY,
                  width: CARD.w,
                  height: CARD.h,
                  background: STYLE.panelRaise,
                  color: STYLE.text,
                  boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${STYLE.gold}`,
                  fontFamily: STYLE.fontTitle,
                  fontSize: 12,
                  lineHeight: 1.2,
                  padding: 6,
                  boxSizing: "border-box",
                  zIndex: 4,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: STYLE.gold }}>{zone.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: STYLE.textMuted }}>{zone.note}</p>
                <button
                  type="button"
                  data-ui-id={`zone-enter-${zone.id}`}
                  title={`${zone.name} ${zone.note}`}
                  onClick={() => {
                    setActive(null)
                    onAction(`MOCK_${zone.name}`)
                  }}
                  style={{
                    position: "absolute",
                    left: 6,
                    bottom: 6,
                    width: 40,
                    height: 20,
                    padding: 0,
                    border: 0,
                    background: STYLE.gold,
                    color: STYLE.border,
                    boxShadow: `inset 0 0 0 1px ${STYLE.border}`,
                    fontFamily: STYLE.fontValue,
                    fontSize: 10,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  進入
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

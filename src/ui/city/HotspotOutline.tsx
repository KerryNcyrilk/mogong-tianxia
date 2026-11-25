import { HOTSPOT_FILE, hotspotBox } from "../../demo/hotspots.ts"
import { resolutionScale, worldBoxToScreen } from "./rects.ts"
import { STYLE, type UiProfile } from "./tokens.ts"

/** B7 §2.3：熱區開關的顯示層。多邊形座標取自 data/cityHotspots.json（2496×1440 藝術板）。 */
export function HotspotOutline({ profile, zoom }: { profile: UiProfile; zoom: number }) {
  const resScale = resolutionScale(profile)
  const factor = zoom * resScale
  const offset = { x: profile.camera.offsetX, y: profile.camera.offsetY }
  return (
    <>
      <svg
        data-ui-id="hotspot-outline"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
      >
        {HOTSPOT_FILE.hotspots.map((hotspot) => (
          <polygon
            key={hotspot.id}
            points={hotspot.polygon
              .map((point) => `${point.x * factor + offset.x},${point.y * factor + offset.y}`)
              .join(" ")}
            fill="none"
            stroke={STYLE.gold}
            strokeWidth={1}
          />
        ))}
      </svg>
      {HOTSPOT_FILE.hotspots.map((hotspot) => {
        const box = worldBoxToScreen(hotspotBox(hotspot), zoom, profile)
        return (
          <span
            key={hotspot.id}
            data-hotspot-id={hotspot.id}
            title={`${hotspot.label}｜${hotspot.action}`}
            style={{
              position: "absolute",
              left: box.x + 2,
              top: box.y + 2,
              padding: "0 2px",
              background: STYLE.panel,
              color: STYLE.gold,
              fontFamily: STYLE.fontTitle,
              fontSize: 10,
              lineHeight: "14px",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            {hotspot.label}
          </span>
        )
      })}
    </>
  )
}

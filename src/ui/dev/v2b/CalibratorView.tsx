import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react"
import { createPortal } from "react-dom"
import { V3_LAYOUT } from "../../../demo/cityV3.ts"
import { pushDevEvent } from "../../../dev/v2b/eventRing.ts"
import {
  PROVISIONAL_MAX_LEVEL,
  batchBuildingLevel,
  layoutV3Diff,
  layoutV3DiffJson,
  moveBadge,
  moveVertex,
  readCalibrator,
  resetCalibrator,
  resetZone,
  setAllBuilding,
  shownLevel,
  subscribeCalibrator,
  toggleBuilding,
  type LevelPreset,
} from "../../../dev/v2b/layoutCalibrator.ts"
import { mapFrames } from "../../../dev/v2b/mapFrame.ts"
import { STYLE } from "../../city/tokens.ts"
import { chip, downloadJson, fieldStyle } from "./chrome.tsx"

function useViewport(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return size
}

export function CalibratorView() {
  const snap = useSyncExternalStore(subscribeCalibrator, readCalibrator, readCalibrator)
  const [selected, setSelected] = useState(snap.zones[0]?.id ?? "")
  const [overlay, setOverlay] = useState(true)
  const zone = snap.zones.find((item) => item.id === selected) ?? snap.zones[0]
  const changed = layoutV3Diff().zones.length

  function level(preset: LevelPreset) {
    const ids = batchBuildingLevel(preset)
    pushDevEvent("calibrator.level", { level: preset, count: ids.length })
  }

  return (
    <div data-ui-id="dev_v2b_calibrator">
      <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>
        十五區疊在主城上。拖頂點或名牌只改記憶體，匯出 layout-v3-diff.json，不寫回原檔。滿級暫定 Lv.{PROVISIONAL_MAX_LEVEL}。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" style={chip(overlay)} onClick={() => setOverlay((value) => !value)}>
          {overlay ? "隱藏疊加" : "顯示疊加"}
        </button>
        <button type="button" style={chip(false)} onClick={() => level(1)}>
          批次 Lv.1
        </button>
        <button type="button" style={chip(false)} onClick={() => level(5)}>
          批次 Lv.5
        </button>
        <button type="button" style={chip(false)} onClick={() => level(10)}>
          批次 Lv.10
        </button>
        <button type="button" style={chip(false)} onClick={() => level(PROVISIONAL_MAX_LEVEL)}>
          批次滿級
        </button>
      </div>
      <p style={{ margin: "6px 0", color: STYLE.textMuted }}>滿級暫映射為 Lv.{PROVISIONAL_MAX_LEVEL}，不是官方滿級。只套在有 levelKind 的六種建築。</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>區</span>
        <select value={zone?.id ?? ""} onChange={(event) => setSelected(event.target.value)} style={{ ...fieldStyle(), width: "auto" }}>
          {snap.zones.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {zone ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "0 0 4px" }}>
            {zone.label}　名牌偏移 {zone.badgeOffset[0]}, {zone.badgeOffset[1]}
            {zone.level !== null ? `　臨時 Lv.${zone.level}` : ""}
            {zone.building ? "　建造中" : ""}
          </p>
          {zone.polygon.map((point, index) => (
            <p key={`${zone.id}-${index}`} style={{ margin: 0, color: STYLE.textMuted }}>
              頂點 {index}　{point[0]}, {point[1]}
            </p>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              style={chip(zone.building)}
              onClick={() => {
                toggleBuilding(zone.id)
                pushDevEvent("calibrator.building", { zoneId: zone.id, building: !zone.building })
              }}
            >
              切換建造中
            </button>
            <button
              type="button"
              style={chip(false)}
              onClick={() => {
                setAllBuilding(true)
                pushDevEvent("calibrator.building", { zoneId: "*", building: true })
              }}
            >
              全部建造中
            </button>
            <button
              type="button"
              style={chip(false)}
              onClick={() => {
                setAllBuilding(false)
                pushDevEvent("calibrator.building", { zoneId: "*", building: false })
              }}
            >
              清掉浮標
            </button>
            <button type="button" style={chip(false)} onClick={() => resetZone(zone.id)}>
              還原此區
            </button>
            <button type="button" style={chip(false)} onClick={() => resetCalibrator()}>
              還原全部
            </button>
          </div>
        </div>
      ) : null}
      <p style={{ margin: "8px 0", color: STYLE.gold }}>差異 {changed} 區</p>
      <button
        type="button"
        style={chip(true)}
        onClick={() => {
          const text = layoutV3DiffJson()
          pushDevEvent("calibrator.export", { zones: layoutV3Diff().zones.length })
          downloadJson("layout-v3-diff.json", text)
        }}
      >
        匯出 layout-v3-diff.json
      </button>
      {overlay ? <CalibratorOverlay selected={zone?.id ?? ""} onSelect={setSelected} /> : null}
    </div>
  )
}

function CalibratorOverlay({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const snap = useSyncExternalStore(subscribeCalibrator, readCalibrator, readCalibrator)
  const viewport = useViewport()
  const frames = mapFrames(viewport.w, viewport.h)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const artW = V3_LAYOUT.art.w
  const artH = V3_LAYOUT.art.h
  const box = {
    position: "fixed" as const,
    left: frames.leftW + frames.cover.x,
    top: frames.cover.y,
    width: frames.cover.w,
    height: frames.cover.h,
    zIndex: 70,
    pointerEvents: "none" as const,
  }

  function drag(event: ReactPointerEvent, apply: (x: number, y: number) => void, done: () => void) {
    event.preventDefault()
    event.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    const move = (ev: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = ((ev.clientX - rect.left) / rect.width) * artW
      const y = ((ev.clientY - rect.top) / rect.height) * artH
      apply(x, y)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      done()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return createPortal(
    <div data-ui-id="dev_v2b_overlay">
      <div
        data-ui-id="dev_v2b_zoom04"
        style={{
          position: "fixed",
          left: frames.leftW + frames.zoom04.x,
          top: frames.zoom04.y,
          width: frames.zoom04.w,
          height: frames.zoom04.h,
          boxShadow: `inset 0 0 0 2px ${STYLE.cinnabar}`,
          zIndex: 70,
          pointerEvents: "none",
        }}
      >
        <span style={{ position: "absolute", left: 4, top: 4, color: STYLE.cinnabar, background: STYLE.border, fontSize: 11 }}>
          zoom=0.4
        </span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${artW} ${artH}`} preserveAspectRatio="none" style={box}>
        {snap.zones.map((zone) => (
          <polygon
            key={zone.id}
            points={zone.polygon.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke={zone.id === selected ? STYLE.cinnabar : STYLE.gold}
            strokeWidth={zone.id === selected ? 10 : 6}
          />
        ))}
        {snap.zones.map((zone) =>
          zone.polygon.map((point, index) => (
            <circle
              key={`${zone.id}-${index}`}
              cx={point[0]}
              cy={point[1]}
              r={zone.id === selected ? 18 : 12}
              fill={zone.id === selected ? STYLE.cinnabar : STYLE.gold}
              style={{ pointerEvents: "all", cursor: "grab" }}
              onPointerDown={(event) => {
                onSelect(zone.id)
                drag(
                  event,
                  (x, y) => moveVertex(zone.id, index, x, y),
                  () => pushDevEvent("calibrator.vertex", { zoneId: zone.id, index }),
                )
              }}
            />
          )),
        )}
      </svg>
      <div style={box}>
        {snap.zones.map((zone) => {
          const x = zone.badge[0] + zone.badgeOffset[0]
          const y = zone.badge[1] + zone.badgeOffset[1]
          const level = shownLevel(zone)
          return (
            <div key={zone.id}>
              <div
                style={{
                  position: "absolute",
                  left: `${(x / artW) * 100}%`,
                  top: `${(y / artH) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  background: zone.id === selected ? STYLE.gold : STYLE.border,
                  color: zone.id === selected ? STYLE.border : STYLE.text,
                  border: `1px solid ${STYLE.gold}`,
                  fontSize: 11,
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                  pointerEvents: "auto",
                  cursor: "grab",
                }}
                onPointerDown={(event) => {
                  onSelect(zone.id)
                  drag(
                    event,
                    (px, py) => moveBadge(zone.id, px, py),
                    () => pushDevEvent("calibrator.badge", { zoneId: zone.id }),
                  )
                }}
              >
                {level !== null ? `${zone.label} Lv.${level}` : zone.label}
              </div>
              {zone.building ? (
                <div
                  style={{
                    position: "absolute",
                    left: `${(x / artW) * 100}%`,
                    top: `calc(${(y / artH) * 100}% + 14px)`,
                    transform: "translate(-50%, 0)",
                    background: STYLE.building,
                    color: STYLE.text,
                    border: `1px solid ${STYLE.gold}`,
                    fontSize: 10,
                    padding: "1px 4px",
                    pointerEvents: "none",
                  }}
                >
                  建造中
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}

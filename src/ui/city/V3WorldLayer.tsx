import { useState } from "react"
import { STYLE } from "./tokens.ts"
import type { V3Box } from "../../demo/cityV3.ts"
import { V3_LAYOUT } from "../../demo/cityV3.ts"
import type { InternalState } from "../../internal/types.ts"

interface Props {
  frame: V3Box
  internal: InternalState
  onAction: (message: string) => void
  /** 熱區開關：顯示全部名稱。 */
  showAllNames?: boolean
  /** 證據截圖用：強制亮起某個 zone，例如 ?focus=gov。 */
  focusId?: string | null
}

const CHIP = {
  position: "absolute" as const,
  transform: "translate(-50%, -50%)",
  background: STYLE.border,
  color: STYLE.gold,
  border: `1px solid ${STYLE.gold}`,
  borderRadius: 2,
  fontFamily: STYLE.fontValue,
  fontSize: 12,
  lineHeight: 1.2,
  padding: "3px 7px",
  whiteSpace: "nowrap" as const,
  pointerEvents: "none" as const,
}

const BUILD_CHIP = {
  ...CHIP,
  background: STYLE.panelRaise,
  color: STYLE.text,
  border: `1px solid ${STYLE.cinnabar}`,
  fontSize: 12,
}

export function V3WorldLayer({ frame, internal, onAction, showAllNames = false, focusId = null }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const art = V3_LAYOUT.art
  const activeId = hoverId ?? focusId

  return (
    <div
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        border: `1px solid ${STYLE.gold}`,
        boxSizing: "border-box",
      }}
    >
      <img
        src={art.src}
        alt=""
        draggable={false}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <svg
        viewBox={`0 0 ${art.w} ${art.h}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
      >
        {V3_LAYOUT.zones.map((zone) => {
          const on = zone.id === activeId
          const points = zone.polygon.map((point) => point.join(",")).join(" ")
          return (
            <polygon
              key={zone.id}
              points={points}
              fill="none"
              stroke={on ? STYLE.complete : STYLE.gold}
              strokeWidth={on ? 6 : 2}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onPointerEnter={() => setHoverId(zone.id)}
              onPointerLeave={() => setHoverId((current) => (current === zone.id ? null : current))}
              onClick={() => onAction(zone.action)}
            />
          )
        })}
      </svg>
      {V3_LAYOUT.zones.map((zone) => {
        const [bx, by] = zone.badge
        const left = `${(bx / art.w) * 100}%`
        const top = `${(by / art.h) * 100}%`
        const level = zone.levelKind ? (internal.levels[zone.levelKind] ?? 1) : undefined
        const slot = zone.levelKind
          ? internal.slots.find((item) => item.kind === zone.levelKind && item.status !== "done")
          : undefined
        const named = showAllNames || zone.id === activeId
        return (
          <div key={`chip_${zone.id}`}>
            {named ? (
              <div style={{ ...CHIP, left, top: `${((by - 46) / art.h) * 100}%` }}>{zone.label}</div>
            ) : null}
            {level !== undefined ? (
              <div style={{ ...CHIP, left, top }}>{`Lv.${level}`}</div>
            ) : zone.tag ? (
              <div style={{ ...CHIP, left, top, color: STYLE.text, border: `1px solid ${STYLE.cinnabar}` }}>{zone.tag}</div>
            ) : null}
            {slot ? (
              <div
                style={{
                  ...BUILD_CHIP,
                  left: `${((bx + 62) / art.w) * 100}%`,
                  top: `${((by + (level !== undefined ? 26 : -26)) / art.h) * 100}%`,
                }}
              >
                {slot.status === "building" ? `建造中 ${Math.max(0, Math.ceil(slot.remaining))}秒` : "排隊待建"}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

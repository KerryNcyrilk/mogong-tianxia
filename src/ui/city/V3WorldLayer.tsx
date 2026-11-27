import { useState } from "react"
import { asset } from "../../lib/asset.ts"
import { STYLE } from "./tokens.ts"
import { V3_LAYOUT, type V3Zone } from "../../demo/cityV3.ts"
import type { InternalState } from "../../internal/types.ts"

/** v3 世界層：底圖鋪滿 frame，名牌常駐，hover 以同圖裁切提亮做光暈，不再畫方框。 */
interface Props {
  frame: { x: number; y: number; w: number; h: number }
  internal: InternalState
  onAction: (message: string) => void
  scale?: number
  /** 證據截圖用：強制亮起某個 zone，例如 ?focus=gov。 */
  focusId?: string | null
}

const CHIP = {
  position: "absolute" as const,
  transform: "translate(-50%, -50%)",
  background: STYLE.border,
  color: STYLE.text,
  border: `1px solid ${STYLE.gold}`,
  fontFamily: STYLE.fontValue,
  lineHeight: 1.2,
  padding: "2px 6px",
  whiteSpace: "nowrap" as const,
  pointerEvents: "none" as const,
}

export function V3WorldLayer({ frame, internal, onAction, scale = 1, focusId = null }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const art = V3_LAYOUT.art
  const activeId = hoverId ?? focusId
  const hovered: V3Zone | null = V3_LAYOUT.zones.find((zone) => zone.id === activeId) ?? null
  const chipFont = Math.round(11 * scale)

  return (
    <div
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        overflow: "hidden",
        background: STYLE.grass,
      }}
    >
      <img
        src={asset(art.src)}
        alt=""
        draggable={false}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <svg
        viewBox={`0 0 ${art.w} ${art.h}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <clipPath id="v3-hover-clip">
            {hovered ? <polygon points={hovered.polygon.map((point) => point.join(",")).join(" ")} /> : null}
          </clipPath>
        </defs>
        {hovered ? (
          <image
            href={asset(art.src)}
            x={0}
            y={0}
            width={art.w}
            height={art.h}
            preserveAspectRatio="none"
            clipPath="url(#v3-hover-clip)"
            style={{ filter: `brightness(1.28) drop-shadow(0 0 10px ${STYLE.gold})` }}
          />
        ) : null}
        {V3_LAYOUT.zones.map((zone) => (
          <polygon
            key={zone.id}
            points={zone.polygon.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke="none"
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onPointerEnter={() => setHoverId(zone.id)}
            onPointerLeave={() => setHoverId((current) => (current === zone.id ? null : current))}
            onClick={() => onAction(zone.action)}
          />
        ))}
      </svg>
      {V3_LAYOUT.zones.map((zone) => {
        const [bx, by] = zone.badge
        const level = zone.levelKind ? (internal.levels[zone.levelKind] ?? 1) : zone.fixedLevel
        const slot = zone.levelKind
          ? internal.slots.find((item) => item.kind === zone.levelKind && item.status !== "queued")
          : undefined
        const on = zone.id === activeId
        const left = `${(bx / art.w) * 100}%`
        const top = `${(by / art.h) * 100}%`
        const pct = slot && slot.seconds > 0 ? Math.max(0, Math.min(1, 1 - slot.remaining / slot.seconds)) : 0
        return (
          <div key={`chip_${zone.id}`}>
            <div
              style={{
                ...CHIP,
                left,
                top,
                fontSize: chipFont,
                background: on ? STYLE.gold : STYLE.border,
                color: on ? STYLE.border : STYLE.text,
                border: `1px solid ${on ? STYLE.text : STYLE.gold}`,
                boxShadow: on ? `0 0 ${Math.round(10 * scale)}px ${STYLE.gold}` : "none",
              }}
            >
              {level !== undefined ? `${zone.label} Lv.${level}` : zone.label}
            </div>
            {slot ? (
              <div
                style={{
                  position: "absolute",
                  left,
                  top: `calc(${top} + ${Math.round(14 * scale)}px)`,
                  transform: "translate(-50%, 0)",
                  width: `${Math.round(70 * scale)}px`,
                  height: `${Math.max(2, Math.round(4 * scale))}px`,
                  background: STYLE.border,
                  boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: `${pct * 100}%`,
                    height: "100%",
                    background: slot.status === "done" ? STYLE.complete : STYLE.building,
                  }}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

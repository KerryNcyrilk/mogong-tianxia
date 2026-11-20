import type { CSSProperties, ReactNode } from "react"
import { place } from "./box.ts"
import { STYLE, type UiNode, type UiProfile } from "./tokens.ts"

export function Panel({
  node,
  profile,
  children,
}: {
  node: UiNode
  profile: UiProfile
  children: ReactNode
}) {
  return (
    <section
      data-ui-id={node.id}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: `linear-gradient(180deg, ${STYLE.panelRaise} 0%, ${STYLE.panel} 100%)`,
        color: STYLE.text,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {children}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 6,
          boxShadow: `inset 0 0 0 ${profile.borderOuter}px ${STYLE.border}, inset 0 0 0 ${profile.borderOuter + profile.borderInner}px ${STYLE.gold}`,
        }}
      />
    </section>
  )
}

export function FaceButton({
  origin,
  face,
  hit,
  disabled = false,
  title,
  background = STYLE.panelRaise,
  color = STYLE.text,
  radius = 0,
  stacked = false,
  onClick,
  children,
}: {
  origin: { x: number; y: number }
  face: UiNode
  hit?: UiNode
  disabled?: boolean
  title?: string
  background?: string
  color?: string
  radius?: number
  stacked?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const box = hit ?? face
  const faceStyle: CSSProperties = {
    position: "absolute",
    left: face.x - box.x,
    top: face.y - box.y,
    width: face.w,
    height: face.h,
    display: "flex",
    flexDirection: stacked ? "column" : "row",
    alignItems: "center",
    justifyContent: "center",
    gap: stacked ? 1 : 0,
    background,
    color,
    borderRadius: radius,
    boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
    fontFamily: STYLE.fontTitle,
    fontSize: face.fontSize,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    pointerEvents: "none",
  }
  return (
    <button
      type="button"
      data-ui-id={face.id}
      disabled={disabled}
      title={title}
      onClick={disabled ? undefined : onClick}
      style={{
        ...place(box, origin),
        padding: 0,
        border: 0,
        background: "transparent",
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        zIndex: 2,
      }}
    >
      <span className="city-face" style={faceStyle}>
        {children}
      </span>
    </button>
  )
}

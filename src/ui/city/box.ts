import type { CSSProperties } from "react"
import { STYLE, type UiNode } from "./tokens.ts"

export function place(node: UiNode, origin: { x: number; y: number }): CSSProperties {
  return {
    position: "absolute",
    left: node.x - origin.x,
    top: node.y - origin.y,
    width: node.w,
    height: node.h,
    boxSizing: "border-box",
  }
}

export function textFace(node: UiNode, kind: "title" | "value", color: string = STYLE.text): CSSProperties {
  return {
    fontFamily: kind === "value" ? STYLE.fontValue : STYLE.fontTitle,
    fontSize: node.fontSize,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    color,
    margin: 0,
  }
}

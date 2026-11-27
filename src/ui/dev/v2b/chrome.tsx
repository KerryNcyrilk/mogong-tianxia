import type { CSSProperties } from "react"
import { STYLE } from "../../city/tokens.ts"

export function chip(active: boolean): CSSProperties {
  return {
    background: active ? STYLE.gold : STYLE.panelRaise,
    color: active ? STYLE.border : STYLE.text,
    border: `1px solid ${STYLE.gold}`,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer",
  }
}

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function fieldStyle(): CSSProperties {
  return {
    width: 72,
    background: STYLE.panel,
    color: STYLE.text,
    border: `1px solid ${STYLE.queued}`,
  }
}

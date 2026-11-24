/**
 * Dev overlay. Spec §7: 560×340, 12px clear of the build queue, 10 Hz, five colours,
 * ERROR freezes with a red frame, click a row to expand `data`, Shift+wheel scrolls sideways.
 * Imported only by ./index.ts, so it never reaches a prod bundle.
 */
import { LEVELS, type Entry, type Level } from "./types.ts"

export interface OverlayDeps {
  entries: () => readonly Entry[]
  droppedCount: () => number
  currentLevel: () => Level
  setLevel: (level: Level) => void
  clear: () => void
  exportText: () => string
  onRecord: (listener: (entry: Entry) => void) => () => void
  setFrame: (frame: number) => void
}

const RECT = { x: 700, y: 300, w: 560, h: 340 } as const
const REFRESH_MS = 100

const COLOUR: Record<Level, string> = {
  TRACE: "#7A7A7A",
  DEBUG: "#8FB3C7",
  INFO: "#E8DCC0",
  WARN: "#C9A227",
  ERROR: "#A5342A",
}

function hotspot(width: number) {
  return width >= 1920 ? 1.5 : 1
}

export function installOverlay(deps: OverlayDeps): () => void {
  if (typeof document === "undefined") return () => undefined
  const { entries, droppedCount, currentLevel, setLevel, clear, exportText, setFrame } = deps
  const box = document.createElement("div")
  const head = document.createElement("div")
  const body = document.createElement("div")
  const factor = hotspot(window.innerWidth)

  box.style.cssText = `position:fixed;left:${RECT.x * factor}px;top:${RECT.y * factor}px;width:${RECT.w * factor}px;height:${RECT.h * factor}px;background:rgba(14,14,14,0.88);border:1px solid ${COLOUR.INFO};color:${COLOUR.INFO};font:${10 * factor}px/1.35 ui-monospace,Menlo,Consolas,monospace;display:none;z-index:99999;pointer-events:auto`
  head.style.cssText = "padding:2px 6px;border-bottom:1px solid #C8A96B;white-space:nowrap;overflow:hidden"
  body.style.cssText = "position:absolute;left:0;top:22px;right:0;bottom:0;overflow:auto;padding:2px 6px"
  box.append(head, body)
  document.body.append(box)

  let frozen = false
  let pending = false
  const expanded = new Set<number>()

  function render(): void {
    const all = entries()
    const shown = all.slice(-220)
    head.textContent = `lvl ${currentLevel()}  dropped ${droppedCount()}  shown ${shown.length}/${all.length}  [F9 收 / F10 清 / F11 複製]${frozen ? "  FROZEN" : ""}`
    box.style.borderColor = frozen ? "#A5342A" : "#C8A96B"
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 24
    body.textContent = ""
    for (const entry of shown) {
      const row = document.createElement("div")
      row.textContent = `${entry.iso.slice(11, 23)} ${entry.level.padEnd(5)} ${entry.ch}.${entry.event} #${entry.seq}${entry.ms ? ` ${entry.ms}ms` : ""}`
      row.style.color = COLOUR[entry.level]
      row.style.cursor = "pointer"
      row.style.whiteSpace = "nowrap"
      row.onclick = () => {
        if (expanded.has(entry.seq)) expanded.delete(entry.seq)
        else expanded.add(entry.seq)
        render()
      }
      body.append(row)
      if (expanded.has(entry.seq) && entry.data !== undefined) {
        const detail = document.createElement("pre")
        detail.textContent = JSON.stringify(entry.data, null, 2)
        detail.style.cssText = "margin:0 0 4px 12px;color:#9C8F78;white-space:pre-wrap"
        body.append(detail)
      }
    }
    if (!frozen && atBottom) body.scrollTop = body.scrollHeight
  }

  function schedule(): void {
    if (pending || frozen) return
    pending = true
    window.setTimeout(() => {
      pending = false
      render()
    }, REFRESH_MS)
  }

  const off = deps.onRecord((entry: Entry) => {
    if (entry.level === "ERROR") {
      frozen = true
      box.style.display = "block"
      render()
      return
    }
    schedule()
  })

  function onKey(event: KeyboardEvent): void {
    if (event.key === "F9") {
      event.preventDefault()
      box.style.display = box.style.display === "none" ? "block" : "none"
      frozen = false
      render()
    } else if (event.key === "F10") {
      event.preventDefault()
      clear()
      frozen = false
      render()
    } else if (event.key === "F11") {
      event.preventDefault()
      void navigator.clipboard?.writeText(exportText())
    }
  }

  function onWheel(event: WheelEvent): void {
    if (!event.shiftKey) return
    body.scrollLeft += event.deltaY
    event.preventDefault()
  }

  body.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("keydown", onKey)

  let frame = 0
  let last = 0
  const loop = (now: number) => {
    if (now - last > REFRESH_MS) {
      last = now
      frame += 1
      setFrame(frame)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // level filter: Shift+L cycles DEBUG → INFO → WARN → ERROR → TRACE
  window.addEventListener("keydown", (event) => {
    if (event.key === "L" && event.shiftKey) {
      const index = LEVELS.indexOf(currentLevel())
      setLevel(LEVELS[(index + 1) % LEVELS.length])
      render()
    }
  })

  return () => {
    off()
    window.removeEventListener("keydown", onKey)
    body.removeEventListener("wheel", onWheel)
    box.remove()
  }
}

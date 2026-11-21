import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { clampFocusPoint, DEFAULT_FOCUS, DEFAULT_ZOOM, panFocus, ZOOM_MAX, ZOOM_MIN, type WorldPoint } from "../../city/camera.ts"
import { BottomBar } from "./BottomBar.tsx"
import { CornerButtons } from "./CornerButtons.tsx"
import { fitDisplay, LOCKS, type LockSize } from "./display.ts"
import { LeftPanel } from "./LeftPanel.tsx"
import { FaceButton } from "./parts.tsx"
import { MOCK_CHAT_SEED, MOCK_CHAT_TABS } from "./mock.ts"
import { artboardFrame } from "./rects.ts"
import { WorldLayer } from "./WorldLayer.tsx"
import { CAMERA_ZOOMS, scale, STYLE, UI_1280, uiNode, type UiProfile } from "./tokens.ts"

type ChatId = (typeof MOCK_CHAT_TABS)[number]["id"]
type LockMode = LockSize | "fit"

function emptyChats(): Record<ChatId, string[]> {
  return {
    chat_all: [...MOCK_CHAT_SEED],
    chat_world: [...MOCK_CHAT_SEED],
    chat_party: [...MOCK_CHAT_SEED],
    chat_alliance: [...MOCK_CHAT_SEED],
    chat_dm: [...MOCK_CHAT_SEED],
  }
}

function readLock(): LockMode {
  const size = new URLSearchParams(window.location.search).get("size")
  if (size && Object.prototype.hasOwnProperty.call(LOCKS, size)) return size as LockSize
  return "fit"
}

function readZoom(): number {
  const raw = Number(new URLSearchParams(window.location.search).get("zoom"))
  if (!Number.isFinite(raw) || raw < ZOOM_MIN || raw > ZOOM_MAX) return DEFAULT_ZOOM
  return raw
}

function readShot(): boolean {
  return new URLSearchParams(window.location.search).get("shot") === "1"
}

export function CityScreen() {
  const [lock, setLock] = useState<LockMode>(readLock)
  const [zoom, setZoom] = useState<number>(readZoom)
  const [focus, setFocus] = useState<WorldPoint>(DEFAULT_FOCUS)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [tab, setTab] = useState<"general" | "troops">("general")
  const [chatTab, setChatTab] = useState<ChatId>("chat_all")
  const [drafts, setDrafts] = useState<Record<ChatId, string>>({
    chat_all: "",
    chat_world: "",
    chat_party: "",
    chat_alliance: "",
    chat_dm: "",
  })
  const [chats, setChats] = useState(emptyChats)
  const [outside, setOutside] = useState(false)
  const [exploreOn, setExploreOn] = useState(false)
  const [intelOn, setIntelOn] = useState(false)
  const [log, setLog] = useState("MOCK_待命")
  const [elapsed, setElapsed] = useState(0)
  const shot = readShot()
  const slotRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; x: number; y: number; focus: WorldPoint } | null>(null)

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (lock !== "fit") return
    const el = slotRef.current
    if (!el) return
    const apply = () => {
      const rect = el.getBoundingClientRect()
      setViewport({ w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) })
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [lock, shot])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * 0.0012)
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor))
      setZoom(next)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [lock, shot, zoom])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const step = 120
      if (event.key === "ArrowLeft") setFocus((current) => panFocus(current, -step, 0))
      else if (event.key === "ArrowRight") setFocus((current) => panFocus(current, step, 0))
      else if (event.key === "ArrowUp") setFocus((current) => panFocus(current, 0, -step))
      else if (event.key === "ArrowDown") setFocus((current) => panFocus(current, 0, step))
      else if (event.key === "0" || event.key === "Home") {
        setFocus(DEFAULT_FOCUS)
        setZoom(DEFAULT_ZOOM)
      } else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const fit = lock === "fit" ? fitDisplay(viewport.w, viewport.h) : fitDisplay(LOCKS[lock].w, LOCKS[lock].h)
  const profile: UiProfile = useMemo(() => (fit.scale === 1 ? UI_1280 : scale(UI_1280, fit.scale)), [fit.scale])
  const frame = artboardFrame(zoom, profile, focus)
  const drill = uiNode(profile, "combat_drill")
  const muster = uiNode(profile, "combat_muster")

  function sendChat() {
    const text = drafts[chatTab].trim()
    if (!text) return
    setChats((current) => ({ ...current, [chatTab]: [...current[chatTab], text].slice(-12) }))
    setDrafts((current) => ({ ...current, [chatTab]: "" }))
    setLog(`MOCK_發送${MOCK_CHAT_TABS.find((item) => item.id === chatTab)?.label ?? ""}`)
  }

  function resetCamera() {
    setFocus(DEFAULT_FOCUS)
    setZoom(DEFAULT_ZOOM)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest("button, a, input, textarea, select, label, section, form")) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, focus }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.id !== event.pointerId) return
    const scaleNow = zoom * fit.scale
    if (scaleNow <= 0) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    setFocus(clampFocusPoint({ x: current.focus.x - dx / scaleNow, y: current.focus.y - dy / scaleNow }))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null
  }

  const stage = (
    <div
      ref={stageRef}
      className="city-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => {
        const target = event.target
        if (target instanceof Element && target.closest("button, a, input, textarea, select, label, section, form")) return
        resetCamera()
      }}
      style={{
        position: "relative",
        width: fit.stageW,
        height: fit.stageH,
        background: STYLE.grass,
        overflow: "hidden",
        cursor: "grab",
        flex: "none",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <WorldLayer left={frame.x + fit.hudX} top={frame.y + fit.hudY} width={frame.w} height={frame.h} />
      <div
        className="city-frame"
        style={{
          position: "absolute",
          left: fit.hudX,
          top: fit.hudY,
          width: profile.screenW,
          height: profile.screenH,
          pointerEvents: "none",
          fontFamily: STYLE.fontTitle,
          color: STYLE.text,
        }}
      >
        <FaceButton origin={{ x: 0, y: 0 }} face={drill} disabled stacked title="校場 戰鬥系統待 B6">
          <span>校場</span>
          <span>戰鬥系統待 B6</span>
        </FaceButton>
        <FaceButton origin={{ x: 0, y: 0 }} face={muster} disabled stacked title="點兵場 戰鬥系統待 B6">
          <span>點兵場</span>
          <span>戰鬥系統待 B6</span>
        </FaceButton>
        <LeftPanel profile={profile} tab={tab} log={log} onTab={setTab} onAction={setLog} />
        <BottomBar
          profile={profile}
          chatTab={chatTab}
          messages={chats[chatTab]}
          draft={drafts[chatTab]}
          elapsed={elapsed}
          onChatTab={(id) => {
            setChatTab(id as ChatId)
            setLog(`MOCK_聊天${MOCK_CHAT_TABS.find((item) => item.id === id)?.label ?? ""}`)
          }}
          onDraft={(value) => setDrafts((current) => ({ ...current, [chatTab]: value }))}
          onSend={sendChat}
          onAction={setLog}
        />
        <CornerButtons
          profile={profile}
          outside={outside}
          exploreOn={exploreOn}
          intelOn={intelOn}
          onToggleExit={() => {
            setOutside((current) => !current)
            setLog(outside ? "MOCK_回城" : "MOCK_出城")
          }}
          onExplore={() => {
            setExploreOn((current) => !current)
            setLog("MOCK_探險")
          }}
          onIntel={() => {
            setIntelOn((current) => !current)
            setLog("MOCK_情報")
          }}
        />
      </div>
      {fit.portrait ? (
        <p
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            margin: 0,
            padding: "8px 12px",
            background: STYLE.panel,
            color: STYLE.text,
            textAlign: "center",
            zIndex: 4,
            pointerEvents: "none",
            fontFamily: STYLE.fontTitle,
          }}
        >
          請轉為橫向。直向不重排面板。
        </p>
      ) : null}
    </div>
  )

  return (
    <div style={{ height: shot ? undefined : "100vh", display: "flex", flexDirection: "column", background: STYLE.border, color: STYLE.text }}>
      {shot ? null : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: 12,
            fontFamily: STYLE.fontTitle,
            fontSize: 14,
          }}
        >
          <a href="/" style={{ color: STYLE.gold }}>
            返回戰鬥
          </a>
          <span style={{ color: STYLE.textMuted }}>主城預覽</span>
          <button type="button" onClick={() => setLock("fit")} style={chromeButton(lock === "fit")}>
            隨視窗
          </button>
          <button type="button" onClick={() => setLock("1280")} style={chromeButton(lock === "1280")}>
            1280×720
          </button>
          <button type="button" onClick={() => setLock("1920")} style={chromeButton(lock === "1920")}>
            1920×1080
          </button>
          {CAMERA_ZOOMS.map((step) => (
            <button key={step} type="button" onClick={() => setZoom(step)} style={chromeButton(Math.abs(zoom - step) < 0.001)}>
              {step.toFixed(1)}
            </button>
          ))}
          <button type="button" onClick={resetCamera} style={chromeButton(false)}>
            回中
          </button>
          <span style={{ color: STYLE.textMuted }}>拖曳平移，滾輪縮放，雙擊回中</span>
        </div>
      )}
      <div ref={slotRef} style={{ flex: shot ? undefined : 1, minHeight: 0, overflow: "auto" }}>
        {stage}
      </div>
    </div>
  )
}

function chromeButton(active: boolean) {
  return {
    background: active ? STYLE.gold : STYLE.panel,
    color: active ? STYLE.border : STYLE.text,
    border: `1px solid ${STYLE.gold}`,
    fontFamily: STYLE.fontValue,
    fontSize: 14,
    lineHeight: 1,
    padding: "8px 12px",
    cursor: "pointer",
  }
}

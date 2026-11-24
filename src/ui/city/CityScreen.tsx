import { useEffect, useState } from "react"
import { BottomBar } from "./BottomBar.tsx"
import { CornerButtons } from "./CornerButtons.tsx"
import { LeftPanel } from "./LeftPanel.tsx"
import { MOCK_CHAT_SEED, MOCK_CHAT_TABS } from "./mock.ts"
import { artboardFrame, profileOf } from "./rects.ts"
import { WorldHotZones } from "./WorldHotZones.tsx"
import { CAMERA_DEFAULT_ZOOM, CAMERA_ZOOMS, STYLE, type UiProfile } from "./tokens.ts"

type ChatId = (typeof MOCK_CHAT_TABS)[number]["id"]

function emptyChats(): Record<ChatId, string[]> {
  return {
    chat_all: [...MOCK_CHAT_SEED],
    chat_world: [...MOCK_CHAT_SEED],
    chat_party: [...MOCK_CHAT_SEED],
    chat_alliance: [...MOCK_CHAT_SEED],
    chat_dm: [...MOCK_CHAT_SEED],
  }
}

function initialSize(): 1280 | 1920 {
  return new URLSearchParams(window.location.search).get("size") === "1920" ? 1920 : 1280
}

function initialZoom(): number {
  const raw = Number(new URLSearchParams(window.location.search).get("zoom"))
  return CAMERA_ZOOMS.some((step) => step === raw) ? raw : CAMERA_DEFAULT_ZOOM
}

export function CityScreen() {
  const [size, setSize] = useState<1280 | 1920>(initialSize)
  const [zoom, setZoom] = useState<number>(initialZoom)
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

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const profile: UiProfile = profileOf(size)
  const world = artboardFrame(zoom, profile)

  function sendChat() {
    const text = drafts[chatTab].trim()
    if (!text) return
    setChats((current) => ({ ...current, [chatTab]: [...current[chatTab], text].slice(-12) }))
    setDrafts((current) => ({ ...current, [chatTab]: "" }))
    setLog(`MOCK_發送${MOCK_CHAT_TABS.find((item) => item.id === chatTab)?.label ?? ""}`)
  }

  return (
    <div style={{ minHeight: "100vh", background: STYLE.border, color: STYLE.text }}>
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
        <span style={{ color: STYLE.textMuted }}>主城灰盒</span>
        {[1280, 1920].map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setSize(candidate as 1280 | 1920)}
            style={chromeButton(size === candidate)}
          >
            {candidate === 1280 ? "1280×720" : "1920×1080"}
          </button>
        ))}
        {CAMERA_ZOOMS.map((step) => (
          <button key={step} type="button" onClick={() => setZoom(step)} style={chromeButton(zoom === step)}>
            {step.toFixed(1)}
          </button>
        ))}
      </div>
      <div
        className="city-frame"
        style={{
          position: "relative",
          width: profile.screenW,
          height: profile.screenH,
          margin: "0 12px 12px",
          background: STYLE.grass,
          overflow: "hidden",
          fontFamily: STYLE.fontTitle,
          color: STYLE.text,
        }}
      >
        {outside ? (
          <OutsideScene profile={profile} />
        ) : (
          <>
            <img
              src="/art/board/city-placeholder.svg"
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: world.x,
                top: world.y,
                width: world.w,
                height: world.h,
                pointerEvents: "none",
              }}
            />
            <WorldHotZones profile={profile} zoom={zoom} onAction={setLog} />
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
          </>
        )}
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
    </div>
  )
}

function OutsideScene({ profile }: { profile: UiProfile }) {
  const tiles = ["墨城", "野村", "山口"] as const
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: profile.screenW,
        height: profile.screenH,
        background: STYLE.grass,
        backgroundImage: `linear-gradient(to right, ${STYLE.queued} 1px, transparent 1px), linear-gradient(to bottom, ${STYLE.queued} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: profile.safe.x + 12,
          top: 12,
          padding: "6px 12px",
          background: STYLE.panel,
          color: STYLE.text,
          boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${STYLE.gold}`,
          fontFamily: STYLE.fontTitle,
          fontSize: 12,
        }}
      >
        大地圖（佔位）｜40×40 圖塊｜不接移動與戰鬥
      </div>
      {tiles.map((name, index) => (
        <div
          key={name}
          style={{
            position: "absolute",
            left: profile.safe.x + 60 + index * 200,
            top: 240 + (index % 2) * 80,
            width: 80,
            height: 80,
            display: "grid",
            placeItems: "center",
            background: STYLE.panelRaise,
            color: STYLE.text,
            boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${STYLE.gold}`,
            fontFamily: STYLE.fontTitle,
            fontSize: 12,
          }}
        >
          {name}
        </div>
      ))}
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

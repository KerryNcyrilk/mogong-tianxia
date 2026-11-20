import { useEffect, useState } from "react"
import { BottomBar } from "./BottomBar.tsx"
import { CornerButtons } from "./CornerButtons.tsx"
import { LeftPanel } from "./LeftPanel.tsx"
import { FaceButton } from "./parts.tsx"
import { MOCK_CHAT_SEED, MOCK_CHAT_TABS } from "./mock.ts"
import { artboardFrame, profileOf } from "./rects.ts"
import { CAMERA_DEFAULT_ZOOM, CAMERA_ZOOMS, STYLE, uiNode, type UiProfile } from "./tokens.ts"

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
  const drill = uiNode(profile, "combat_drill")
  const muster = uiNode(profile, "combat_muster")

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
        <FaceButton
          origin={{ x: 0, y: 0 }}
          face={drill}
          disabled
          stacked
          title="校場 戰鬥系統待 B6"
        >
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

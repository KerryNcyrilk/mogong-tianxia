import { useEffect, useState } from "react"
import { sysLog } from "@syslog"
import { BottomBar } from "./BottomBar.tsx"
import { CornerButtons } from "./CornerButtons.tsx"
import { LeftPanel } from "./LeftPanel.tsx"
import { GeneralPanel } from "./GeneralPanel.tsx"
import { MOCK_CHAT_SEED, MOCK_CHAT_TABS } from "./mock.ts"
import { artboardFrame, profileOf } from "./rects.ts"
import { WorldHotZones } from "./WorldHotZones.tsx"
import { CAMERA_DEFAULT_ZOOM, CAMERA_ZOOMS, STYLE, type UiProfile } from "./tokens.ts"
import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { createState, enqueue, formatResource, load, moraleMultiplier, rollEvents, save, setTax, tick, taxRate } from "../../internal/engine.ts"
import type { InternalState, TaxRate } from "../../internal/types.ts"
import { GENERAL_CONFIG } from "../../general/config.ts"
import {
  createRoster,
  equip as equipItem,
  expPct,
  gainExp,
  load as loadRoster,
  recruit,
  refreshTavern,
  save as saveRoster,
  setActive,
  setFormation,
  statsOf,
  troopRows,
} from "../../general/engine.ts"
import type { RosterState } from "../../general/types.ts"

const TAX_ORDER: TaxRate["id"][] = ["low", "mid", "high"]

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
  const [internal, setInternal] = useState<InternalState>(() => load(INTERNAL_CONFIG) ?? createState(INTERNAL_CONFIG))
  const [roster, setRoster] = useState<RosterState>(() => refreshTavern(loadRoster(GENERAL_CONFIG) ?? createRoster(GENERAL_CONFIG), GENERAL_CONFIG))
  const [panel, setPanel] = useState(false)

  useEffect(() => {
    let ticks = 0
    const timer = window.setInterval(() => {
      setInternal((current) => {
        let next = tick(current, INTERNAL_CONFIG, INTERNAL_CONFIG.tickSeconds)
        ticks += 1
        if (ticks % 60 === 0) {
          setRoster((current) => {
            let grown = current
            for (const slot of current.formation) {
              if (slot.generalId) grown = gainExp(grown, slot.generalId, 12, GENERAL_CONFIG).state
            }
            saveRoster(grown)
            return grown
          })
          const rolled = rollEvents(next, INTERNAL_CONFIG, 1)
          next = rolled.state
          if (__SYSLOG__) {
            for (const event of rolled.events) sysLog.warn("internal", "internal.event.fire", event)
            sysLog.info("internal", "internal.tick", { clock: next.clock, morale: next.morale, tax: next.tax })
          }
        }
        if (ticks % 15 === 0) save(next)
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const rate = taxRate(internal, INTERNAL_CONFIG)
  const resourceView: Record<string, { value: string; yieldText: string }> = {}
  for (const def of INTERNAL_CONFIG.resources) {
    const cap = def.cap ? def.cap.base + def.cap.unit * (internal.levels[def.key] ?? def.cap.levels) : null
    const raw = Math.floor(internal.resources[def.key])
    const shown = formatResource(internal, INTERNAL_CONFIG, def.key).replace(`/${cap} 滿`, "")
    resourceView[def.id] = {
      value: shown,
      yieldText: `${cap !== null && raw >= cap ? "滿" : `+${Math.round(def.rate * moraleMultiplier(internal, INTERNAL_CONFIG) * (def.taxable ? rate.tax * 5 : 1))}/時`}`,
    }
  }
  const queueView = internal.slots.map((slot, index) => ({
    id: `queue_${["farm", "storage", "wait"][index] ?? index}`,
    name: slot.kind ? slot.label : "待建",
    level: slot.kind ? slot.levelAtStart + 1 : 0,
    seconds: Math.floor(slot.remaining),
    status: (slot.status === "queued" ? "queued" : "building") as "building" | "queued",
  }))

  useEffect(() => {
    if (__SYSLOG__) sysLog.info("city", "camera.move", { zoom, size })
  }, [zoom, size])

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeGeneral = roster.generals.find((item) => item.id === roster.activeId) ?? roster.generals[0]
  const generalView = activeGeneral
    ? {
        name: activeGeneral.name,
        level: activeGeneral.level,
        expPct: expPct(activeGeneral, GENERAL_CONFIG),
        stat: `攻 ${statsOf(activeGeneral, GENERAL_CONFIG).atk} 防 ${statsOf(activeGeneral, GENERAL_CONFIG).def}`,
        status: roster.formation.some((slot) => slot.generalId === activeGeneral.id) ? "校場列陣" : "待命",
      }
    : null
  const troopView = troopRows(roster, GENERAL_CONFIG)
  const wallet = { coin: internal.resources.coin, jade: internal.resources.jade }

  function leftAction(message: string) {
    if (message === "MOCK_技能" || message === "MOCK_裝備") {
      setPanel(true)
      setLog(`B6 武將面板 ${message.replace("MOCK_", "")}`)
      return
    }
    setLog(message)
  }

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
            <LeftPanel
              profile={profile}
              tab={tab}
              log={log}
              onTab={setTab}
              onAction={leftAction}
              resources={resourceView}
              morale={Math.round(internal.morale)}
              taxLabel={rate.label}
              general={generalView}
              troops={troopView}
            />
            <BottomBar
          profile={profile}
          chatTab={chatTab}
          messages={chats[chatTab]}
          draft={drafts[chatTab]}
          elapsed={elapsed}
          queueSlots={queueView}
          onChatTab={(id) => {
            setChatTab(id as ChatId)
            setLog(`MOCK_聊天${MOCK_CHAT_TABS.find((item) => item.id === id)?.label ?? ""}`)
          }}
          onDraft={(value) => setDrafts((current) => ({ ...current, [chatTab]: value }))}
          onSend={sendChat}
          onAction={(message) => {
            if (message === "MOCK_建築") {
              const result = enqueue(internal, INTERNAL_CONFIG, "house")
              if (result.ok) {
                setInternal(result.state)
                setLog("內政 民居已入隊")
                if (__SYSLOG__) sysLog.info("internal", "internal.queue.change", { kind: "house", action: "enqueue" })
              } else {
                setLog(`內政 建造失敗：${result.reason ?? "unknown"}`)
              }
              return
            }
            if (message.startsWith("MOCK_加刀幣")) {
              const index = TAX_ORDER.indexOf(internal.tax)
              const next = TAX_ORDER[(index + 1) % TAX_ORDER.length]
              setInternal((current) => setTax(current, next))
              setLog(`內政 稅率切至 ${INTERNAL_CONFIG.tax.rates.find((item) => item.id === next)?.label ?? next}`)
              return
            }
            if (message === "MOCK_技能" || message === "MOCK_裝備") {
              setPanel(true)
              setLog(`B6 武將面板 ${message.replace("MOCK_", "")}`)
              return
            }
            setLog(message)
          }}
        />
          </>
        )}
        {panel ? (
          <GeneralPanel
            roster={roster}
            config={GENERAL_CONFIG}
            wallet={wallet}
            onClose={() => setPanel(false)}
            onActive={(id) => setRoster((current) => setActive(current, id).state)}
            onRecruit={(id) => {
              const result = recruit(roster, GENERAL_CONFIG, id, wallet)
              if (!result.ok) {
                setLog(`酒館招募失敗：${result.reason ?? "unknown"}`)
                return
              }
              setRoster(result.state ?? roster)
              saveRoster(result.state)
              const cost = result.cost ?? { coin: 0, jade: 0 }
              setInternal((current) => {
                const next = { ...current, resources: { ...current.resources } }
                next.resources.coin -= cost.coin
                next.resources.jade -= cost.jade
                save(next)
                return next
              })
              setLog("酒館 新武將入麾下")
            }}
            onEquip={(itemId) => {
              if (!activeGeneral) return
              const result = equipItem(roster, activeGeneral.id, itemId, GENERAL_CONFIG)
              if (result.ok) {
                setRoster(result.state)
                saveRoster(result.state)
                setLog("裝備已換")
              }
            }}
            onSlot={(index, id, unit, count) => {
              const result = setFormation(roster, GENERAL_CONFIG, index, id, unit, count)
              if (!result.ok) {
                setLog(`編隊不成立：${result.reason ?? "unknown"}`)
                return
              }
              setRoster(result.state)
              saveRoster(result.state)
              setLog("校場編隊已更新")
            }}
          />
        ) : null}
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

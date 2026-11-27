import { useEffect, useRef, useState } from "react"
import { sysLog } from "@syslog"
import { BottomBar } from "./BottomBar.tsx"
import { CornerButtons } from "./CornerButtons.tsx"
import { LeftPanel } from "./LeftPanel.tsx"
import { GeneralPanel } from "./GeneralPanel.tsx"
import { MOCK_CHAT_SEED, MOCK_CHAT_TABS } from "./mock.ts"
import { profileOf, v3CoverFrame } from "./rects.ts"
import { V3WorldLayer } from "./V3WorldLayer.tsx"
import { UpgradeDialog } from "./UpgradeDialog.tsx"
import { ExpeditionView } from "../expedition/ExpeditionView.tsx"
import { RecruitPanel } from "../expedition/RecruitPanel.tsx"
import { StageMap } from "../expedition/StageMap.tsx"
import { STYLE } from "./tokens.ts"
import { muted as sfxMuted, setMuted, sfxBell, sfxClick, sfxHorn } from "./sfx.ts"
import { markSaved, settleOffline, type OfflineReport } from "./persist.ts"
import { SavePanel } from "./SavePanel.tsx"
import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { claim, createState, enqueue, formatResource, load, moraleMultiplier, rollEvents, save, setTax, tick, taxRate } from "../../internal/engine.ts"
import type { InternalState, TaxRate } from "../../internal/types.ts"
import { GENERAL_CONFIG } from "../../general/config.ts"
import {
  createRoster,
  equip as equipItem,
  expPct,
  formationSummary,
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
import { STAGE_FILE, stageById } from "../../demo/stages.ts"
import { recruitTroops } from "../../demo/recruit.ts"
import {
  applyStartResources,
  bindCity,
  cityHasListeners,
  drillExpOf,
  finishBuildQueue,
  scaledTickSeconds,
  takeRecruitJobs,
  withResource,
  bumpCity,
} from "../../dev/devOverrides.ts"

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

function param(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

function initialSkin(): "v3" | "box" {
  return param("skin") === "box" ? "box" : "v3"
}

/** 滿屏自適應：底欄固定 70 邏輯高，整塊按 viewport 高度等比縮放；左欄 276 同比例。 */
function useStage(): { vw: number; vh: number } {
  const [size, setSize] = useState({ vw: window.innerWidth, vh: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ vw: window.innerWidth, vh: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return size
}

export function CityScreen() {
  const { vw, vh } = useStage()
  const [skin, setSkin] = useState<"v3" | "box">(initialSkin)
  const [focusId] = useState<string | null>(param("focus"))
  const [debug, setDebug] = useState<boolean>(param("debug") === "1")
  const [tab, setTab] = useState<"general" | "troops">("general")
  const [chatTab, setChatTab] = useState<ChatId>("chat_all")
  const [drafts, setDrafts] = useState<Record<ChatId, string>>({ chat_all: "", chat_world: "", chat_party: "", chat_alliance: "", chat_dm: "" })
  const [chats, setChats] = useState(emptyChats)
  const [mapOpen, setMapOpen] = useState(false)
  const [stageId, setStageId] = useState<string | null>(null)
  const [recruitUnit, setRecruitUnit] = useState<string | null>(null)
  const [recruitNotice, setRecruitNotice] = useState("")
  const [exploreOn, setExploreOn] = useState(false)
  const [intelOn, setIntelOn] = useState(false)
  const [log, setLog] = useState("MOCK_待命")
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null)
  const [upgradeKind, setUpgradeKind] = useState<string | null>(param("dialog"))
  const [mute, setMuteState] = useState<boolean>(sfxMuted)
  const [saveOpen, setSaveOpen] = useState<boolean>(param("save") === "1")
  const [offline, setOffline] = useState<OfflineReport | null>(null)
  const offlineDone = useRef(false)
  const [internal, setInternal] = useState<InternalState>(() => load(INTERNAL_CONFIG) ?? createState(INTERNAL_CONFIG))
  const [roster, setRoster] = useState<RosterState>(() => refreshTavern(loadRoster(GENERAL_CONFIG) ?? createRoster(GENERAL_CONFIG), GENERAL_CONFIG))
  const [panel, setPanel] = useState(false)
  const [now, setNow] = useState(Date.now())
  const deadlines = useRef<Map<string, { remaining: number; at: number }>>(new Map())
  const internalRef = useRef(internal)
  const rosterRef = useRef(roster)
  internalRef.current = internal
  rosterRef.current = roster

  // 開發者工具列：?debug=1 或 Ctrl+Shift+D
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") setDebug((current) => !current)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function notify(text: string) {
    setToast({ text, at: Date.now() })
    setLog(text)
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 離線收益：進城即結算（上限 12 小時），彈窗展示。
  useEffect(() => {
    if (offlineDone.current) return
    offlineDone.current = true
    // 證據／開發用：?offline=<分鐘> 模擬上一次存檔時間，方便截離線收益彈窗。
    const minutes = Number(param("offline") ?? 0)
    if (minutes > 0) markSaved(Date.now() - minutes * 60_000)
    const report = settleOffline(internal)
    if (!report) return
    setInternal(report.state)
    save(report.state)
    setOffline(report)
  }, [])

  // 內政 tick：1 秒結算；每 60 秒成長＋事件；完工自動入級。
  // 時間倍率為 1 時走原來的 ticks % 60；大於 1 才按遊戲秒累積。
  useEffect(() => {
    let ticks = 0
    let bank = 0
    const takeMinutes = (seconds: number) => {
      bank += seconds
      const whole = Math.floor(bank / 60)
      if (whole > 0) bank -= whole * 60
      return whole
    }
    const timer = window.setInterval(() => {
      setInternal((current) => {
        const seconds = scaledTickSeconds(INTERNAL_CONFIG.tickSeconds)
        let next = tick(current, INTERNAL_CONFIG, seconds)
        ticks += 1
        for (const slot of next.slots) {
          if (slot.status === "done") {
            const result = claim(next, slot.id)
            if (result.ok) {
              next = result.state
              notify(`${slot.label} 升至 Lv.${slot.levelAtStart + 1}`)
            }
          }
        }
        const pulses = seconds === INTERNAL_CONFIG.tickSeconds ? (ticks % 60 === 0 ? 1 : 0) : takeMinutes(seconds)
        if (pulses > 0) {
          const grant = drillExpOf(12) * pulses
          if (grant > 0) {
            setRoster((roster) => {
              let grown = roster
              for (const slot of roster.formation) {
                if (slot.generalId) grown = gainExp(grown, slot.generalId, grant, GENERAL_CONFIG).state
              }
              saveRoster(grown)
              return grown
            })
          }
          const rolled = rollEvents(next, INTERNAL_CONFIG, pulses)
          next = rolled.state
          if (__SYSLOG__) {
            for (const event of rolled.events) sysLog.warn("internal", "internal.event.fire", event)
            sysLog.info("internal", "internal.tick", { clock: next.clock, morale: next.morale, tax: next.tax })
          }
        }
        if (ticks % 15 === 0) {
          save(next)
          markSaved()
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return bindCity({
      resources: () => internalRef.current.resources,
      slots: () => internalRef.current.slots,
      setResource: (key, value) => {
        setInternal((current) => {
          const next = withResource(current, INTERNAL_CONFIG, key, value)
          save(next)
          markSaved()
          return next
        })
      },
      addResource: (key, delta) => {
        setInternal((current) => {
          const next = withResource(current, INTERNAL_CONFIG, key, current.resources[key] + delta)
          save(next)
          markSaved()
          return next
        })
      },
      finishBuild: () => {
        setInternal((current) => {
          const result = finishBuildQueue(current)
          if (result.finished === 0) return current
          save(result.state)
          markSaved()
          return result.state
        })
      },
      finishRecruit: () => {
        const pending = takeRecruitJobs()
        if (pending.length === 0) return
        let roster = rosterRef.current
        let nextInternal = internalRef.current
        for (const job of pending) {
          const result = recruitTroops(roster, nextInternal, GENERAL_CONFIG, INTERNAL_CONFIG, job.unit, job.amount)
          if (!result.ok) continue
          roster = result.roster
          nextInternal = result.internal
        }
        setRoster(roster)
        saveRoster(roster)
        setInternal(nextInternal)
        save(nextInternal)
        markSaved()
      },
      simulateOffline: (seconds) => {
        const current = internalRef.current
        const next = tick(current, INTERNAL_CONFIG, seconds)
        const rows = INTERNAL_CONFIG.resources
          .map((def) => ({
            key: def.key,
            label: def.name,
            gain: Math.floor(next.resources[def.key] - current.resources[def.key]),
          }))
          .filter((row) => row.gain > 0)
        setInternal(next)
        setOffline({ seconds, rows, state: next })
        save(next)
        markSaved()
      },
      newGame: () => {
        const fresh = applyStartResources(createState(INTERNAL_CONFIG))
        const nextRoster = refreshTavern(createRoster(GENERAL_CONFIG), GENERAL_CONFIG)
        setInternal(fresh)
        setRoster(nextRoster)
        save(fresh)
        saveRoster(nextRoster)
        markSaved()
      },
    })
  }, [])

  useEffect(() => {
    if (!cityHasListeners()) return
    bumpCity()
  }, [internal, roster])

  // 250ms 心跳：讓倒數以 endTime 為準平滑遞減（每秒一跳，唔再 2 秒跳一次）。
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
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
  const queueView = internal.slots.map((slot, index) => {
    const seen = deadlines.current.get(slot.id)
    if (!seen || seen.remaining !== slot.remaining) deadlines.current.set(slot.id, { remaining: slot.remaining, at: now })
    const entry = deadlines.current.get(slot.id)!
    const drift = (Date.now() - entry.at) / 1000
    return {
      id: `queue_${["farm", "storage", "wait"][index] ?? index}`,
      name: slot.kind ? slot.label : "待建",
      level: slot.kind ? slot.levelAtStart + 1 : 0,
      seconds: slot.status === "queued" ? Math.floor(slot.remaining) : Math.max(0, Math.ceil(slot.remaining - drift)),
      status: (slot.status === "queued" ? "queued" : "building") as "building" | "queued",
    }
  })

  useEffect(() => {
    if (__SYSLOG__) sysLog.info("city", "camera.move", { skin, vw, vh })
  }, [skin, vw, vh])

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

  function openUpgrade(kind: string) {
    const building = INTERNAL_CONFIG.buildings.find((item) => item.kind === kind)
    if (!building) return
    setUpgradeKind(kind)
  }

  function confirmUpgrade() {
    if (!upgradeKind) return
    const result = enqueue(internal, INTERNAL_CONFIG, upgradeKind)
    if (!result.ok) {
      notify(result.reason === "not-enough-resource" ? "資源不足" : result.reason === "queue-full" ? "營造隊列已滿" : "無法升級")
      return
    }
    setInternal(result.state)
    save(result.state)
    markSaved()
    sfxBell()
    notify(`${INTERNAL_CONFIG.buildings.find((item) => item.kind === upgradeKind)?.label ?? ""} 開始升級`)
    setUpgradeKind(null)
  }

  function leftAction(message: string) {
    if (message.startsWith("MOCK_升級:")) {
      openUpgrade(message.slice("MOCK_升級:".length))
      return
    }
    if (message.startsWith("MOCK_資源:")) {
      const kind = message.slice("MOCK_資源:".length)
      const name = kind === "forest" ? "森林" : "礦山"
      notify(`${name} Lv.1 產出：${kind === "forest" ? "木材 +40／時" : "生鐵 +30／時"}（MOCK_示範）`)
      return
    }
    if (message === "MOCK_列陣" || message === "MOCK_酒館") {
      setPanel(true)
      notify(message === "MOCK_酒館" ? "酒館 招募與編隊" : "校場 列陣編隊")
      return
    }
    if (message === "MOCK_技能" || message === "MOCK_裝備") {
      setPanel(true)
      notify(`武將面板 ${message.replace("MOCK_", "")}`)
      return
    }
    if (message === "MOCK_校場" || message === "MOCK_出城") {
      setMapOpen(true)
      notify("大地圖 選關卡")
      return
    }
    if (message === "MOCK_點兵場" || message === "MOCK_徵兵") {
      setRecruitUnit("")
      setRecruitNotice("")
      notify("點兵場 徵兵")
      return
    }
    if (message.startsWith("MOCK_徵兵:")) {
      setRecruitUnit(message.slice("MOCK_徵兵:".length))
      setRecruitNotice("")
      return
    }
    notify(message)
  }

  function applySettlement(result: { roster: RosterState; internal: InternalState }) {
    setRoster(result.roster)
    saveRoster(result.roster)
    setInternal(result.internal)
    save(result.internal)
  }

  function sendChat() {
    const text = drafts[chatTab].trim()
    if (!text) return
    setChats((current) => ({ ...current, [chatTab]: [...current[chatTab], text].slice(-12) }))
    setDrafts((current) => ({ ...current, [chatTab]: "" }))
    notify(`MOCK_發送${MOCK_CHAT_TABS.find((item) => item.id === chatTab)?.label ?? ""}`)
  }

  // 版面：底欄固定 70 邏輯高；左欄 276 邏輯寬；其餘全給主城地圖。
  const scale = Math.max(0.72, Math.min(vh / 720, 1.9))
  const leftW = 276 * scale
  const barH = 70 * scale
  const mapW = Math.max(320, vw - leftW)
  const mapH = Math.max(240, vh - barH)
  const profile = profileOf(vh > 950 ? 1920 : 1280)
  const v3frame = v3CoverFrame(0.4, { ...profile, screenW: mapW, screenH: mapH, safe: { x: 0, y: 0, w: mapW, h: mapH } })

  const upgradeBuilding = upgradeKind ? INTERNAL_CONFIG.buildings.find((item) => item.kind === upgradeKind) : undefined

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: STYLE.border, color: STYLE.text }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: leftW, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 276, height: 720, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
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
              troops={troopView.map((row, index) => ({ ...row, id: GENERAL_CONFIG.troops[index]?.id ?? "" }))}
            />
          </div>
        </div>
        <div style={{ position: "absolute", left: leftW, top: 0, width: mapW, height: mapH, overflow: "hidden" }}>
          {skin === "v3" ? (
            <V3WorldLayer frame={v3frame} internal={internal} onAction={leftAction} scale={scale} focusId={focusId} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: STYLE.grass, display: "grid", placeItems: "center", color: STYLE.textMuted }}>
              灰盒預覽已切走；?skin=v3 為主城寫實版
            </div>
          )}
          <CornerButtons
            scale={scale}
            outside={mapOpen}
            exploreOn={exploreOn}
            intelOn={intelOn}
            onToggleExit={() => {
              setMapOpen((current) => !current)
              notify(mapOpen ? "回城" : "出城")
            }}
            onExplore={() => {
              setExploreOn((current) => !current)
              notify("探險")
            }}
            onIntel={() => {
              setIntelOn((current) => !current)
              notify("情報")
            }}
            onSave={() => setSaveOpen((current) => !current)}
            muted={mute}
            onToggleMute={() => {
              const next = !mute
              setMuteState(next)
              setMuted(next)
              if (!next) sfxClick()
              notify(next ? "已靜音" : "音效已開")
            }}
          />
          {mapOpen ? (
            <StageMap
              file={STAGE_FILE}
              formation={formationSummary(roster, GENERAL_CONFIG)}
              ready={roster.formation.some((slot) => slot.generalId)}
              onPick={(id) => {
                setMapOpen(false)
                setStageId(id)
              }}
              onClose={() => setMapOpen(false)}
            />
          ) : null}
          {stageId ? (
            <ExpeditionView
              stage={stageById(stageId) ?? STAGE_FILE.stages[0]}
              file={STAGE_FILE}
              roster={roster}
              internal={internal}
              onApply={applySettlement}
              onClose={() => {
                setStageId(null)
                notify("出征結束 回城")
              }}
              onLog={setLog}
            />
          ) : null}
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
                  notify(`酒館招募失敗：${result.reason ?? "unknown"}`)
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
                notify("酒館 新武將入麾下")
              }}
              onEquip={(itemId) => {
                if (!activeGeneral) return
                const result = equipItem(roster, activeGeneral.id, itemId, GENERAL_CONFIG)
                if (result.ok) {
                  setRoster(result.state)
                  saveRoster(result.state)
                  notify("裝備已換")
                }
              }}
              onSlot={(index, id, unit, count) => {
                const result = setFormation(roster, GENERAL_CONFIG, index, id, unit, count)
                if (!result.ok) {
                  notify(`編隊不成立：${result.reason ?? "unknown"}`)
                  return
                }
                setRoster(result.state)
                saveRoster(result.state)
                notify("校場編隊已更新")
              }}
            />
          ) : null}
          {recruitUnit !== null ? (
            <RecruitPanel
              roster={roster}
              internal={internal}
              notice={recruitNotice}
              onRecruit={(unit, amount) => {
                const result = recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, unit, amount)
                if (!result.ok) {
                  const ironNote = result.cost?.iron ? `／生鐵 ${result.cost.iron}` : ""
                  setRecruitNotice(`徵兵失敗：${result.reason === "no-resource" ? "資源不足" : result.reason === "pop-cap" ? "人口上限" : "未知兵種"}（需刀幣 ${result.cost?.coin ?? 0}／糧 ${result.cost?.food ?? 0}／人口 ${result.cost?.pop ?? 0}${ironNote}）`)
                  notify("徵兵失敗：資源或人口不足")
                  return
                }
                applySettlement({ roster: result.roster, internal: result.internal })
                sfxHorn()
                markSaved()
                setRecruitNotice(`已徵 ${result.added} 兵，扣刀幣 ${result.cost?.coin}／糧 ${result.cost?.food}／人口 ${result.cost?.pop}`)
                notify(`徵兵 ${unit} +${result.added ?? 0}`)
              }}
              onClose={() => setRecruitUnit(null)}
            />
          ) : null}
          {upgradeBuilding ? (
            <UpgradeDialog building={upgradeBuilding} internal={internal} scale={scale} onConfirm={confirmUpgrade} onClose={() => setUpgradeKind(null)} />
          ) : null}
          {saveOpen ? (
            <SavePanel
              internal={internal}
              roster={roster}
              scale={scale}
              onLoad={(payload) => {
                setInternal(payload.internal)
                setRoster(payload.roster)
                save(payload.internal)
                saveRoster(payload.roster)
                markSaved()
                notify("存檔已載入")
              }}
              onReset={() => {
                const fresh = createState(INTERNAL_CONFIG)
                const newRoster = createRoster(GENERAL_CONFIG)
                setInternal(fresh)
                setRoster(newRoster)
                save(fresh)
                saveRoster(newRoster)
                markSaved()
                notify("已重開新局")
              }}
              onClose={() => setSaveOpen(false)}
            />
          ) : null}
          {offline ? (
            <div
              data-ui-id="offline_report"
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                transform: "translate(-50%, -50%)",
                width: Math.round(420 * scale),
                background: STYLE.panel,
                boxShadow: `inset 0 0 0 2px ${STYLE.gold}, inset 0 0 0 4px ${STYLE.border}`,
                fontFamily: STYLE.fontTitle,
                color: STYLE.text,
                padding: Math.round(14 * scale),
                zIndex: 12,
              }}
            >
              <p style={{ margin: 0, color: STYLE.gold, fontSize: Math.round(15 * scale) }}>
                離線收益：{Math.floor(offline.seconds / 3600)} 時 {Math.floor((offline.seconds % 3600) / 60)} 分
              </p>
              <div style={{ margin: `${Math.round(8 * scale)}px 0`, display: "grid", gap: 4 }}>
                {(offline.rows.length ? offline.rows : [{ key: "none", label: "倉庫已滿，無新增", gain: 0 }]).map((row) => (
                  <div key={row.key} style={{ display: "flex", justifyContent: "space-between", fontSize: Math.round(13 * scale) }}>
                    <span>{row.label}</span>
                    <span style={{ color: STYLE.complete }}>{row.gain > 0 ? `+${row.gain}` : "—"}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOffline(null)}
                style={{
                  width: "100%",
                  background: STYLE.gold,
                  color: STYLE.border,
                  border: 0,
                  fontFamily: STYLE.fontTitle,
                  fontSize: Math.round(13 * scale),
                  padding: `${Math.round(8 * scale)}px 0`,
                  cursor: "pointer",
                }}
              >
                收下
              </button>
            </div>
          ) : null}
          {toast ? (
            <div
              data-ui-id="toast"
              style={{
                position: "absolute",
                left: "50%",
                top: Math.round(18 * scale),
                transform: "translate(-50%, 0)",
                background: STYLE.border,
                color: STYLE.gold,
                boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                padding: `${Math.round(6 * scale)}px ${Math.round(14 * scale)}px`,
                fontFamily: STYLE.fontTitle,
                fontSize: Math.round(13 * scale),
                zIndex: 12,
                whiteSpace: "nowrap",
              }}
            >
              {toast.text}
            </div>
          ) : null}
        </div>
      <div style={{ position: "absolute", left: leftW, bottom: 0, width: mapW, height: barH }}>
        <BottomBar
          scale={scale}
          chatTab={chatTab}
          messages={chats[chatTab]}
          draft={drafts[chatTab]}
          queueSlots={queueView}
          onChatTab={(id) => {
            setChatTab(id as ChatId)
            notify(`聊天${MOCK_CHAT_TABS.find((item) => item.id === id)?.label ?? ""}`)
          }}
          onDraft={(value) => setDrafts((current) => ({ ...current, [chatTab]: value }))}
          onSend={sendChat}
          onAction={(message) => {
            if (message === "MOCK_建築") {
              openUpgrade("house")
              return
            }
            if (message.startsWith("MOCK_加刀幣")) {
              const index = TAX_ORDER.indexOf(internal.tax)
              const next = TAX_ORDER[(index + 1) % TAX_ORDER.length]
              setInternal((current) => setTax(current, next))
              notify(`稅率切至 ${INTERNAL_CONFIG.tax.rates.find((item) => item.id === next)?.label ?? next}`)
              return
            }
            if (message === "MOCK_技能" || message === "MOCK_裝備") {
              setPanel(true)
              notify(`武將面板 ${message.replace("MOCK_", "")}`)
              return
            }
            if (message === "MOCK_競技") {
              window.location.assign("/battle")
              return
            }
            notify(message)
          }}
        />
      </div>
      {debug ? (
        <div style={{ position: "fixed", left: 8, top: 8, display: "flex", gap: 6, zIndex: 20, fontFamily: STYLE.fontTitle, fontSize: 12 }}>
          <button type="button" onClick={() => setSkin((current) => (current === "v3" ? "box" : "v3"))} style={chromeButton(false)}>
            {skin === "v3" ? "切灰盒" : "切 v3"}
          </button>
          <span style={{ color: STYLE.textMuted, background: STYLE.border, padding: "8px 10px" }}>
            {Math.round(vw)}×{Math.round(vh)} · scale {scale.toFixed(2)}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function chromeButton(active: boolean) {
  return {
    background: active ? STYLE.gold : STYLE.panel,
    color: active ? STYLE.border : STYLE.text,
    border: `1px solid ${STYLE.gold}`,
    fontFamily: STYLE.fontValue,
    fontSize: 13,
    lineHeight: 1,
    padding: "8px 12px",
    cursor: "pointer",
  }
}

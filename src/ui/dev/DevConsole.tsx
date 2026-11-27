import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { STAGE_FILE } from "../../demo/stages.ts"
import {
  INTERNAL_CONFIG,
} from "../../internal/config.ts"
import type { ResourceKey } from "../../internal/types.ts"
import {
  IRON_PER_100,
  RESOURCE_KEYS,
  TROOP_IDS,
  balanceOverrideJson,
  cityBridge,
  consoleRequested,
  hotkeyAction,
  listRecruitJobs,
  overrideDiff,
  readCityRev,
  readOverrides,
  resetOverrides,
  subscribeCity,
  subscribeOverrides,
  updateOverrides,
  type TroopId,
} from "../../dev/devOverrides.ts"
import { STYLE } from "../city/tokens.ts"
import { DevBadFilePanel, DevBoard3DPanel, DevSandboxPanel, DevSimPanel } from "./DevLab.tsx"

const LIVE: readonly { key: ResourceKey; label: string }[] = [
  { key: "coin", label: "刀幣" },
  { key: "food", label: "糧食" },
  { key: "wood", label: "木材" },
  { key: "iron", label: "生鐵" },
  { key: "pop", label: "人口" },
]

const TROOP_LABEL: Record<TroopId, string> = {
  blade: "刀兵",
  halberd: "戟兵",
  bow: "弓兵",
  shield: "盾兵",
  cavalry: "騎兵",
  scholar: "學者",
  beast: "神獸",
}

const START_LABEL: Record<ResourceKey, string> = {
  pop: "人口",
  jade: "玉石",
  coin: "刀幣",
  food: "糧食",
  wood: "木材",
  iron: "生鐵",
  stone: "石頭",
}

/** 預設不進 DOM。?dev=1、Ctrl+Shift+D、反引號才掛上。 */
export function DevConsoleGate() {
  const [open, setOpen] = useState(() => {
    try {
      return consoleRequested(window.location.search)
    } catch {
      return false
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const tag = target instanceof HTMLElement ? target.tagName : ""
      if (hotkeyAction({ ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, key: event.key, code: event.code, targetTag: tag }) !== "toggle") {
        return
      }
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  if (!open) return null
  return <DevConsole onClose={() => setOpen(false)} />
}

function DevConsole({ onClose }: { onClose: () => void }) {
  const bag = useSyncExternalStore(subscribeOverrides, readOverrides, readOverrides)
  const cityRev = useSyncExternalStore(subscribeCity, readCityRev, readCityRev)
  const [tab, setTab] = useState<"city" | "balance" | "sandbox" | "board3d" | "sim" | "badfile">(() => {
    try {
      const want = new URLSearchParams(window.location.search).get("v2tab")
      if (want === "sandbox" || want === "board3d" || want === "sim" || want === "badfile") return want
      return "city"
    } catch {
      return "city"
    }
  })
  const [collapsed, setCollapsed] = useState(false)
  const [note, setNote] = useState("")
  const [fallback, setFallback] = useState("")
  const bridge = cityBridge()
  void cityRev

  async function copyDiff() {
    const text = JSON.stringify(overrideDiff(), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setFallback("")
      setNote(text === "{}" ? "沒有差異" : "已複製差異")
    } catch {
      setFallback(text)
      setNote("無法寫入剪貼簿，請選取下方文字")
    }
  }

  function downloadBalance() {
    const text = balanceOverrideJson()
    const blob = new Blob([text], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "balance-override.json"
    link.click()
    URL.revokeObjectURL(url)
    setNote("已下載 balance-override.json")
  }

  if (collapsed) {
    return (
      <button
        type="button"
        data-ui-id="dev_console_tab"
        onClick={() => setCollapsed(false)}
        style={{
          position: "fixed",
          right: 0,
          top: "40%",
          zIndex: 80,
          writingMode: "vertical-rl",
          background: STYLE.border,
          color: STYLE.gold,
          border: `1px solid ${STYLE.gold}`,
          padding: "12px 6px",
          cursor: "pointer",
          fontFamily: STYLE.fontTitle,
          fontSize: 13,
        }}
      >
        開發控制台
      </button>
    )
  }

  const timescale = bag?.timescale ?? 1
  const drillExp = bag?.drillExp ?? 12
  const winMult = bag?.winExpMultiplier ?? 1
  const weight = bag?.troopDamageWeight ?? 0
  const morale = bag?.moraleThreshold ?? 0.5
  const ironOn = bag?.iron?.on ?? false
  const ironRatio = bag?.iron?.ratio ?? 1
  const jobs = listRecruitJobs()
  const slots = bridge ? bridge.slots().filter((slot) => slot.kind) : []

  return (
    <aside
      data-ui-id="dev_console"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: tab === "sandbox" ? 460 : 380,
        zIndex: 80,
        overflowY: "auto",
        background: STYLE.panel,
        color: STYLE.text,
        borderLeft: `2px solid ${STYLE.gold}`,
        boxSizing: "border-box",
        fontFamily: STYLE.fontValue,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          background: STYLE.border,
          padding: "10px 12px",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          zIndex: 1,
        }}
      >
        <strong style={{ color: STYLE.gold, fontFamily: STYLE.fontTitle, fontSize: 14, marginRight: "auto" }}>
          開發控制台 · V1＋V2A
        </strong>
        <button type="button" style={chip(true)} onClick={() => { resetOverrides(); setNote("係數已恢復預設") }}>
          恢復預設
        </button>
        <button type="button" style={chip(false)} onClick={() => void copyDiff()}>
          複製差異
        </button>
        <button type="button" style={chip(false)} onClick={() => setCollapsed(true)}>
          收合
        </button>
        <button type="button" style={chip(false)} onClick={onClose}>
          關閉
        </button>
        <span style={{ flexBasis: "100%", color: STYLE.textMuted }}>?dev=1 · Ctrl+Shift+D · `　{note}</span>
        {fallback ? (
          <textarea readOnly value={fallback} style={{ flexBasis: "100%", minHeight: 72, background: STYLE.panelRaise, color: STYLE.text }} />
        ) : null}
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px 0" }}>
        <button type="button" style={chip(tab === "city")} onClick={() => setTab("city")}>
          內政與時間
        </button>
        <button type="button" style={chip(tab === "balance")} onClick={() => setTab("balance")}>
          數值平衡係數
        </button>
        <button type="button" style={chip(tab === "sandbox")} onClick={() => setTab("sandbox")}>
          戰棋沙盒
        </button>
        <button type="button" style={chip(tab === "board3d")} onClick={() => setTab("board3d")}>
          2.5D
        </button>
        <button type="button" style={chip(tab === "sim")} onClick={() => setTab("sim")}>
          AI 壓測
        </button>
        <button type="button" style={chip(tab === "badfile")} onClick={() => setTab("badfile")}>
          壞檔
        </button>
      </div>

      {tab === "sandbox" ? (
        <div style={{ padding: 12 }}>
          <DevSandboxPanel initialStage={(() => {
            try {
              return new URLSearchParams(window.location.search).get("sbx") ?? undefined
            } catch {
              return undefined
            }
          })()} />
        </div>
      ) : null}
      {tab === "board3d" ? (
        <div style={{ padding: 12 }}>
          <DevBoard3DPanel />
        </div>
      ) : null}
      {tab === "sim" ? (
        <div style={{ padding: 12 }}>
          <DevSimPanel />
        </div>
      ) : null}
      {tab === "badfile" ? (
        <div style={{ padding: 12 }}>
          <DevBadFilePanel />
        </div>
      ) : null}

      {tab === "city" ? (
        <div style={{ padding: 12 }}>
          {!bridge ? <p style={{ color: STYLE.cinnabar }}>主城未開啟。資源、隊列與離線要在主城頁操作；係數仍可在另一頁改。</p> : null}
          {LIVE.map((row) => {
            const value = bridge ? Math.floor(bridge.resources()[row.key]) : 0
            return (
              <div key={row.key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ width: 36 }}>{row.label}</span>
                <span style={{ width: 88, color: STYLE.gold }}>{bridge ? value : "—"}</span>
                <button type="button" style={chip(false)} disabled={!bridge} onClick={() => bridge?.addResource(row.key, 10000)}>
                  +10000
                </button>
                <button type="button" style={chip(false)} disabled={!bridge} onClick={() => bridge?.setResource(row.key, 0)}>
                  清空
                </button>
                <LiveSet disabled={!bridge} onCommit={(next) => bridge?.setResource(row.key, next)} />
              </div>
            )
          })}

          <Row label="時間倍率" dirty={bag?.timescale !== undefined}>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={timescale}
              onChange={(event) => updateOverrides({ timescale: Number(event.target.value) })}
              style={{ width: "100%" }}
            />
            <span>{timescale}×</span>
            <span style={{ display: "flex", gap: 4 }}>
              {[1, 10, 60, 100].map((value) => (
                <button key={value} type="button" style={chip(timescale === value)} onClick={() => updateOverrides({ timescale: value })}>
                  {value}×
                </button>
              ))}
            </span>
          </Row>

          <p style={{ margin: "8px 0 4px", color: STYLE.textMuted }}>
            建造隊列 {slots.length}　徵兵隊列 {jobs.length}
            {jobs.length === 0 ? "（現行徵兵即時入帳）" : ""}
          </p>
          {slots.map((slot) => (
            <p key={slot.id} style={{ margin: 0 }}>
              {slot.label}　{slot.status === "building" ? "建造中" : slot.status}　剩 {Math.ceil(slot.remaining)} 秒
            </p>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button type="button" style={chip(true)} disabled={!bridge} onClick={() => bridge?.finishBuild()}>
              完成建造隊列
            </button>
            <button type="button" style={chip(true)} disabled={!bridge} onClick={() => bridge?.finishRecruit()}>
              完成徵兵隊列
            </button>
          </div>

          <p style={{ margin: "12px 0 4px", color: STYLE.textMuted }}>模擬離線（直接結算產出，不受 120 秒門檻限制）</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={chip(false)} disabled={!bridge} onClick={() => bridge?.simulateOffline(10 * 60)}>
              +10 分
            </button>
            <button type="button" style={chip(false)} disabled={!bridge} onClick={() => bridge?.simulateOffline(2 * 3600)}>
              +2 小時
            </button>
            <button type="button" style={chip(false)} disabled={!bridge} onClick={() => bridge?.simulateOffline(12 * 3600)}>
              +12 小時
            </button>
          </div>
        </div>
      ) : tab === "balance" ? (
        <div style={{ padding: 12 }}>
          <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>六項係數。改起始資源後要按「開新局」才寫進存檔。</p>
          {RESOURCE_KEYS.map((key) => {
            const value = bag?.start?.[key] ?? INTERNAL_CONFIG.start[key]
            const dirty = bag?.start?.[key] !== undefined
            return (
              <Row key={key} label={`起始${START_LABEL[key]}`} dirty={dirty}>
                <input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(event) => updateOverrides({ start: { [key]: Number(event.target.value) } })}
                  style={fieldStyle(dirty)}
                />
              </Row>
            )
          })}
          <button type="button" style={chip(true)} disabled={!bridge} onClick={() => bridge?.newGame()}>
            以此開新局
          </button>

          <Row label="生鐵消耗" dirty={bag?.iron !== undefined}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={ironOn}
                onChange={(event) => updateOverrides({ iron: { on: event.target.checked, ratio: ironRatio } })}
              />
              <span>{ironOn ? "開啟" : "關閉"}</span>
            </label>
            <span>比例 {ironRatio}</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={ironRatio}
              onChange={(event) => updateOverrides({ iron: { on: ironOn, ratio: Number(event.target.value) } })}
              style={{ width: "100%" }}
            />
            <span>
              每 100 騎 {Math.round(IRON_PER_100.cavalry * ironRatio)}　每 100 盾 {Math.round(IRON_PER_100.shield * ironRatio)}
              {ironOn ? "" : "（未開啟，實扣 0）"}
            </span>
          </Row>

          <p style={{ margin: "8px 0 4px", color: STYLE.gold }}>七兵種費用倍率（刀幣與糧食，人口仍為 1）</p>
          {TROOP_IDS.map((id) => {
            const value = bag?.unitCost?.[id] ?? 1
            const dirty = bag?.unitCost?.[id] !== undefined
            return (
              <Row key={id} label={TROOP_LABEL[id]} dirty={dirty}>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={value}
                  onChange={(event) => updateOverrides({ unitCost: { [id]: Number(event.target.value) } })}
                  style={fieldStyle(dirty)}
                />
              </Row>
            )
          })}

          <Row label="校場經驗（每 60 秒）" dirty={bag?.drillExp !== undefined}>
            <input
              type="number"
              min={0}
              step={0.1}
              value={drillExp}
              onChange={(event) => updateOverrides({ drillExp: Number(event.target.value) })}
              style={fieldStyle(bag?.drillExp !== undefined)}
            />
            <button type="button" style={chip(false)} onClick={() => updateOverrides({ drillExp: 12 / 60 })}>
              對齊規格（每小時 12）
            </button>
          </Row>

          <Row label="勝場經驗倍率" dirty={bag?.winExpMultiplier !== undefined}>
            <input
              type="number"
              min={0}
              step={0.1}
              value={winMult}
              onChange={(event) => updateOverrides({ winExpMultiplier: Number(event.target.value) })}
              style={fieldStyle(bag?.winExpMultiplier !== undefined)}
            />
            <span>
              有效 winExpPerEnemy {trimNumber(STAGE_FILE.settle.winExpPerEnemy * winMult)}（基礎 {STAGE_FILE.settle.winExpPerEnemy}）
            </span>
            <button
              type="button"
              style={chip(false)}
              onClick={() => updateOverrides({ winExpMultiplier: 4 / STAGE_FILE.settle.winExpPerEnemy })}
            >
              建議係數 4
            </button>
          </Row>

          <Row label="棋盤人數傷害權重" dirty={bag?.troopDamageWeight !== undefined}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weight}
              onChange={(event) => updateOverrides({ troopDamageWeight: Number(event.target.value) })}
              style={{ width: "100%" }}
            />
            <span>{trimNumber(weight)}　0 不乘人數，1 為傷害 ×攻擊方人數。下一手攻擊生效。</span>
          </Row>

          <Row label="士氣懲罰門檻（≤50%）" dirty={bag?.moraleThreshold !== undefined}>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={morale}
              onChange={(event) => updateOverrides({ moraleThreshold: Number(event.target.value) })}
              style={{ width: "100%" }}
            />
            <span>
              {Math.round(morale * 100)}%　存活比例低於此值才降為 0.9。50% 等於棋盤現況；調低則較晚懲罰。回合 5 以內仍不懲罰。
            </span>
          </Row>

          <button type="button" style={{ ...chip(true), marginTop: 8 }} onClick={downloadBalance}>
            匯出 balance-override.json
          </button>
        </div>
      ) : null}
    </aside>
  )
}

function LiveSet({ disabled, onCommit }: { disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState("")
  return (
    <form
      style={{ display: "flex", gap: 4 }}
      onSubmit={(event) => {
        event.preventDefault()
        const next = Number(draft)
        if (!Number.isFinite(next)) return
        onCommit(next)
        setDraft("")
      }}
    >
      <input
        aria-label="設定為"
        inputMode="numeric"
        placeholder="設定"
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        style={{ width: 64, background: STYLE.panelRaise, color: STYLE.text, border: `1px solid ${STYLE.queued}` }}
      />
      <button type="submit" style={{ background: STYLE.panelRaise, color: STYLE.text, border: `1px solid ${STYLE.gold}`, cursor: "pointer" }} disabled={disabled}>
        設定
      </button>
    </form>
  )
}

function Row({ label, dirty, children }: { label: string; dirty?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: "block",
        margin: "8px 0",
        padding: "4px 6px",
        background: dirty ? STYLE.panelRaise : "transparent",
        boxShadow: dirty ? `inset 3px 0 0 ${STYLE.complete}` : "none",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", color: dirty ? STYLE.complete : STYLE.textMuted }}>
        <span>{label}</span>
        {dirty ? <span>已改</span> : null}
      </span>
      {children}
    </div>
  )
}

function chip(active: boolean) {
  return {
    background: active ? STYLE.gold : STYLE.panelRaise,
    color: active ? STYLE.border : STYLE.text,
    border: `1px solid ${STYLE.gold}`,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer" as const,
  }
}

function fieldStyle(dirty: boolean) {
  return {
    width: "100%",
    boxSizing: "border-box" as const,
    background: STYLE.panel,
    color: dirty ? STYLE.complete : STYLE.text,
    border: `1px solid ${dirty ? STYLE.complete : STYLE.queued}`,
  }
}

function trimNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

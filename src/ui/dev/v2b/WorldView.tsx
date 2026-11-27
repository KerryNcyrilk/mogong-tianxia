import { useState, useSyncExternalStore } from "react"
import {
  phase3Copper,
  phase3EquipAffixes,
  phase3TechLevel,
  readOverrides,
  subscribeOverrides,
  updatePhase3,
} from "../../../dev/devOverrides.ts"
import { pushDevEvent } from "../../../dev/v2b/eventRing.ts"
import {
  MARKER_KINDS,
  WORLD_COLS,
  WORLD_ROWS,
  marchTo,
  readWorld,
  setCoords,
  setFog,
  setInstantMarch,
  spawnMarker,
  subscribeWorld,
  type MarkerKind,
} from "../../../dev/v2b/worldBoard.ts"
import { STYLE } from "../../city/tokens.ts"
import { chip, fieldStyle } from "./chrome.tsx"

const KIND_LABEL: Record<MarkerKind, string> = {
  monster: "野怪",
  resource: "資源",
  stage: "關卡點",
}

const KIND_COLOR: Record<MarkerKind, string> = {
  monster: STYLE.cinnabar,
  resource: STYLE.building,
  stage: STYLE.gold,
}

function parseCell(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null
  return Number(text)
}

export function WorldView() {
  const world = useSyncExternalStore(subscribeWorld, readWorld, readWorld)
  useSyncExternalStore(subscribeOverrides, readOverrides, readOverrides)
  const [kind, setKind] = useState<MarkerKind>("monster")
  const [xText, setXText] = useState("0")
  const [yText, setYText] = useState("0")
  const [markerId, setMarkerId] = useState("")
  const [note, setNote] = useState("")
  const [tech, setTech] = useState(() => {
    const value = phase3TechLevel()
    return readOverrides()?.phase3?.techLevel === undefined ? "" : String(value)
  })
  const [copper, setCopper] = useState(() => {
    const value = phase3Copper()
    return value === null ? "" : String(value)
  })
  const [affix, setAffix] = useState(() => phase3EquipAffixes().join(","))

  const selected = world.markers.find((item) => item.id === markerId) ?? null
  const cells = []
  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const marker = world.markers.find((item) => item.x === x && item.y === y) ?? null
      const hidden = world.fog && !marker
      cells.push(
        <button
          key={`${x},${y}`}
          type="button"
          aria-label={`${x},${y}`}
          onClick={() => {
            setXText(String(x))
            setYText(String(y))
            if (marker) setMarkerId(marker.id)
          }}
          style={{
            width: 8,
            height: 8,
            padding: 0,
            border: 0,
            background: hidden ? STYLE.border : marker ? KIND_COLOR[marker.kind] : STYLE.panelRaise,
            boxShadow: world.coords && selected && selected.x === x && selected.y === y ? `inset 0 0 0 1px ${STYLE.text}` : "none",
          }}
        />,
      )
    }
  }

  function spawn() {
    const x = parseCell(xText)
    const y = parseCell(yText)
    if (x === null || y === null) {
      setNote("座標要是整數")
      return
    }
    const result = spawnMarker(kind, x, y)
    if (!result.ok) {
      setNote(result.reason === "occupied" ? "此格已有標記" : result.reason === "range" ? "超出 0–39" : "種類不對")
      return
    }
    setMarkerId(result.marker.id)
    setNote(`已刷 ${KIND_LABEL[result.marker.kind]}　${result.marker.x},${result.marker.y}`)
    pushDevEvent("world.spawn", { kind: result.marker.kind, x: result.marker.x, y: result.marker.y })
  }

  function march() {
    const x = parseCell(xText)
    const y = parseCell(yText)
    const id = selected?.id
    if (!id) {
      setNote("先選一個標記")
      return
    }
    if (x === null || y === null) {
      setNote("座標要是整數")
      return
    }
    const result = marchTo(id, x, y)
    if (!result.ok) {
      setNote(result.reason === "occupied" ? "目標格已有標記" : result.reason === "range" ? "超出 0–39" : "找不到標記")
      return
    }
    setNote(result.arrived ? "已瞬達（0 秒）" : "未開瞬達，標記仍在原格。官方行軍計時未實作。")
    pushDevEvent("world.march", { markerId: id, x, y, arrived: result.arrived, seconds: result.seconds })
  }

  function writePhase3() {
    const techValue = tech.trim() === "" ? null : Number(tech)
    const copperValue = copper.trim() === "" ? null : Number(copper)
    if ((techValue !== null && !Number.isFinite(techValue)) || (copperValue !== null && !Number.isFinite(copperValue))) {
      setNote("科技等級與銅要是數字，或留空以清除")
      return
    }
    const equipAffixes = affix.trim() === "" ? null : affix.split(",").map((item) => item.trim()).filter((item) => item.length > 0)
    updatePhase3({ techLevel: techValue, copper: copperValue, equipAffixes })
    pushDevEvent("phase3.write", {
      tech: techValue,
      copper: copperValue,
      affixes: equipAffixes ? equipAffixes.length : 0,
    })
    setNote("已寫入覆寫。官方玩法尚未讀取。")
  }

  return (
    <div data-ui-id="dev_v2b_world">
      <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>
        {WORLD_COLS}×{WORLD_ROWS} 開發棋盤。不改關卡檔，不套用草案座標或守軍。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <button type="button" style={chip(world.fog)} onClick={() => setFog(!world.fog)}>
          戰爭迷霧
        </button>
        <button type="button" style={chip(world.coords)} onClick={() => setCoords(!world.coords)}>
          座標
        </button>
        <button type="button" style={chip(world.instantMarch)} onClick={() => setInstantMarch(!world.instantMarch)}>
          行軍 0 秒瞬達
        </button>
      </div>
      <p style={{ margin: "0 0 4px", color: world.coords ? STYLE.gold : STYLE.textMuted }}>
        {world.coords ? `座標開　選中 ${selected ? `${selected.x},${selected.y}` : "無"}` : "座標關"}
      </p>
      <div
        data-ui-id="dev_v2b_grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${WORLD_COLS}, 8px)`,
          gap: 1,
          width: WORLD_COLS * 8 + (WORLD_COLS - 1),
          background: STYLE.queued,
          border: `1px solid ${STYLE.gold}`,
        }}
      >
        {cells}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
        <select value={kind} onChange={(event) => setKind(event.target.value as MarkerKind)} style={{ ...fieldStyle(), width: "auto" }}>
          {MARKER_KINDS.map((item) => (
            <option key={item} value={item}>
              {KIND_LABEL[item]}
            </option>
          ))}
        </select>
        <input aria-label="x" value={xText} onChange={(event) => setXText(event.target.value)} style={fieldStyle()} />
        <input aria-label="y" value={yText} onChange={(event) => setYText(event.target.value)} style={fieldStyle()} />
        <button type="button" style={chip(true)} onClick={spawn}>
          刷出
        </button>
        <button type="button" style={chip(false)} onClick={march}>
          行軍
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        {world.markers.length === 0 ? <p style={{ margin: 0, color: STYLE.textMuted }}>還沒有標記。</p> : null}
        {world.markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            style={{ ...chip(marker.id === markerId), margin: "0 6px 6px 0" }}
            onClick={() => {
              setMarkerId(marker.id)
              setXText(String(marker.x))
              setYText(String(marker.y))
            }}
          >
            {KIND_LABEL[marker.kind]} {marker.x},{marker.y}
          </button>
        ))}
      </div>
      {world.march ? (
        <p style={{ margin: "4px 0", color: STYLE.textMuted }}>
          最近行軍 {world.march.fromX},{world.march.fromY} → {world.march.toX},{world.march.toY}
          {world.march.arrived ? "　已到達" : "　未出發"}
        </p>
      ) : null}
      <p style={{ margin: "4px 0", color: STYLE.gold }}>{note}</p>
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${STYLE.queued}` }}>
        <p style={{ margin: "0 0 6px", color: STYLE.gold }}>Phase 3 預留</p>
        <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>只進覆寫袋。官方內政、左欄與戰鬥都未讀。銅不是資源鍵。</p>
        <label style={{ display: "block", marginBottom: 6 }}>
          科技等級
          <input aria-label="科技等級" value={tech} onChange={(event) => setTech(event.target.value)} style={{ ...fieldStyle(), width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          銅
          <input aria-label="銅" value={copper} onChange={(event) => setCopper(event.target.value)} style={{ ...fieldStyle(), width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          裝備詞條（逗號分隔，只存字串）
          <input aria-label="裝備詞條" value={affix} onChange={(event) => setAffix(event.target.value)} style={{ ...fieldStyle(), width: "100%", marginTop: 4 }} />
        </label>
        <button type="button" style={chip(true)} onClick={writePhase3}>
          寫入覆寫
        </button>
        <button
          type="button"
          style={{ ...chip(false), marginLeft: 6 }}
          onClick={() => {
            setTech("")
            setCopper("")
            setAffix("")
            updatePhase3({ techLevel: null, copper: null, equipAffixes: null })
            pushDevEvent("phase3.clear", null)
            setNote("已清除 Phase 3 覆寫")
          }}
        >
          清除
        </button>
      </div>
    </div>
  )
}

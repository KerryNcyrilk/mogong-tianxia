import { useState } from "react"
import { createPortal } from "react-dom"
import { cityBridge } from "../../../dev/devOverrides.ts"
import { pushDevEvent } from "../../../dev/v2b/eventRing.ts"
import { frameById, FRAME_PRESETS, type FramePreset } from "../../../dev/v2b/frames.ts"
import { OFFLINE_PRESETS, SFX_TRACKS, TOAST_PRESETS, type SfxId } from "../../../dev/v2b/qaCatalog.ts"
import { heardGain, muted, setMuted, setSfxVolume, sfxBell, sfxClash, sfxClick, sfxDrum, sfxHorn, sfxVolume } from "../../city/sfx.ts"
import { STYLE } from "../../city/tokens.ts"
import { chip } from "./chrome.tsx"

const PLAY: Record<SfxId, () => void> = {
  click: sfxClick,
  bell: sfxBell,
  horn: sfxHorn,
  clash: sfxClash,
  drum: sfxDrum,
}

export function QaView() {
  const [volume, setVolume] = useState(() => sfxVolume())
  const [isMuted, setIsMuted] = useState(() => muted())
  const [frameId, setFrameId] = useState<FramePreset["id"] | null>(null)
  const [note, setNote] = useState("")
  const frame = frameId ? frameById(frameId) : null

  function play(id: SfxId) {
    PLAY[id]()
    pushDevEvent("qa.sfx", { id, muted: muted(), volume: sfxVolume(), heard: heardGain(1) > 0 })
    setNote(muted() ? "靜音中，這聲不會出" : `已試播 ${SFX_TRACKS.find((item) => item.id === id)?.label ?? id}`)
  }

  return (
    <div data-ui-id="dev_v2b_qa">
      <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>五聲沿用主城合成音。靜音仍全關；音量只在未靜音時乘上增益。</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SFX_TRACKS.map((track) => (
          <button key={track.id} type="button" style={chip(false)} onClick={() => play(track.id)}>
            {track.label}
          </button>
        ))}
      </div>
      <label style={{ display: "block", marginTop: 8 }}>
        音量 {Math.round(volume * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(event) => {
            const next = Number(event.target.value) / 100
            setSfxVolume(next)
            setVolume(sfxVolume())
            pushDevEvent("qa.volume", { volume: sfxVolume() })
          }}
          style={{ width: "100%" }}
        />
      </label>
      <button
        type="button"
        style={chip(isMuted)}
        onClick={() => {
          const next = !muted()
          setMuted(next)
          setIsMuted(muted())
          pushDevEvent("qa.mute", { muted: next })
        }}
      >
        {isMuted ? "取消靜音" : "靜音"}
      </button>
      <p style={{ margin: "12px 0 4px", color: STYLE.gold }}>Toast</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TOAST_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            style={chip(false)}
            onClick={() => {
              const bridge = cityBridge()
              if (!bridge) {
                setNote("主城未開啟")
                return
              }
              bridge.notify(item.text)
              pushDevEvent("qa.toast", { id: item.id })
              setNote(`已送出：${item.text}`)
            }}
          >
            {item.text}
          </button>
        ))}
      </div>
      <p style={{ margin: "12px 0 4px", color: STYLE.gold }}>升級禁用彈窗</p>
      <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>走現有升級窗。人口滿不是官方升級費用，預覽只強制那句禁用文案，不寫存檔。</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" style={chip(false)} onClick={() => openPreview("resource", setNote)}>
          資源不足
        </button>
        <button type="button" style={chip(false)} onClick={() => openPreview("pop", setNote)}>
          人口已滿
        </button>
        <button type="button" style={chip(false)} onClick={() => openPreview("queue", setNote)}>
          隊列已滿
        </button>
      </div>
      <p style={{ margin: "12px 0 4px", color: STYLE.gold }}>離線彈窗</p>
      <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>沿用內政的模擬離線，會結算進當前存檔。1 分不受 120 秒門檻限制。</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {OFFLINE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            style={chip(false)}
            onClick={() => {
              const bridge = cityBridge()
              if (!bridge) {
                setNote("主城未開啟")
                return
              }
              bridge.simulateOffline(item.seconds)
              pushDevEvent("qa.offline", { id: item.id, seconds: item.seconds })
              setNote(`離線 ${item.label}`)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p style={{ margin: "12px 0 4px", color: STYLE.gold }}>安全框</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FRAME_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            style={chip(frameId === item.id)}
            onClick={() => {
              const next = frameId === item.id ? null : item.id
              setFrameId(next)
              pushDevEvent("qa.frame", { id: next })
            }}
          >
            {item.w}×{item.h}
          </button>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", color: STYLE.gold }}>{note}</p>
      {frame ? <SafeFrame frame={frame} /> : null}
    </div>
  )
}

function openPreview(mode: "resource" | "pop" | "queue", setNote: (text: string) => void) {
  const bridge = cityBridge()
  if (!bridge) {
    setNote("主城未開啟")
    return
  }
  bridge.previewUpgrade(mode)
  pushDevEvent("qa.upgrade", { mode })
  setNote(mode === "resource" ? "資源不足" : mode === "pop" ? "人口已滿" : "隊列已滿")
}

function SafeFrame({ frame }: { frame: FramePreset }) {
  return createPortal(
    <div
      data-ui-id="dev_v2b_frame"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: frame.w,
        height: frame.h,
        pointerEvents: "none",
        zIndex: 70,
        boxShadow: `inset 0 0 0 2px ${STYLE.cinnabar}`,
      }}
    >
      {frame.safe ? (
        <div
          style={{
            position: "absolute",
            left: frame.safe.x,
            top: frame.safe.y,
            width: frame.safe.w,
            height: frame.safe.h,
            boxShadow: `inset 0 0 0 2px ${STYLE.gold}`,
          }}
        />
      ) : null}
      <span style={{ position: "absolute", left: 8, top: 8, color: STYLE.gold, background: STYLE.border, fontSize: 12, padding: "2px 6px" }}>
        {frame.w}×{frame.h}
        {frame.safe ? "　內框為安全區" : "　無官方安全區"}
      </span>
    </div>,
    document.body,
  )
}

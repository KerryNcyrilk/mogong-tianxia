import { useState } from "react"
import { STYLE } from "./tokens.ts"
import type { InternalState } from "../../internal/types.ts"
import type { RosterState } from "../../general/types.ts"
import { exportSave, importSave } from "./persist.ts"

/** 存檔管理：匯出 Base64／匯入校驗／一鍵重開（二次確認）。 */
export function SavePanel({
  internal,
  roster,
  scale,
  onLoad,
  onReset,
  onClose,
}: {
  internal: InternalState
  roster: RosterState
  scale: number
  onLoad: (payload: { internal: InternalState; roster: RosterState }) => void
  onReset: () => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const [message, setMessage] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)
  const fontSize = Math.round(12 * scale)

  return (
    <section
      data-ui-id="save_panel"
      style={{
        position: "absolute",
        left: Math.round(16 * scale),
        top: Math.round(16 * scale),
        width: Math.round(460 * scale),
        background: STYLE.panel,
        color: STYLE.text,
        boxShadow: `inset 0 0 0 2px ${STYLE.gold}, inset 0 0 0 4px ${STYLE.border}`,
        fontFamily: STYLE.fontTitle,
        padding: Math.round(12 * scale),
        boxSizing: "border-box",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: STYLE.gold, fontSize: Math.round(15 * scale) }}>存檔管理</span>
        <button type="button" onClick={onClose} style={button(scale, false)}>
          關閉
        </button>
      </div>
      <p style={{ margin: `${Math.round(6 * scale)}px 0`, fontSize, color: STYLE.textMuted, lineHeight: 1.6 }}>
        匯出後把整段字串保存；匯入會校驗 schema 與欄位，唔會覆蓋紅線資料。
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => {
            const code = exportSave(internal, roster)
            setText(code)
            setMessage(`已匯出 ${code.length} 字元；請自行另存。`)
          }}
          style={button(scale, true)}
        >
          匯出存檔
        </button>
        <button
          type="button"
          onClick={() => {
            const result = importSave(text)
            if (!result) {
              setMessage("匯入失敗：字串無效或版本不符。")
              return
            }
            onLoad(result)
            setMessage("已載入存檔。")
          }}
          style={button(scale, false)}
        >
          匯入存檔
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true)
              setMessage("再撳一次確認重開，進度會清空。")
              return
            }
            setConfirmReset(false)
            onReset()
            setMessage("已重開新局。")
          }}
          style={button(scale, false)}
        >
          {confirmReset ? "確認重開？" : "一鍵重開"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        placeholder="存檔字串（Base64）"
        style={{
          width: "100%",
          height: Math.round(110 * scale),
          marginTop: Math.round(8 * scale),
          background: STYLE.border,
          color: STYLE.text,
          border: 0,
          boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
          fontFamily: STYLE.fontValue,
          fontSize,
          padding: 8,
          boxSizing: "border-box",
          resize: "none",
        }}
      />
      <p style={{ margin: `${Math.round(6 * scale)}px 0 0`, fontSize, color: message ? STYLE.complete : STYLE.textMuted }}>{message || "離線收益與存檔時間戳共用 lastAt。"}</p>
    </section>
  )
}

function button(scale: number, primary: boolean) {
  return {
    background: primary ? STYLE.gold : STYLE.panelRaise,
    color: primary ? STYLE.border : STYLE.text,
    border: 0,
    boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
    fontFamily: STYLE.fontTitle,
    fontSize: Math.round(12 * scale),
    padding: `${Math.round(6 * scale)}px ${Math.round(10 * scale)}px`,
    cursor: "pointer" as const,
  }
}

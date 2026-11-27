import type { FormEvent } from "react"
import { sysLog } from "@syslog"
import { place, textFace } from "./box.ts"
import { MOCK_ACTIONS, MOCK_CHAT_TABS, formatHMS, queueTitle, type MockQueueSlot } from "./mock.ts"
import { FaceButton } from "./parts.tsx"
import { STYLE, UI_1280, controlNode, uiNode, type UiNode } from "./tokens.ts"

function node(id: string): UiNode {
  return uiNode(UI_1280, id)
}

function barColor(slot: MockQueueSlot): string {
  if (slot.status === "building" && slot.seconds === 0) return STYLE.complete
  if (slot.status === "building") return STYLE.building
  return STYLE.queued
}

/**
 * 底欄：左起聊天（固定 391）、功能格（彈性填滿剩餘寬）、建造隊列（固定 158）。
 * 內部幾何沿用 tokens 的 1280 座標，整塊以 scale 等比縮放，所以拉闊視窗時唔會有黑邊。
 */
export function BottomBar({
  scale,
  chatTab,
  messages,
  draft,
  queueSlots,
  onChatTab,
  onDraft,
  onSend,
  onAction,
}: {
  scale: number
  chatTab: string
  messages: readonly string[]
  draft: string
  queueSlots: readonly MockQueueSlot[]
  onChatTab: (id: string) => void
  onDraft: (value: string) => void
  onSend: () => void
  onAction: (message: string) => void
}) {
  const chat = node("area_chat")
  const field = node("chat_field")
  const input = node("chat_input")
  const activeLabel = MOCK_CHAT_TABS.find((tab) => tab.id === chatTab)?.label ?? ""

  function submit(event: FormEvent) {
    event.preventDefault()
    onSend()
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: STYLE.panel, boxShadow: `inset 0 1px 0 ${STYLE.gold}` }}>
      <div style={{ width: 391 * scale, height: "100%", position: "relative", overflow: "hidden", boxShadow: `inset -1px 0 0 ${STYLE.border}` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 391, height: 70, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {MOCK_CHAT_TABS.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              data-ui-id={tab.id}
              onClick={() => onChatTab(tab.id)}
              style={{
                position: "absolute",
                left: 4 + index * 76,
                top: 2,
                width: 74,
                height: 24,
                background: chatTab === tab.id ? STYLE.gold : STYLE.panelRaise,
                color: chatTab === tab.id ? STYLE.border : STYLE.text,
                border: 0,
                boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                fontFamily: STYLE.fontTitle,
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
          <form onSubmit={submit} style={{ ...place(input, chat), margin: 0 }}>
            <input
              aria-label={`${activeLabel}輸入`}
              value={draft}
              placeholder={messages[messages.length - 1] ?? ""}
              onChange={(event) => onDraft(event.target.value)}
              style={{
                ...place(field, input),
                ...textFace(field, "title"),
                background: STYLE.panel,
                border: 0,
                outline: "none",
                padding: "0 8px",
              }}
            />
            <FaceButton origin={input} face={node("chat_send")} hit={controlNode(UI_1280, "chat_send")} onClick={onSend}>
              發送
            </FaceButton>
          </form>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gridTemplateRows: "1fr 1fr",
          gap: 2,
          padding: 2,
          boxSizing: "border-box",
          background: STYLE.panel,
        }}
      >
        {MOCK_ACTIONS.map((action) => {
          const shop = action.id === "action_shop"
          return (
            <button
              key={action.id}
              type="button"
              data-ui-id={action.id}
              onClick={() => {
                if (__SYSLOG__) sysLog.info("ui", "button.click", { control: action.id })
                onAction(`MOCK_${action.label}`)
              }}
              style={{
                minWidth: 0,
                background: shop ? STYLE.cinnabar : STYLE.panelRaise,
                color: STYLE.text,
                border: 0,
                boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                fontFamily: STYLE.fontTitle,
                fontSize: Math.round(12 * Math.max(0.85, Math.min(scale, 1.35))),
                cursor: "pointer",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {action.label}
            </button>
          )
        })}
      </div>
      <div style={{ width: 158 * scale, height: "100%", position: "relative", overflow: "hidden", boxShadow: `inset 1px 0 0 ${STYLE.border}` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 158, height: 70, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {queueSlots.slice(0, 3).map((slot, index) => (
            <div
              key={slot.id}
              data-ui-id={slot.id}
              data-queue-status={slot.seconds === 0 && slot.status === "building" ? "complete" : slot.status}
              style={{ position: "absolute", left: 0, top: index * 23 + 1, width: 158, height: 22 }}
            >
              {index > 0 ? <div style={{ position: "absolute", left: 0, top: -1, width: 158, height: 1, background: STYLE.border }} /> : null}
              <div style={{ position: "absolute", left: 0, top: 0, width: 4, height: 22, background: barColor(slot) }} />
              <p
                style={{
                  position: "absolute",
                  left: 6,
                  top: 1,
                  width: 146,
                  height: 10,
                  ...textFace({ fontSize: 10 } as UiNode, "title"),
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {queueTitle(slot)}
              </p>
              <p
                style={{
                  position: "absolute",
                  left: 6,
                  top: 11,
                  width: 146,
                  height: 11,
                  ...textFace({ fontSize: 11 } as UiNode, "value"),
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {slot.status === "queued" ? "待建" : formatHMS(slot.seconds)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import type { FormEvent } from "react"
import { place, textFace } from "./box.ts"
import { MOCK_ACTIONS, MOCK_CHAT_TABS, MOCK_QUEUE, formatHMS, queueTitle, type MockQueueSlot } from "./mock.ts"
import { FaceButton, Panel } from "./parts.tsx"
import { STYLE, controlNode, uiNode, type UiProfile } from "./tokens.ts"

function remainSeconds(slot: MockQueueSlot, elapsed: number): number {
  if (slot.status !== "building") return slot.seconds
  return Math.max(0, slot.seconds - elapsed)
}

function barColor(slot: MockQueueSlot, remain: number): string {
  if (slot.status === "building" && remain === 0) return STYLE.complete
  if (slot.status === "building") return STYLE.building
  return STYLE.queued
}

export function BottomBar({
  profile,
  chatTab,
  messages,
  draft,
  elapsed,
  onChatTab,
  onDraft,
  onSend,
  onAction,
}: {
  profile: UiProfile
  chatTab: string
  messages: readonly string[]
  draft: string
  elapsed: number
  onChatTab: (id: string) => void
  onDraft: (value: string) => void
  onSend: () => void
  onAction: (message: string) => void
}) {
  const chat = uiNode(profile, "area_chat")
  const actions = uiNode(profile, "area_actions")
  const queue = uiNode(profile, "area_queue")
  const field = uiNode(profile, "chat_field")
  const activeLabel = MOCK_CHAT_TABS.find((tab) => tab.id === chatTab)?.label ?? ""

  function submit(event: FormEvent) {
    event.preventDefault()
    onSend()
  }

  return (
    <>
      <Panel node={chat} profile={profile}>
        {MOCK_CHAT_TABS.map((tab) => (
          <FaceButton
            key={tab.id}
            origin={chat}
            face={uiNode(profile, tab.id)}
            hit={controlNode(profile, tab.id)}
            background={chatTab === tab.id ? STYLE.gold : STYLE.panelRaise}
            color={chatTab === tab.id ? STYLE.border : STYLE.text}
            onClick={() => onChatTab(tab.id)}
          >
            {tab.label}
          </FaceButton>
        ))}
        <form onSubmit={submit} style={{ ...place(uiNode(profile, "chat_input"), chat), margin: 0 }}>
          <input
            aria-label={`${activeLabel}輸入`}
            value={draft}
            placeholder={messages[messages.length - 1] ?? ""}
            onChange={(event) => onDraft(event.target.value)}
            style={{
              ...place(field, uiNode(profile, "chat_input")),
              ...textFace(field, "title"),
              background: STYLE.panel,
              border: 0,
              outline: "none",
              padding: "0 8px",
            }}
          />
          <FaceButton
            origin={uiNode(profile, "chat_input")}
            face={uiNode(profile, "chat_send")}
            hit={controlNode(profile, "chat_send")}
            onClick={onSend}
          >
            發送
          </FaceButton>
        </form>
      </Panel>
      <Panel node={actions} profile={profile}>
        {MOCK_ACTIONS.map((action) => {
          const frozen = action.id === "action_arena"
          const shop = action.id === "action_shop"
          return (
            <FaceButton
              key={action.id}
              origin={actions}
              face={uiNode(profile, action.id)}
              disabled={frozen}
              stacked={frozen}
              background={shop ? STYLE.cinnabar : STYLE.panelRaise}
              title={frozen ? "競技 戰鬥系統待 B6" : action.label}
              onClick={() => onAction(`MOCK_${action.label}`)}
            >
              {frozen ? (
                <>
                  <span>競技</span>
                  <span>戰鬥系統待 B6</span>
                </>
              ) : (
                action.label
              )}
            </FaceButton>
          )
        })}
      </Panel>
      <Panel node={queue} profile={profile}>
        {MOCK_QUEUE.map((slot, index) => {
          const row = uiNode(profile, slot.id)
          const bar = uiNode(profile, `${slot.id}_bar`)
          const name = uiNode(profile, `${slot.id}_name`)
          const time = uiNode(profile, `${slot.id}_time`)
          const remain = remainSeconds(slot, elapsed)
          return (
            <div key={slot.id} data-ui-id={slot.id} data-queue-status={remain === 0 && slot.status === "building" ? "complete" : slot.status}>
              {index > 0 ? (
                <div
                  style={{
                    ...place(uiNode(profile, `queue_sep_${index - 1}`), queue),
                    background: STYLE.border,
                  }}
                />
              ) : null}
              <div style={place(row, queue)}>
                <div style={{ ...place(bar, row), background: barColor(slot, remain), zIndex: 7 }} />
                <p style={{ ...place(name, row), ...textFace(name, "title"), display: "flex", alignItems: "center" }}>{queueTitle(slot)}</p>
                <p
                  style={{
                    ...place(time, row),
                    ...textFace(time, "value"),
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {formatHMS(remain)}
                </p>
              </div>
            </div>
          )
        })}
      </Panel>
    </>
  )
}

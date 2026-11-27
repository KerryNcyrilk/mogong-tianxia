import { STYLE } from "./tokens.ts"
import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { canPay, duration } from "../../internal/engine.ts"
import type { BuildingDef, InternalState, ResourceKey } from "../../internal/types.ts"

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":")
}

const LABEL: Record<ResourceKey, string> = {
  pop: "人口",
  jade: "玉石",
  coin: "刀幣",
  food: "糧食",
  wood: "木材",
  iron: "生鐵",
  stone: "石頭",
}

/** 建築詳情／升級確認：先睇現級→下級、所需資源、耗時；按 B5 曲線校驗，不足即禁用。 */
export function UpgradeDialog({
  building,
  internal,
  scale,
  onConfirm,
  onClose,
  forceReason = null,
}: {
  building: BuildingDef
  internal: InternalState
  scale: number
  onConfirm: () => void
  onClose: () => void
  /** 開發預覽用。官方呼叫不傳，仍走資源／隊列判斷。人口滿不是官方升級曲線。 */
  forceReason?: string | null
}) {
  const level = internal.levels[building.kind] ?? 1
  const next = level + 1
  const seconds = duration(building, next)
  const cost = building.cost as Partial<Record<ResourceKey, number>>
  const affordable = canPay(internal, cost)
  const building2 = internal.slots.some((slot) => slot.kind === building.kind && slot.status !== "queued")
  const queueFull = !internal.slots.some((slot) => slot.kind === "" || slot.status === "queued")
  const computed = building2 ? "同一建築已在施工" : queueFull ? "營造隊列已滿" : affordable ? "" : "資源不足"
  const reason = forceReason ? forceReason : computed

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backdropFilter: "brightness(0.62)",
        display: "grid",
        placeItems: "center",
        zIndex: 9,
      }}
    >
      <section
        data-ui-id="upgrade_dialog"
        style={{
          width: Math.round(420 * scale),
          background: STYLE.panel,
          color: STYLE.text,
          boxShadow: `inset 0 0 0 2px ${STYLE.gold}, inset 0 0 0 4px ${STYLE.border}`,
          fontFamily: STYLE.fontTitle,
          padding: Math.round(14 * scale),
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h3 style={{ margin: 0, color: STYLE.gold, fontSize: Math.round(18 * scale) }}>{building.label}</h3>
          <span style={{ fontFamily: STYLE.fontValue, fontSize: Math.round(12 * scale), color: STYLE.textMuted }}>
            Lv.{level} → Lv.{next}　工期 {fmt(seconds)}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: "auto", background: STYLE.panelRaise, color: STYLE.text, border: 0, boxShadow: `inset 0 0 0 1px ${STYLE.gold}`, padding: "4px 10px", cursor: "pointer", fontSize: Math.round(12 * scale) }}
          >
            關閉
          </button>
        </div>
        <div style={{ marginTop: Math.round(10 * scale), borderTop: `1px solid ${STYLE.border}` }}>
          {Object.entries(cost).map(([key, amount]) => {
            const have = Math.floor(internal.resources[key as ResourceKey] ?? 0)
            const need = amount ?? 0
            const short = have < need
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: `${Math.round(6 * scale)}px 0`,
                  borderBottom: `1px solid ${STYLE.border}`,
                  fontFamily: STYLE.fontValue,
                  fontSize: Math.round(13 * scale),
                }}
              >
                <span>{LABEL[key as ResourceKey]}</span>
                <span style={{ color: short ? STYLE.cinnabar : STYLE.text }}>
                  需 {need.toLocaleString()}　庫 {have.toLocaleString()}
                  {short ? "　不足" : ""}
                </span>
              </div>
            )
          })}
        </div>
        <p style={{ margin: `${Math.round(10 * scale)}px 0 0`, fontSize: Math.round(12 * scale), color: reason ? STYLE.cinnabar : STYLE.textMuted }}>
          {reason || "確認後即時扣資源並入營造隊列；完成後自動升級。"}
        </p>
        <button
          type="button"
          data-ui-id="upgrade_confirm"
          disabled={Boolean(reason)}
          onClick={reason ? undefined : onConfirm}
          style={{
            width: "100%",
            marginTop: Math.round(10 * scale),
            minHeight: Math.round(34 * scale),
            background: reason ? STYLE.queued : STYLE.gold,
            color: reason ? STYLE.textMuted : STYLE.border,
            border: 0,
            boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
            fontFamily: STYLE.fontTitle,
            fontSize: Math.round(14 * scale),
            cursor: reason ? "not-allowed" : "pointer",
          }}
        >
          {reason ? reason : `確認升級（扣 ${Object.values(cost).reduce((sum, value) => sum + (value ?? 0), 0)}）`}
        </button>
        <p style={{ margin: `${Math.round(8 * scale)}px 0 0`, fontSize: Math.round(11 * scale), color: STYLE.textMuted }}>
          資源曲線：{INTERNAL_CONFIG.buildings.length} 類建築共用 B5 曲線；每次升級 +15% 工期。
        </p>
      </section>
    </div>
  )
}

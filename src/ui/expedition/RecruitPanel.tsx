import { STYLE } from "../city/tokens.ts"
import { GENERAL_CONFIG } from "../../general/config.ts"
import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { RECRUIT_BATCH, RECRUIT_COST, troopCapOf } from "../../demo/recruit.ts"
import { overridesIdle, priceRecruit } from "../../dev/devOverrides.ts"
import type { RosterState } from "../../general/types.ts"
import type { InternalState } from "../../internal/types.ts"

/** B7 §2.1 徵兵：每 100 兵扣刀幣 300／糧 120／人口 1，受人口上限與兵種上限約束。 */
export function RecruitPanel({
  roster,
  internal,
  notice,
  onRecruit,
  onClose,
}: {
  roster: RosterState
  internal: InternalState
  notice: string
  onRecruit: (unit: string, amount: number) => void
  onClose: () => void
}) {
  return (
    <div
      data-ui-id="recruit_panel"
      style={{
        position: "absolute",
        left: 12,
        top: 12,
        width: 520,
        maxHeight: "calc(100% - 24px)",
        overflow: "auto",
        background: STYLE.panel,
        boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${STYLE.gold}`,
        color: STYLE.text,
        fontFamily: STYLE.fontTitle,
        fontSize: 12,
        padding: 12,
        boxSizing: "border-box",
        zIndex: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: STYLE.gold, fontSize: 14 }}>點兵場 ｜ 徵兵</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            minWidth: 64,
            minHeight: 32,
            background: STYLE.panelRaise,
            color: STYLE.text,
            border: 0,
            boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
            fontFamily: STYLE.fontValue,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          收兵
        </button>
      </div>
      <p style={{ margin: "6px 0 10px", color: STYLE.textMuted, lineHeight: 1.6 }}>
        每 {RECRUIT_BATCH} 兵＝刀幣 {RECRUIT_COST.coin}、糧 {RECRUIT_COST.food}、人口 {RECRUIT_COST.pop}；兵種上限＝人口上限×4。存糧{" "}
        {Math.floor(internal.resources.food)}　刀幣 {Math.floor(internal.resources.coin)}　人口 {Math.floor(internal.resources.pop)}
      </p>
      {GENERAL_CONFIG.troops.map((troupe) => {
        const current = Math.floor(roster.troops[troupe.id] ?? 0)
        const cap = troopCapOf(INTERNAL_CONFIG)
        const quote = overridesIdle() ? null : priceRecruit(troupe.id, 1)
        const priced = quote !== null && (quote.coin !== RECRUIT_COST.coin || quote.food !== RECRUIT_COST.food || quote.iron > 0)
        return (
          <div
            key={troupe.id}
            data-troop-id={troupe.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 36,
              borderBottom: `1px solid ${STYLE.border}`,
            }}
          >
            <span style={{ width: 48 }}>{troupe.name}</span>
            <span style={{ width: 110, fontFamily: STYLE.fontValue }}>
              {current}／{Number.isFinite(cap) ? cap : "∞"}
            </span>
            <span style={{ color: STYLE.textMuted }}>最多 {RECRUIT_BATCH * 5}</span>
            {priced && quote ? (
              <span style={{ color: STYLE.complete }}>
                本批 刀幣 {quote.coin} 糧 {quote.food}
                {quote.iron > 0 ? ` 鐵 ${quote.iron}` : ""}
              </span>
            ) : null}
            {[RECRUIT_BATCH, RECRUIT_BATCH * 5].map((amount) => (
              <button
                key={amount}
                type="button"
                data-recruit={`${troupe.id}:${amount}`}
                onClick={() => onRecruit(troupe.id, amount)}
                style={{
                  minWidth: 44,
                  minHeight: 32,
                  background: STYLE.panelRaise,
                  color: STYLE.text,
                  border: 0,
                  boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                  fontFamily: STYLE.fontValue,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                +{amount}
              </button>
            ))}
          </div>
        )
      })}
      <p style={{ margin: "8px 0 0", color: notice ? STYLE.cinnabar : STYLE.textMuted }}>{notice || "選兵種加兵；兵力即時寫回左欄七行。"}</p>
    </div>
  )
}

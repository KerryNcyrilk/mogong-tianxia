import { STYLE } from "../city/tokens.ts"
import type { Stage, StageFile } from "../../demo/types.ts"

/** B7 §2.2 出城：40×40 大地圖上的關卡點。點一關即帶校場陣容進 B2 12×8 棋盤。 */
export function StageMap({
  file,
  formation,
  ready,
  onPick,
  onClose,
}: {
  file: StageFile
  formation: readonly string[]
  ready: boolean
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      data-ui-id="stage_map"
      style={{
        position: "absolute",
        inset: 0,
        background: STYLE.grass,
        backgroundImage: `linear-gradient(to right, ${STYLE.queued} 1px, transparent 1px), linear-gradient(to bottom, ${STYLE.queued} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        fontFamily: STYLE.fontTitle,
        color: STYLE.text,
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: STYLE.gold, fontSize: 14 }}>大地圖 40×40 ｜ 關卡</span>
        <span style={{ color: STYLE.textMuted, fontSize: 12 }}>校場陣容：{formation.join("／") || "空"}</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            minWidth: 64,
            minHeight: 32,
            background: STYLE.panel,
            color: STYLE.text,
            border: 0,
            boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
            fontFamily: STYLE.fontValue,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          回城
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {file.stages.map((stage) => {
          const total = stage.enemy.reduce((sum, draft) => sum + draft.count, 0)
          const kinds = stage.enemy.map((draft) => `${UNIT_NAME[draft.type]}${draft.count}`).join("　")
          return (
            <button
              key={stage.id}
              type="button"
              data-stage-id={stage.id}
              disabled={!ready}
              onClick={() => onPick(stage.id)}
              title={ready ? `${stage.name}｜敵 ${total}` : "先到校場編隊"}
              style={{
                width: 240,
                minHeight: 160,
                textAlign: "left",
                padding: 12,
                background: STYLE.panel,
                color: STYLE.text,
                border: 0,
                boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${ready ? STYLE.gold : STYLE.queued}`,
                fontFamily: STYLE.fontTitle,
                fontSize: 12,
                lineHeight: 1.6,
                cursor: ready ? "pointer" : "not-allowed",
                boxSizing: "border-box",
              }}
            >
              <span style={{ display: "block", color: STYLE.gold, fontSize: 14 }}>
                Lv.{stage.level}　{stage.name}
              </span>
              <span style={{ display: "block", color: STYLE.textMuted }}>{stage.note}</span>
              <span style={{ display: "block" }}>敵兵 {total}　{kinds}</span>
              <span style={{ display: "block", color: STYLE.complete }}>
                12×8 手動棋盤{ready ? "　點此出征" : "　校場未編隊"}
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ margin: 0, color: STYLE.textMuted, fontSize: 12 }}>
        勝：經驗＝敵兵×0.6、戰利品＝敵兵×2 刀幣；敗：傷兵 40% 回池；撤退保留 70%。
      </p>
    </div>
  )
}

const UNIT_NAME: Record<Stage["enemy"][number]["type"], string> = {
  cavalry: "騎",
  blade: "刀",
  beast: "獸",
  bow: "弓",
  scholar: "學",
  halberd: "戟",
  shield: "盾",
}

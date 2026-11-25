import { useMemo, useState } from "react"
import { STYLE } from "../city/tokens.ts"
import { ExpeditionBoard } from "../BattleView.tsx"
import type { BoardState } from "../../combat/board.ts"
import { GENERAL_CONFIG } from "../../general/config.ts"
import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { troopRows } from "../../general/engine.ts"
import { buildSquads } from "../../demo/squads.ts"
import { settleBattle } from "../../demo/settle.ts"
import type { SettleReport, Stage, StageFile } from "../../demo/types.ts"
import type { RosterState } from "../../general/types.ts"
import type { InternalState } from "../../internal/types.ts"

type Settled = { roster: RosterState; internal: InternalState; report: SettleReport }

/** B7 §2.2–2.5：出征 → 12×8 手動棋盤 → 戰後結算 → 回城。全程不重整頁面。 */
export function ExpeditionView({
  stage,
  file,
  roster,
  internal,
  onApply,
  onClose,
  onLog,
}: {
  stage: Stage
  file: StageFile
  roster: RosterState
  internal: InternalState
  onApply: (result: Settled) => void
  onClose: () => void
  onLog: (message: string) => void
}) {
  // 出征一開始就把陣容與內政快照凍結：戰後回寫會清空校場，
  // 若用即時 props 重算 buildSquads，結算畫面會誤判 empty-formation。
  const [entry] = useState(() => ({ roster, internal }))
  const built = useMemo(() => buildSquads(entry.roster, GENERAL_CONFIG, stage, file), [entry, stage, file])
  const before = useMemo(
    () => ({
      rows: troopRows(entry.roster, GENERAL_CONFIG),
      coin: Math.floor(entry.internal.resources.coin),
      levels: entry.roster.generals.map((item) => ({ id: item.id, name: item.name, level: item.level })),
    }),
    [entry],
  )
  const [settled, setSettled] = useState<Settled | null>(null)

  function finish(board: BoardState) {
    const result = settleBattle({
      board,
      roster: entry.roster,
      internal: entry.internal,
      config: GENERAL_CONFIG,
      internalConfig: INTERNAL_CONFIG,
      stage,
      file,
      deployed: built.deployed,
    })
    setSettled(result)
    onApply(result)
    onLog(`出征 ${stage.name}：${result.report.outcome === "win" ? "大勝" : result.report.outcome === "retreat" ? "撤退" : "敗退"}`)
  }

  return (
    <div
      data-ui-id="expedition_view"
      style={{
        position: "absolute",
        inset: 0,
        background: STYLE.panel,
        color: STYLE.text,
        fontFamily: STYLE.fontTitle,
        zIndex: 8,
        display: "flex",
        flexDirection: "column",
        padding: 12,
        boxSizing: "border-box",
        gap: 8,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: STYLE.gold, fontSize: 14 }}>
          Lv.{stage.level}　{stage.name}　｜　12×8 手動棋盤
        </span>
        <span style={{ color: STYLE.textMuted, fontSize: 12 }}>
          出戰 {built.deployed.map((slot) => `${slot.unit} ${slot.count}`).join("｜") || "無"}　敵兵{" "}
          {stage.enemy.reduce((sum, draft) => sum + draft.count, 0)}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            minWidth: 88,
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
          撤退回城
        </button>
      </div>

      {!built.ok ? (
        <p style={{ color: STYLE.cinnabar }}>
          出征條件不足：{built.reason === "empty-formation" ? "校場三格全空，先編隊。" : built.reason}
        </p>
      ) : settled ? (
        <SettlementPanel before={before} settled={settled} stage={stage} onClose={onClose} />
      ) : (
        <div
          data-ui-id="expedition-board"
          style={{
            background: "#F3EADB",
            padding: 8,
            boxSizing: "border-box",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <ExpeditionBoard squads={built.squads} onFinish={finish} />
        </div>
      )}
    </div>
  )
}

function SettlementPanel({
  before,
  settled,
  stage,
  onClose,
}: {
  before: { rows: { name: string; count: number }[]; coin: number; levels: { id: string; name: string; level: number }[] }
  settled: Settled
  stage: Stage
  onClose: () => void
}) {
  const report = settled.report
  const after = troopRows(settled.roster, GENERAL_CONFIG)
  const title = report.outcome === "win" ? "大勝" : report.outcome === "retreat" ? "撤退" : "敗退"
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ minWidth: 320 }}>
        <p style={{ margin: 0, color: report.outcome === "win" ? STYLE.complete : STYLE.cinnabar, fontSize: 16 }}>
          {stage.name}　{title}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.8 }}>
          殲敵 {report.enemyKilled}／{report.enemyDeployed}　經驗 {report.expPerGeneral}×{report.levels.length}　戰利品{" "}
          {report.lootCoin} 刀幣
          <br />
          回兵 {report.returned}　損失 {report.lost}　民心 {Math.round(report.moraleFrom)} → {report.moraleTo}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12 }}>刀幣：{before.coin} → {Math.floor(settled.internal.resources.coin)}</p>
      </div>
      <div style={{ minWidth: 240 }}>
        <p style={{ margin: 0, color: STYLE.gold, fontSize: 12 }}>武將經驗</p>
        {report.levels.map((entry) => (
          <p key={entry.generalId} style={{ margin: "2px 0 0", fontSize: 12 }}>
            {entry.name}　Lv.{entry.from} → Lv.{entry.to}
          </p>
        ))}
      </div>
      <div style={{ minWidth: 240 }}>
        <p style={{ margin: 0, color: STYLE.gold, fontSize: 12 }}>兵力七行（前 → 後）</p>
        {after.map((row, index) => (
          <p key={row.name} style={{ margin: "2px 0 0", fontSize: 12, fontFamily: STYLE.fontValue }}>
            {row.name}　{before.rows[index]?.count ?? 0} → {row.count}
          </p>
        ))}
      </div>
      <button
        type="button"
        data-ui-id="settle-back"
        onClick={onClose}
        style={{
          minWidth: 96,
          minHeight: 32,
          background: STYLE.gold,
          color: STYLE.border,
          border: 0,
          fontFamily: STYLE.fontValue,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        回城
      </button>
    </div>
  )
}

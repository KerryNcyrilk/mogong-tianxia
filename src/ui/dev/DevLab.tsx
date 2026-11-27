import { useState } from "react"
import {
  B3D_RANGES,
  DEFAULT_BOARD3D,
  clampPreset,
  clearPreset,
  loadPreset,
  presetJson,
  savePreset,
  type Board3DPreset,
} from "../../dev/board3dPreset.ts"
import { reportJson, runSimulation, type SimReport } from "../../dev/simulate.ts"
import { corruptSaves, validateSave } from "../../dev/timeMachine.ts"
import { DevSandbox } from "./DevSandbox.tsx"
import { STYLE } from "../city/tokens.ts"

/**
 * DEV-CONSOLE-V2A 面板：2.5D 預設、AI 壓測、壞檔校驗。
 * 全部掛在 V1 `DevConsole` 統一抽屜內（`?dev=1`／`Ctrl+Shift+D`／反引號），
 * 不再另開 `?dev2a=1` 第二入口。
 */

/** 2.5D Board3D 參數：拖滑桿即寫 preset，`BattleView` 以事件同步。 */
export function DevBoard3DPanel() {
  const [preset, setPreset] = useState<Board3DPreset>(() => loadPreset())

  function update(patch: Partial<Board3DPreset>) {
    const next = clampPreset({ ...preset, ...patch })
    setPreset(next)
    savePreset(next)
  }

  return (
    <div data-ui-id="dev_board3d">
      {(
        [
          ["perspective", "透視距離", B3D_RANGES.perspective],
          ["rotateX", "傾角", B3D_RANGES.rotateX],
          ["scale", "縮放", B3D_RANGES.scale],
          ["lift", "落影", B3D_RANGES.lift],
        ] as const
      ).map(([key, label, [min, max]]) => (
        <label key={key} style={{ display: "block", marginBottom: 8 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{label}</span>
            <span style={{ color: STYLE.gold }}>{preset[key]}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={key === "scale" ? 0.01 : 1}
            value={preset[key]}
            onChange={(event) => update({ [key]: Number(event.target.value) } as Partial<Board3DPreset>)}
            style={{ width: "100%" }}
          />
        </label>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button type="button" onClick={() => { clearPreset(); setPreset(DEFAULT_BOARD3D) }} style={chip(false)}>
          還原預設
        </button>
        <button type="button" onClick={() => download("board3d-preset.json", presetJson(preset))} style={chip(true)}>
          匯出 preset
        </button>
      </div>
      <p style={{ margin: "8px 0 0", color: STYLE.textMuted }}>
        即時套用到所有棋盤；`?b3d=p,r,s,lift` 可帶入極端值出證據。
      </p>
    </div>
  )
}

/** AI 壓測：勝率、平均回合、戰損率、場間標準差；`?sim=N&jitter=x` 自動跑一次。 */
export function DevSimPanel() {
  const [jitter, setJitter] = useState(0.08)
  const [report, setReport] = useState<SimReport | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const count = Number(params.get("sim") ?? 0)
      const level = Number(params.get("jitter") ?? 0.08)
      return count > 0 ? runSimulation(count, { jitter: level }) : null
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)

  return (
    <div data-ui-id="dev_sim">
      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <span>開局擾動（±{Math.round(jitter * 100)}% 攻防）</span>
          <span style={{ color: STYLE.gold }}>{jitter === 0 ? "確定性" : "隨機"}</span>
        </span>
        <input
          type="range"
          min={0}
          max={0.3}
          step={0.01}
          value={jitter}
          onChange={(event) => setJitter(Number(event.target.value))}
          style={{ width: "100%" }}
        />
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        {[3, 10, 30].map((count) => (
          <button
            key={count}
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setReport(runSimulation(count, { jitter }))
              setBusy(false)
            }}
            style={chip(false)}
          >
            {count} 場
          </button>
        ))}
      </div>
      {report ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: 0 }}>
            墨勝 {report.winRate.mo}% · 秦勝 {report.winRate.qin}% · 和 {report.winRate.draw}%
          </p>
          <p style={{ margin: 0 }}>平均回合 {report.avgTurns}</p>
          <p style={{ margin: 0 }}>墨戰損 {report.lossRate.mo}% · 秦戰損 {report.lossRate.qin}%</p>
          <p style={{ margin: 0 }}>
            標準差：回合 ±{report.stdDev.turns} · 墨損 ±{report.stdDev.moLossRate} · 秦損 ±{report.stdDev.qinLossRate}
          </p>
          <p style={{ margin: 0, color: report.deterministic ? STYLE.textMuted : STYLE.gold }}>
            {report.deterministic ? "確定性模式（同配置應完全一致）" : `隨機模式 · seed ${report.config.seed}`}
          </p>
          <button
            type="button"
            onClick={() => download("sim-report.json", reportJson(report))}
            style={{ ...chip(true), marginTop: 6 }}
          >
            匯出 sim-report
          </button>
        </div>
      ) : (
        <p style={{ margin: "8px 0 0", color: STYLE.textMuted }}>未跑；預設沙盒同配置、`jitter` 0.08。</p>
      )}
    </div>
  )
}

/** 壞檔校驗：五例真實存檔變體，逐條顯示拒絕原因。 */
export function DevBadFilePanel() {
  const [index, setIndex] = useState(0)
  const cases = corruptSaves()
  const row = cases[index]
  const result = validateSave(row.text)
  return (
    <div data-ui-id="dev_badfile">
      <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>存檔壞檔測試（真實 base64 存檔格式的變體）</p>
      {cases.map((item, position) => (
        <button
          key={item.label}
          type="button"
          onClick={() => setIndex(position)}
          style={{ ...chip(index === position), display: "block", width: "100%", marginBottom: 4, textAlign: "left" }}
        >
          {item.label}
        </button>
      ))}
      <p style={{ margin: "6px 0 0", color: result.ok ? STYLE.gold : STYLE.cinnabar }}>
        {result.ok ? "通過" : "拒絕"}｜{result.errors.join("；") || "無錯誤"}
      </p>
      <p style={{ margin: "2px 0 0", color: STYLE.textMuted }}>預期：{row.expect}</p>
      <textarea
        readOnly
        value={row.text}
        style={{ width: "100%", minHeight: 64, marginTop: 6, background: STYLE.panelRaise, color: STYLE.text, fontSize: 11 }}
      />
    </div>
  )
}

/** 沙盒分頁：12×8 擺盤＋四作弊＋1×–8×＋傷害環形日誌＋時間機器。 */
export function DevSandboxPanel({ initialStage }: { initialStage?: string }) {
  return <DevSandbox initialStage={initialStage} />
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function chip(primary: boolean) {
  return {
    background: primary ? STYLE.gold : "transparent",
    color: primary ? STYLE.border : STYLE.text,
    border: `1px solid ${STYLE.gold}`,
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer" as const,
  }
}

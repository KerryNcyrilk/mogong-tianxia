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

/** DEV-CONSOLE-V2A 自立外殼：只有 `?dev2a=1` 才掛載，不依賴 V1 抽屜。 */
export function DevLab({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState<Board3DPreset>(() => loadPreset())
  const [jitter, setJitter] = useState(0.08)
  const [report, setReport] = useState<SimReport | null>(() => {
    // 證據／自動化：?sim=10 直接跑一次（唔靠人手點擊）
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

  function update(patch: Partial<Board3DPreset>) {
    const next = clampPreset({ ...preset, ...patch })
    setPreset(next)
    savePreset(next)
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

  return (
    <aside
      data-ui-id="dev_lab"
      style={{
        position: "fixed",
        right: 10,
        top: 10,
        bottom: 10,
        width: 300,
        overflowY: "auto",
        background: "#1A120C",
        color: "#E8DCC0",
        border: "1px solid #C8A96B",
        borderRadius: 6,
        padding: 12,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 1.6,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ color: "#C9A227" }}>DEV LAB · V2A</strong>
        <button type="button" onClick={onClose} style={chip(false)}>
          收起
        </button>
      </div>

      <section style={{ marginTop: 10 }}>
        <p style={{ margin: "0 0 4px", color: "#9C8F78" }}>2.5D Board3D 參數</p>
        {(
          [
            ["perspective", "透視距離", B3D_RANGES.perspective],
            ["rotateX", "傾角", B3D_RANGES.rotateX],
            ["scale", "縮放", B3D_RANGES.scale],
            ["lift", "落影", B3D_RANGES.lift],
          ] as const
        ).map(([key, label, [min, max]]) => (
          <label key={key} style={{ display: "block", marginBottom: 6 }}>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{label}</span>
              <span style={{ color: "#C8A96B" }}>{preset[key]}</span>
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
      </section>

      <section style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 4px", color: "#9C8F78" }}>AI 壓測模擬器</p>
        <label style={{ display: "block", marginBottom: 6 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>開局擾動（±{Math.round(jitter * 100)}% 攻防）</span>
            <span style={{ color: "#C8A96B" }}>{jitter === 0 ? "確定性" : "隨機"}</span>
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
                const result = runSimulation(count, { jitter })
                setReport(result)
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
            <p style={{ margin: 0, color: report.deterministic ? "#9C8F78" : "#6E8B4F" }}>
              {report.deterministic ? "確定性模式（10 場應完全一致）" : `隨機模式 · seed ${report.config.seed}`}
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
          <p style={{ margin: "8px 0 0", color: "#9C8F78" }}>未跑；預設 S1 沙盒同配置。</p>
        )}
      </section>
    </aside>
  )
}

function chip(primary: boolean) {
  return {
    background: primary ? "#C8A96B" : "transparent",
    color: primary ? "#1A120C" : "#E8DCC0",
    border: "1px solid #C8A96B",
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer" as const,
  }
}

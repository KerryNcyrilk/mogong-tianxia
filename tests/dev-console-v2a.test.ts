import { describe, expect, it } from "vitest"
import { B3D_RANGES, DEFAULT_BOARD3D, clampPreset, parsePresetQuery, presetJson, presetToCss } from "../src/dev/board3dPreset.ts"
import { reportJson, runSimulation } from "../src/dev/simulate.ts"

describe("board3d preset（V2A）", () => {
  it("夾限：超界值回落邊界、缺值回預設", () => {
    const clamped = clampPreset({ perspective: 9999, rotateX: -10, scale: 3, lift: 999 })
    expect(clamped.perspective).toBe(B3D_RANGES.perspective[1])
    expect(clamped.rotateX).toBe(B3D_RANGES.rotateX[0])
    expect(clamped.scale).toBe(B3D_RANGES.scale[1])
    expect(clamped.lift).toBe(B3D_RANGES.lift[1])
    expect(clampPreset({})).toEqual(DEFAULT_BOARD3D)
  })

  it("查詢字串解析：合法三值、殘缺即 null", () => {
    expect(parsePresetQuery("1800,40,0.95")).toEqual({ perspective: 1800, rotateX: 40, scale: 0.95, lift: 0 })
    expect(parsePresetQuery("1800")).toBeNull()
    expect(parsePresetQuery(null)).toBeNull()
    expect(parsePresetQuery("abc,20")).toBeNull()
  })

  it("CSS 與 JSON 匯出可讀", () => {
    const css = presetToCss(DEFAULT_BOARD3D)
    expect(css.board.transform).toContain("rotateX(33deg)")
    const json = JSON.parse(presetJson(DEFAULT_BOARD3D)) as { schema: string; preset: { perspective: number } }
    expect(json.schema).toBe("board3d-preset.v1")
    expect(json.preset.perspective).toBe(1500)
  })
})

describe("simulate（V2A）", () => {
  it("同配置 5 場：報告結構完整且可重現", () => {
    const first = runSimulation(5)
    const second = runSimulation(5)
    expect(first.games).toHaveLength(5)
    expect(first.schema).toBe("sim-report.v1")
    const total = first.winRate.mo + first.winRate.qin + first.winRate.draw
    expect(total).toBeGreaterThan(99)
    expect(first.games.map((row) => row.turns)).toEqual(second.games.map((row) => row.turns))
    expect(first.games.every((row) => row.moLossRate >= 0 && row.moLossRate <= 100)).toBe(true)
  })

  it("JSON 匯出含 config 與匯總", () => {
    const report = JSON.parse(reportJson(runSimulation(3))) as { config: { games: number }; avgTurns: number }
    expect(report.config.games).toBe(3)
    expect(report.avgTurns).toBeGreaterThan(0)
  })
})

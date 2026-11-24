import { describe, expect, it } from "vitest"
import screenSource from "../src/ui/city/CityScreen.tsx?raw"
import leftPanelSource from "../src/ui/city/LeftPanel.tsx?raw"
import zonesSource from "../src/ui/city/WorldHotZones.tsx?raw"
import { UI_1280, uiNode } from "../src/ui/city/tokens.ts"
import { MOCK_GENERAL } from "../src/ui/city/mock.ts"

describe("B4 E3 五項存在性（靜態檢查，不啟動 React）", () => {
  it("E3-1 城池名下拉箭頭 12×20 存在，且 log 不再佔用城池名列", () => {
    const arrow = uiNode(UI_1280, "city_name_arrow")
    expect(arrow).toMatchObject({ w: 12, h: 20 })
    const screen = screenSource
    expect(screen).not.toMatch(/city_name[^\n]*\{log\}/)
    expect(leftPanelSource).toMatch(/title|aria-label/)
  })

  it("E3-2 武將卡含 Lv./經驗條/狀態/技能/裝備五個子節點", () => {
    expect(uiNode(UI_1280, "general_card")).toBeTruthy()
    for (const id of ["general_level", "general_exp", "general_status", "general_skill", "general_equip"]) {
      expect(uiNode(UI_1280, id), id).toBeTruthy()
    }
    expect(uiNode(UI_1280, "general_exp")).toMatchObject({ w: 204, h: 8 })
    expect(MOCK_GENERAL).toMatchObject({ level: 12, expPct: 64, status: "待命" })
  })

  it("E3-3 七行兵力各帶 16×16 圖標", () => {
    for (let index = 0; index < 7; index += 1) {
      expect(uiNode(UI_1280, `troop_${index}_icon`)).toMatchObject({ w: 16, h: 16 })
    }
  })

  it("E3-4 出城真的切場景（OutsideScene + 40×40 圖塊佔位）", () => {
    const screen = screenSource
    expect(screen).toMatch(/OutsideScene/)
    expect(screen).toMatch(/40×40/)
    expect(screen).toMatch(/大地圖（佔位）/)
  })

  it("E3-5 熱區由 cityLayout 投影計算，且資訊卡 160×64", () => {
    const zones = zonesSource
    expect(zones).toMatch(/loadCityLayout/)
    expect(zones).toMatch(/zoneToProjectedPolygon/)
    expect(zones).toMatch(/160/)
    expect(zones).toMatch(/64/)
    expect(zones).not.toMatch(/const\s+\w+\s*=\s*\{[^}]*x:\s*\d{3,}/)
  })
})

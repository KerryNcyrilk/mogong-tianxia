# DEV-CONSOLE-V2A（第一階段：兩塊自立模組）

日期：2026-11-27。分支 `cursor/dev-console-v2a`，基於 `main@dd4b95a`。
因 `DEV-CONSOLE-V1` 未併入 `main`（`src/dev/devOverrides.ts` 不存在），本輪只做**不依賴 V1 外殼**的兩塊，並自建最小外殼 `src/ui/dev/DevLab.tsx`（只在 `?dev2a=1` 掛載）。

## 落地
1. **`src/dev/board3dPreset.ts`**：`perspective 600–2500`、`rotateX 0–60°`、`scale 0.7–1.15`、`lift 0–48`；clamp 校驗、`localStorage mg_board3d_preset_v1`、`board3d-preset.json` 匯出；`?b3d=p,r,s,lift` 證據參數。
2. **`src/ui/BattleView.tsx` 的 `Board3D`** 改讀 preset（`mg-board3d-preset` 事件即時同步），實時拖桿即見斜度變化。
3. **`src/dev/simulate.ts`**：同配置 AI vs AI 連跑 N 場（上限 200），輸出勝率／平均回合／雙方戰損率，可匯出 `sim-report.json`。
4. **`src/ui/dev/DevLab.tsx`**：右側抽屜，滑桿＋預設還原＋preset 匯出＋3/10/30 場壓測＋報告匯出；`?sim=10` 可自動跑一次（證據用）。
5. **測試** `tests/dev-console-v2a.test.ts`（5 個新斷言）：夾限、查詢解析、CSS/JSON、模擬可重現、報告結構。

## Gate（全綠）
`vitest 129 passed`／`city-check` 全 PASS／`ui-check 7 項 PASS`／`v3-check 15 區 0 overlap`／`build ✓`／`no-syslog 0 hits`；紅線 `cityLayout.json`／`units.json` 零改。

## 觀察（供 Gemini 判平衡）
`sim-report.json`：10 場全為「秦勝 100%」，墨方戰損 49.5%、秦方 64.5%，平均 15 回合。因自動引擎為確定性，10 場結果完全相同——即現時沙盒配置下墨方必敗；若要看分佈需加隨機種子（列下一階段）。

## 未做（等 V1 或下一階段）
戰棋沙盒（任意跳關／格子放兵）、無敵／一擊必殺／無限行動力開關、1–8× 倍速追看、武將注入與 5 套快照／10 步 Undo、2.5D 單位反向豎立／受擊震動／傷害飄字滑桿。

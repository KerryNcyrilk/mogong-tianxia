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

## 第二階段（本輪新增，回應 VERDICT-V2A-PARTIAL-ACCEPT）
- `simulate.ts` 加 `seed`＋`jitter`（0–0.3 攻防擾動，`mulberry32` 可重現）；報告加 `stdDev`（回合／雙方戰損）與 `deterministic` 旗標；`DevLab` 加擾動滑桿；`?sim=N&jitter=0.15` 證據參數。
- 實測（seed 20261127、jitter 0.15、10 場）：墨勝 50%／秦勝 50%，平均 9 回合；標準差 回合 ±5.21、墨損 ±28.99、秦損 ±29.67 → `sim-report-jitter15.json`、`dev-lab-jitter-seed.png`。
- 測試增至 `vitest 131`（可重現性、確定性 stdDev=0 兩項）。

## 觀察（供 Gemini 判平衡）
`sim-report.json`：10 場全為「秦勝 100%」，墨方戰損 49.5%、秦方 64.5%，平均 15 回合。因自動引擎為確定性，10 場結果完全相同——即現時沙盒配置下墨方必敗；若要看分佈需加隨機種子（列下一階段）。

## 未做（等 V1 或下一階段）
戰棋沙盒（任意跳關／格子放兵）、無敵／一擊必殺／無限行動力開關、1–8× 倍速追看、武將注入與 5 套快照／10 步 Undo、2.5D 單位反向豎立／受擊震動／傷害飄字滑桿。

## 第三階段（2026-11-27 13:3x，回應 `V2A-THREE-ANSWERS`）
總指揮拍板「餘四項唔等 V1，先獨立落地」，本階段只有 `src/dev/**`＋`src/ui/dev/**`，未碰 `devOverrides.ts`／`DevConsole.tsx`。

1. **12×8 沙盒（`src/dev/stageLab.ts`＋`src/ui/dev/DevSandbox.tsx`）**
   - 跳關 S1–S10：S1–S3 讀 `data/stages.json`，S4–S10 用 `spec/CONTENT_EXPANSION_S4_S10.md` §3 草案人數（未寫入 JSON）。
   - 點空格即放兵（墨／秦、七兵種、人數 1–2000）；點自軍選中可刪除／改派；點敵軍即攻擊並記日誌。
   - 四項作弊：無敵、一擊必殺、無限行動力、敵軍凍結（以「指令後處理」實現，不改 `src/combat/**`）。
   - 倍速 `1×/2×/4×/8×`＝600／300／150／75ms（與手動棋盤託管同基準）。
2. **傷害公式透視環形日誌（`src/dev/damageLog.ts`）**
   - 容量 200，滿則覆寫最舊；每筆記 `攻×光環 × 人數 × 克制 × 士氣 − 防×光環`，並標「托底」（`floorMin` 生效）。
   - **重要發現**：手動棋盤（`combat/board.ts`）走 `calcDamage`，**不乘人數、不讀武將光環**；自動引擎（`combat/battle.ts`）才乘。日誌以 `engine: "grid" | "squad"` 標明，兩者數字不可混用。S3 秦營實測 52 筆，盾兵互打恆為 `1`（`raw 1.6` 取整），即 `BALANCE_AUDIT` 講的「0 傷害軟鎖」同源。
3. **武將注入與時間機器（`src/dev/timeMachine.ts`）**
   - 光環 Lv.1–50（猛將原型 18+3(L−1)／10+2(L−1)）；七兵種補隊自動找空格。
   - 5 套快照：開局／30 分鐘／秦營盾／滿級武將／低士氣（第 6 回合、攻方只剩一隊 30% 血）。
   - 10 步 Undo（環形堆疊，超出丟最舊）。
   - 壞檔生成器 5 例（非 base64／JSON 尾部雜字／`schema` 錯／資源負值／合法對照組），`validateSave` 逐層檢查並回報錯誤列表。
4. **`jitter` 默認改 0.08**（`DEFAULT_JITTER`），滑桿維持 0–0.30。以 0.08 重跑 10 場：墨 50%／秦 50%、平均 9.9 回合、標準差 回合 ±4.61、墨損 ±19.66、秦損 ±27.89 → `sim-report-jitter08.json`。

**測試**：`tests/dev-console-v2a-part2.test.ts` 13 個 it（含「拆解值＝`calcDamage` 同值」「環形 205 筆只留 200」「作弊四項」「Undo 11 步只留 10」「壞檔四例全被拒」），全庫 `vitest` 由 131 升至 **144 passed**。

**證據索引**：`dev-lab-sandbox-s3.png`（S3 擺盤）、`dev-lab-sandbox-damage-log.png`（託管 30 步後 22 筆日誌）、`dev-lab-sandbox-cheats.png`（一擊必殺＋無敵，敵剩 4 隊）、`dev-lab-badfile.png`（壞檔面板）、`damage-log-s-qinying.json`（52 筆全量）、`sim-report-jitter08.json`。

**未做（仍待 V1）**：把 `DevLab` 併入 V1 `DevConsole` 統一抽屜（Rowan 講明 V1 入 `main` 後我 rebase 落 `main` 再接 `DevConsole.tsx`）；2.5D 單位反向豎立／受擊震動／傷害飄字滑桿仍列 v2。

## 第四階段：整併入 V1 統一抽屜（2026-11-27 14:0x，回應 `V2A-MERGE-INTO-V1`）
`cursor/dev-console-v2a-part2` 已 rebase 至 `main@6cf705ff`（含 `DEV-CONSOLE-V1`／`PR #19`），`DevLab` 拆成面板後全部掛入 `src/ui/dev/DevConsole.tsx`：

1. **單一入口**：只留 `?dev=1`／`Ctrl+Shift+D`／反引號（`DevConsoleGate` 在 `App` 全域）；刪掉 `?dev2a=1` 第二入口與 `BattleView` 的 `DevLab` 掛載、`besideLab` 右移邏輯。
2. **六個分頁**：內政與時間／數值平衡係數（V1 原有）＋戰棋沙盒／2.5D／AI 壓測／壞檔（V2A）；沙盒分頁闊 460，其餘 380。
3. **`src/ui/dev/DevLab.tsx`** 改為面板模組：`DevBoard3DPanel`（滑桿即寫 preset）、`DevSimPanel`（jitter 滑桿＋3/10/30 場＋報告匯出）、`DevBadFilePanel`（五例校驗）、`DevSandboxPanel`（`DevSandbox` 薄包裝，`?sbx=` 可指定開場關）。
4. **證據用 URL**：`?dev=1&v2tab=sandbox&sbx=s_qinying&auto=22`、`?dev=1&v2tab=sim&sim=10&jitter=0.08`、`?dev=1&v2tab=board3d`、`?dev=1&v2tab=badfile`（`v2tab` 只揀分頁，不另開抽屜）。
5. **Gate**（rebase 後全綠）：`vitest 152 passed`（V1 帶來 8 個新 it）／`city-check` 全 PASS（含 delivery）／`ui-check` 7 項 PASS／`v3-check` 15 區 0 overlap／`build ✓`／`no-syslog` 0 hits。紅線檔（`data/cityLayout.json`、`data/units.json`、`src/combat/**`）零改。

**新增證據**：`dev-console-unified-sandbox.png`、`dev-console-unified-sim.png`、`dev-console-unified-badfile.png`、`dev-console-unified-board3d.png`。

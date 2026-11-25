# B7 規格對照表（spec v0.1 §2.1–2.5／§3 → 實作行號）

分支 `cursor/b7-playable-demo`，base `cursor/b6-general` @`5463652`。
行號為本 commit 實測值；四 gate 實跑輸出見同目錄 `vitest.txt`／`city-check.txt`／`ui-check.txt`／`build.txt`／`check-no-syslog.txt`。

## §2.1 內政 → 徵兵

| 規格要求 | 實作位置 |
| --- | --- |
| 左欄兵力七行「＋」→ 徵兵面板 | `src/ui/city/LeftPanel.tsx:247`（`data-troop-id`）、`:251`（`MOCK_徵兵:<id>`）→ `src/ui/city/CityScreen.tsx:177`（分流）、`:402`（`recruitTroops` 呼叫）|
| 每 100 兵：刀幣 300／糧 120／人口 1 | `src/demo/recruit.ts:11`（`RECRUIT_COST`）、`:20`（`recruitTroops`）|
| 受人口上限與兵種上限約束 | `src/demo/recruit.ts:12`（`TROOP_CAP_PER_POP=4`）、`:14`（`troopCapOf`）|
| 寫入 `RosterState.troops[unit]` 即時反映左欄 | `CityScreen.tsx:402` 回傳 `roster` 寫入 `setRoster` |
| 拒絕理由三值 | `src/demo/recruit.ts:41`（`pop-cap`）等三處回傳；`tests/b7-demo.test.ts` GB7-4 逐值斷言 |

面板 UI：`src/ui/expedition/RecruitPanel.tsx`。

## §2.2 編隊 → 出戰

| 規格要求 | 實作位置 |
| --- | --- |
| 校場三格轉 `Squad[]` | `src/demo/squads.ts:12`（`buildSquads`）|
| 武將經 `battleGeneral()` 轉 `General`（含主動技能）| `src/demo/squads.ts:29` |
| 三格不足禁止出戰（`empty-formation`）| `src/demo/squads.ts:12`（空格回 `empty-formation`）；`ExpeditionView` 據此顯示「出征條件不足」|
| 出城入口 | `src/ui/city/CityScreen.tsx:75`（`stageId`）、`:377`（`setStageId`）；`src/ui/expedition/StageMap.tsx` |

## §2.3 戰棋（沿用 B2＋B6 技能＋新增撤退）

| 規格要求 | 實作位置 |
| --- | --- |
| 沿用 B2 手動棋盤 | `src/ui/BattleView.tsx:328`（`ExpeditionBoard`，內部用 `createBoard(squads)`）|
| 技能走 B6 `skill` 命令 | `BattleView.tsx` `ManualBoard` 技能鈕 → `applyCommand` 的 `skill`（B6 既有，未改）|
| 新增「撤退」，保留 70% 兵力、判負不全滅 | `src/combat/board.ts:303`（`retreat`，設 `retreated:true`、`over` 判對方、log kind `retreat`）；結算端 `src/demo/settle.ts:69`（`keepPct` 取 `retreatKeepPct`）、`:76` 回兵 |

`v4.0` 傷害公式（`calcDamage`）未動一行。

## §2.4 戰後結算

| 規格要求 | 實作位置 |
| --- | --- |
| 勝：經驗＝敵總兵×0.6，均分三格武將 | `src/demo/settle.ts:23`（`settleBattle`）：`expTotal`（`:47`）→ 均分＋尾差歸第一格 |
| 勝：戰利品刀幣＝敵兵×2 | `settle.ts:50`（`lootCoin = enemyDeployed * rules.winCoinPerEnemy`）|
| 敗：經驗＝殲敵×0.4 | `settle.ts:46`（`loseExpPerEnemy`），殲敵按 `round(maxHp/hpPer)` 逐隊反推編制（`:40`–`:45`）|
| 敗：傷兵＝出戰 40% 回池 | `settle.ts:11`（`survivorsOf`）＋ `:69`（`keepPct=woundPctOnLose`），取 `max(存活, floor(出戰×0.4))` |
| 士氣：勝 +5／敗 −8，夾 0–100 | `settle.ts:94`（`moraleTo`，`Math.round` 後夾 0–100）|
| 參數來自 `data/stages.json` | `data/stages.json` 頂層 `settle`（`winExpPerEnemy 0.6`／`winCoinPerEnemy 2`／`loseExpPerEnemy 0.4`／`woundPctOnLose 0.4`／`retreatKeepPct 0.7`／`moraleWin 5`／`moraleLose -8`）；自檢 `src/demo/stages.ts:13`（`assertStageFile`）|

撤退按 §2.4 的敗處理，回兵比例取 `retreatKeepPct=0.7`（`data/stages.json` 參數）。

## §2.5 回城

| 規格要求 | 實作位置 |
| --- | --- |
| 傷兵回池重算七行 | `settle.ts:73`（`troops` 回池）→ `CityScreen.tsx:185`（`applySettlement`）寫 `roster`＋`internal` |
| 武將經驗即時寫檔 | `CityScreen.tsx:185`（`applySettlement` 同時 `saveGeneral`／`saveInternal`）|
| 戰報一條入 `internal.eventLog`（kind `battle`） | `settle.ts:106`（`internal.eventLog` 追加 `id:"battle"`，保留末 50 條）|
| 一鍵回主城 | `src/ui/expedition/ExpeditionView.tsx:48`（`finish`）→ `:148`（勝負標題）→ `:194`（「回城」鈕） |

結算後校場三格清空（避免二次計兵），此為實作口徑。

## §3 驗收

| 驗收項 | 證據 |
| --- | --- |
| ①一條命令主城→戰棋→回城，不重整頁面 | `b7-stages-1280.png` → `b7-battle-1280.png` → `b7-settle-1280.png` → `b7-back-1280.png`（同一 page session 連拍）|
| ②七行兵力／武將等級／刀幣可對帳（初值→戰後→重載一致）| `tests/b7-demo.test.ts` GB7-5（存檔重載一致）；截圖刀幣 245608→245668、兵力 1200→2200 |
| ③行號對照／gate 實跑／1280·1920 截圖／紅線零改 | 本檔／`vitest.txt`等五份／`b7-city-1920.png` 等／`redline.txt` |

## §4 紅線實證

- `data/cityLayout.json`、`data/units.json`：`git diff --stat` 空、blob hash 與 HEAD 相同（`redline.txt`）。
- `src/combat/**` 只加 `retreat()` 與 log kind，`calcDamage`（v4.0 公式）未動。

## 與規格 v0.1 的兩處補充（請 Gemini 於 v0.2 追認）

1. **兵種上限＝人口上限×4**：規格只寫「受兵種上限約束」未給式。起始刀兵 1200，若取 ×2 則一開局即超限、徵兵必敗，故定 ×4（人口 500 → 上限 2000）。
2. **結算後校場三格清空**：規格未寫。不清空會令同一批兵可重複出征、戰利品可重複刷，故結算即清格；武將留在 roster。

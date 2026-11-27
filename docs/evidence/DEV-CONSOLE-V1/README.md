# DEV-CONSOLE-V1（MVP）

日期：2026-11-27。分支 `feat/dev-console-v1`，基於已含 DEV-CONSOLE-V2A 的 `main@9ce3c06`。
本輪只加 V1 外殼與執行期覆寫，不併 DevLab，不改 `?dev2a=1`。

## 怎麼打開

預設不進 DOM。三種方式才掛上右側抽屜：

- 網址 `?dev=1`
- `Ctrl+Shift+D`
- 反引號 `` ` ``（輸入框裡不觸發）

`?dev2a=1` 的 DevLab 仍獨立。兩個都開時，V1 抽屜往左讓出 320px，不蓋住 V2A。

## 落地

1. `src/dev/devOverrides.ts`：覆寫只在記憶體與 `localStorage` 鍵 `mg_dev_overrides_v1`。沒有覆寫時，第一次讀檔之後 getter 只做一次布林判斷，原值原樣返回。不寫 `data/cityLayout.json`、`data/units.json`。
2. `src/ui/dev/DevConsole.tsx`：右側可收合抽屜。頁首可一鍵恢復預設係數、複製 JSON 差異。改過的欄位以金色標成「已改」。
3. 內政與時間：即時改刀幣／糧食／木材／生鐵／人口（+10000、清空、設定）、時間倍率 1×–100×、完成建造隊列、完成徵兵隊列、模擬離線 +10 分／+2 小時／+12 小時。
4. 數值平衡六項（對照 `spec/BALANCE_AUDIT.md` 第 7 節，只覆寫、不改表）：
   - 起始資源，另有「以此開新局」
   - 生鐵消耗開關與比例（每 100 騎 80、每 100 盾 50，再乘比例）
   - 七兵種費用倍率（刀幣與糧食；人口仍為每批 1；不改 `units.json`）
   - 校場每 60 秒經驗（預設 12；可一鍵對齊「每小時 12」）
   - 勝場經驗倍率（乘在 `winExpPerEnemy` 上）
   - 棋盤攻擊方人數傷害權重，以及士氣懲罰門檻（最高 50%）
   - 一鍵下載 `balance-override.json`
5. 測試 `tests/dev-overrides.test.ts`。

掛點在 `src/App.tsx`。棋盤只在 `BattleView` 的出手順多包一層：係數為預設時直接走原來的 `applyCommand`／`autoTurn`。

## 截圖

- `city-default-hidden.png`：沒有 `?dev=1`，抽屜不在畫面上。
- `city-tab.png`：`?dev=1` 的內政頁。
- `city-plus-10000.png`：刀幣 +10000，主城左欄與抽屜同時從 245608 變成 255608。
- `balance-start-coin.png`：起始刀幣改成 12000，該列標成「已改」。

## 未做

- 12×8 沙盒擺兵、傷害環、10 步時光機、把 DevLab 併進這個抽屜、HUD、Iris。
- 現行徵兵是即時的，沒有等待隊列。`pushRecruitJob` 留給之後的沙盒把工作推進去；「完成徵兵隊列」會把那些工作結清。隊列空時按鈕無效果。
- 人數權重與士氣門檻加在棋盤結算結果上，不改 `src/combat`。權重 0、門檻 50% 時與現況相同。門檻不能高於 50%。回合 5 以內仍不懲罰。
- 時間倍率只加快內政 tick（資源、建造，以及倍率大於 1 時的校場經驗／事件節拍）。倍率為 1 時，每 60 個實秒的路徑與原來相同。

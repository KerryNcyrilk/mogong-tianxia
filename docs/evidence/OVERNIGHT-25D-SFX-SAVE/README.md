# PLAYTEST-V3-POLISH ＋ OVERNIGHT-25D-SFX-SAVE 證據

時點：2026-11-27 00:30（HKT），分支 `cursor/playtest-v3-polish`（基於 `main@0f50b4b8`）。

## 一、PLAYTEST-V3-POLISH（Kerry 實機 13 項）

| # | 要求 | 落地 | 證據 |
| --- | --- | --- | --- |
| 1 | 根路由直接入主城 | `src/App.tsx`：只有 `/battle` 入戰鬥，其餘一律 `CityScreen` | `city-1400x900-fill.png`（`/` 即主城） |
| 2 | 滿屏自適應、無黑邊 | `useStage()`＋`scale = clamp(vh/720, 0.72, 1.9)`；左欄 276、底欄 70 按比例；外殼絕對定位 | `city-1400x900-fill.png`（1400×900 無黑邊） |
| 3 | 名牌常駐 | `V3WorldLayer` 移除 hover 條件，每區永遠 `名稱 Lv.X`；城外資源點用 `fixedLevel` | 同上（15 區全見名） |
| 4 | 去方框、hover 改光暈 | SVG polygon `stroke:none fill:none`，hover 用 `clipPath` ＋ `brightness(1.28) drop-shadow(#C8A96B)` | `hover-glow-gov.png`（`?focus=gov`） |
| 5 | dev 工具列隱藏 | 只有 `?debug=1` 或 `Ctrl+Shift+D` 才出現 | 正式截圖無工具列 |
| 6 | 升級確認彈窗（顯示耗費、工期、禁用理由） | 新 `src/ui/city/UpgradeDialog.tsx` | `upgrade-dialog-gov.png`（`?dialog=gov`） |
| 7 | 招兵即時扣費＋失敗顯示所需 | `recruitTroops()` 已即時扣；`RecruitPanel` 失敗顯示 `需刀幣／糧／人口` | 見源碼 `CityScreen.tsx` 徵兵段 |
| 8 | 倒數平滑 | 250ms 心跳＋`deadlines` 漂移校正 | 見源碼 |
| 9 | 城外資源點（森林／礦山） | `data/cityLayoutV3.json` 加 `forest`／`mine`，15 區、0 overlap | `v3-check` PASS |
| 10 | 數值高對比色 | 沿用 `#E8DCC0`（`#F5E6C8` 不在 `ui-check` 十一色白名單，硬寫會 FAIL） | 見 `city-1400x900-fill.png` |
| 11 | 施工進度條 | 名牌下金色進度條 | 見源碼 |
| 12 | 出城／出征入口 | 右上 flex 三粒＋新增「存檔／音效」圓鈕，不再寫死座標 | `save-panel.png` 右上 |
| 13 | Toast | 金框黑底、2.6 秒自動消失 | 見源碼 |

## 二、OVERNIGHT-25D-SFX-SAVE

1. **2.5D 斜角棋盤**：`BattleView` 新增 `Board3D`，`perspective:1500px` ＋ `rotateX(33deg) scale(0.9)`，帶落影，近大遠細 → `battle-25d-oblique.png`。
   - 未做：單位「反向豎立」與受擊震動／飄字（Pixi 內需逐 sprite 反向，本輪未及，列 v2）。
2. **離線收益**：`persist.ts` 以 `lastAt` 時間戳結算，上限 12 小時，受倉庫上限約束（`tick` 內已夾），進城彈窗 → `offline-income-8h.png`（`?offline=480` 為證據旋鈕）。
3. **存檔管理**：匯出 Base64／匯入校驗（schema＋欄位）／一鍵重開（二次確認）→ `save-panel.png`（`?save=1`）。
4. **WebAudio 古風音效**：新增 `src/ui/city/sfx.ts`，純合成零素材：點擊（木魚）、升級完成（鐘）、招兵（號角）、刀劍交擊、戰勝（戰鼓兩擊）；右上「音效／靜音」鈕＋`localStorage` 持久化。

## 三、Gate

`vitest 124 passed`｜`city-check 4/4`｜`ui-check 8/8 PASS`｜`npm run build` ✓｜`check-no-syslog 0 hits`｜`v3-check 15 zones 0 overlap`。

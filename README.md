# 墨攻天下

單人網頁遊戲的第一個切片：十二乘八的戰鬥核心，加上一個可以單步觀看先攻的沙盒。城池、經濟與戰役不在這一次裡。

戰鬥規則以 [docs/combat-spec.v3.1.md](docs/combat-spec.v3.1.md) 為準。技術是 React、PixiJS 與 TypeScript。畫面是水墨紙色上的佔位棋子，不是 Q 版。

## 安裝

```bash
npm install
```

## 啟動

```bash
npm run dev
```

開發伺服器在 [http://127.0.0.1:43123](http://127.0.0.1:43123)。沙盒預先布好墨方與秦方各四支部隊，墨翟的光環掛在刀兵上，不另佔一格。按「單步」或「自動」，部隊依騎、刀、神獸、弓、學者、戟、盾的速度出手。

## 測試

```bash
npm test
```

`tests/anchors.test.ts` 是純函數驗收，不經過畫面。A1–A5 鎖 v3.1 §7.1。E1–E8 鎖 [docs/combat-spec.v3.2.md](docs/combat-spec.v3.2.md) 的統一夾具：兩靶防禦都是測試用 0，比值是最終傷害的浮點除法。E7、E8 若量到 1.3 即失敗。最近一次的原始輸出在 `docs/evidence/npm-test-stdout.txt`。

```bash
npm run build
npm run lint
```

## 美術槽

正式圖還沒到。現在 `public/art/` 裡的檔都標著「佔位」，給行術 · Iris 替換。戰鬥與版面只讀 `src/art/manifest.ts` 的 `key` 和 `src`，換圖時改路徑或覆蓋檔案即可，不用改戰鬥公式或棋盤座標。

| 槽 | key | 目前檔 | 交付尺寸 | 正式格式 |
| --- | --- | --- | --- | --- |
| 騎、刀、戟、弓、盾、學者、神獸 | `unit.*` | `public/art/units/<type>.svg` | 256×256 | 透明 PNG |
| 武將光環 | `marker.general-aura` | `public/art/markers/general-aura.svg` | 256×256 | 透明 PNG |
| 十二乘八地面 | `board.ground` | `public/art/board/ground.svg` | 1536×1024 | PNG 或 WebP |
| 先攻條 | `chrome.initiative` | `public/art/chrome/initiative.svg` | 480×96 | PNG 或 WebP |
| 兵力條 | `chrome.hp` | `public/art/chrome/hp.svg` | 256×32 | 透明 PNG |
| 操作按鈕 | `chrome.buttons` | `public/art/chrome/buttons.svg` | 480×96 | PNG 或 WebP |
| 戰報面板 | `chrome.log` | `public/art/chrome/log.svg` | 640×800 | PNG 或 WebP |

棋盤上的顯示大小仍是一格 64 CSS 像素。佔位圖會被縮放，不是最終立繪。

## 目錄

```
balance.json                 鎖定常數
data/units.json              沙盒兵種底材，不覆蓋驗收夾具
docs/combat-spec.v3.1.md     戰鬥規格
src/art/manifest.ts          美術槽。換圖只改這裡的 src
public/art                   佔位圖，標著「佔位」
src/combat                   傷害、光環、克制、先攻、反擊、格子、回合
src/sandbox                  預設戰場與戰報文字
src/ui                       Pixi 棋盤與操作
tests/anchors.test.ts        A1–A5、E1–E8
```

## 這一次沒做的

沒有城池與經濟，沒有士氣、陣型、地形，沒有暴擊或閃避，也沒有跑一百場的 TTK。

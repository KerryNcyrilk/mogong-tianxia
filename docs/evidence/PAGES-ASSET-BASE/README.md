# GitHub Pages 子路徑底圖 404 修正

日期：2026-11-27。分支 `fix/pages-asset-base`，基於 `main@0b51578d`。

## 問題
Pages 部署用 `npm run build -- --base=/mogong-tianxia/`，但美術資源寫死絕對路徑 `/art/v3/city_full_base_v11_2496x1440.jpg`：
- `https://kerryncyrilk.github.io/art/v3/…` → **404**（網域根冇此檔）
- `https://kerryncyrilk.github.io/mogong-tianxia/art/v3/…` → 200

所以線上主城「底圖沒有了」，本機 dev（base `/`）卻正常。`src/art/manifest.ts` 的單位／地面／UI 貼圖同樣中招。

## 解法
新增 `src/lib/asset.ts`：`asset(path)` 以 `import.meta.env.BASE_URL` 補前綴（外部 URL、`data:`、`blob:` 不動）。接到：
1. `src/ui/city/V3WorldLayer.tsx` 的底圖 `<img src>` 與 hover 光暈 `<image href>`。
2. `src/art/manifest.ts` 的 `slot()`，令全部美術路徑一致。

## 驗證
以 `--base=/mogong-tianxia/` 建置後本機 preview `http://localhost:4179/mogong-tianxia/city`：
- 請求 `…/mogong-tianxia/art/v3/city_full_base_v11_2496x1440.jpg` → 200，`naturalWidth = 2496`，頁面 404 數 = 0。
- 截圖 `city-1024-base-mogong-tianxia.png`：1024×768 底圖鋪滿。
- `vitest 171 passed`（新增 `tests/asset-base.test.ts` 4 it）／city／ui／v3／build／no-syslog 全綠。

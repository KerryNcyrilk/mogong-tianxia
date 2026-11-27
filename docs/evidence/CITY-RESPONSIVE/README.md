# 主城版面自適應（窄屏修正）

日期：2026-11-27。分支 `fix/city-responsive-fit`，基於 `main@d0b46ac6`。

## 問題
舊公式 `scale = clamp(vh/720, 0.72, 1.9)`、`leftW = 276×scale`、`barH = 70×scale` 只看高度：
- 手機直向（390×844）左欄佔 323px，地圖只餘 67px → 底圖近乎消失，底欄亦超出畫面。
- 平板／窄窗同樣出現底圖被左欄頂出、底欄截斷。

## 解法（`src/ui/city/rects.ts` 新增 `cityFrame(vw, vh)`）
1. **斷點 900**：`vw ≥ 900` 維持橫向版（左欄 276＋底欄 70，`scale` 改為 `min(vh/720, vw/1280)`，同時受寬高限制）。
2. **窄屏（< 900）**：`leftW = 0`、地圖 `mapW = vw` 鋪滿整屏；左欄改成「內政」按鈕喚出的抽屜（`drawerScale = min((vh−barH)/720, vw/276)`）。
3. **窄屏底欄**：兩排精簡格（任務／建築／聯盟／競技／師徒、組隊／論壇／幫助／充值／商城），高度 `clamp(vh×0.135, 86, 112)`。
4. 移除 `mapW = max(320, …)` 這個會把地圖推出畫面的下限。

## Gate
`vitest 167 passed`（新增 `tests/city-responsive.test.ts` 4 個 it：手機直向／橫向／桌面總寬＝視窗／斷點與 320–899 全寬）／`city-check` 全 PASS／`ui-check` PASS／`v3-check` 15 區 0 overlap／`build ✓`／`no-syslog` 0 hits。

## 證據
`city-390x844.png`、`city-844x390.png`、`city-768x1024.png`、`city-1024x768.png`、`city-390x844-drawer.png`（內政抽屜）。

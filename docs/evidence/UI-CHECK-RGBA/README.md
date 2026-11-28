# UI-CHECK-RGBA 修正證據

- 原因：`src/ui/city/CityScreen.tsx` 窄屏「內政」抽屜遮罩用 `rgba(20, 14, 8, 0.55)`，抽屜陰影用 `rgba(0, 0, 0, 0.45)`；`scripts/ui-check.mjs` 禁止 `src/ui/city/**` 出現 `rgba(`／`opacity`，六閘 style 一項 FAIL。
- 修法：遮罩改 `background: "transparent"`（保留全屏點擊收起行為，不做半透明壓暗）；陰影改 `4px 0 10px ${STYLE.border}`（白名單色 `#1A120C`）。無新增色值。
- 驗證（本地 `--base=/mogong-tianxia/` 預覽）：`ui-check` PASS（style PASS）；`vitest 171`；`city-check`／`v3-check`／`build`／`no-syslog` 全綠；390×844 實測底圖 `naturalWidth 2496`、0 個 ≥400。
- 截圖：`city-390-drawer-no-rgba.png`（抽屜開，地圖右側仍見）、`city-390-closed.png`（點遮罩位置可收起）。

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { MOCK_QUEUE, MOCK_RESOURCES, formatHMS, queueTitle } from "../src/ui/city/mock.ts"
import { CAMERA, SAFE_RECT, SAFE_RECT_1920, artboardFrame } from "../src/ui/city/rects.ts"
import { CAMERA_DEFAULT_ZOOM, STYLE, UI_1280, UI_1920 } from "../src/ui/city/tokens.ts"

const here = dirname(fileURLToPath(import.meta.url))
const docPath = resolve(here, "../docs/主城UI座標表_v1.md")
const htmlPath = resolve(here, "../docs/ui/mock.html")

function cell(value) {
  const text = String(value)
  if (text.includes("|") || text.includes("\n")) {
    throw new Error(`table cell contains a character that would break Markdown: ${JSON.stringify(text)}`)
  }
  return text
}

function pair(id) {
  const narrow = UI_1280.nodes.find((item) => item.id === id)
  const wide = UI_1920.nodes.find((item) => item.id === id)
  if (!narrow || !wide) throw new Error(`missing node ${id}`)
  return { narrow, wide }
}

const rows = UI_1280.nodes.map((node) => {
  const wide = pair(node.id).wide
  return `| ${cell(node.id)} | ${cell(node.label)} | ${cell(node.group)} | ${cell(node.x)} | ${cell(node.y)} | ${cell(node.w)} | ${cell(node.h)} | ${cell(wide.x)} | ${cell(wide.y)} | ${cell(wide.w)} | ${cell(wide.h)} |`
})

const markdown = [
  "# 主城 UI 座標表 v1",
  "",
  "由 `scripts/ui-table.mjs` 自 `src/ui/city/tokens.ts` 生成。1920 欄是 `scale(UI_1280, 1.5)`，沒有第二套手寫數字。",
  "",
  `安全區 1280：(${SAFE_RECT.x},${SAFE_RECT.y},${SAFE_RECT.w},${SAFE_RECT.h})；1920：(${SAFE_RECT_1920.x},${SAFE_RECT_1920.y},${SAFE_RECT_1920.w},${SAFE_RECT_1920.h})。`,
  `相機 offset 1280：(${CAMERA.offset.x},${CAMERA.offset.y})；1920：(${CAMERA.offset1920.x},${CAMERA.offset1920.y})。預設 zoom ${CAMERA.zoom}。`,
  "",
  "| id | 名稱 | 群組 | 1280 x | 1280 y | 1280 w | 1280 h | 1920 x | 1920 y | 1920 w | 1920 h |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows,
  "",
].join("\n")

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

const TEXT = new Map()
MOCK_RESOURCES.forEach((resource) => {
  TEXT.set(`${resource.id}_value`, resource.value)
  TEXT.set(`${resource.id}_yield`, resource.yieldText)
  TEXT.set(`${resource.id}_icon`, resource.name.slice(0, 1))
})
MOCK_QUEUE.forEach((slot) => {
  TEXT.set(`${slot.id}_name`, queueTitle(slot))
  TEXT.set(`${slot.id}_time`, formatHMS(slot.seconds))
})

function frameMarkup(profile, label) {
  const world = artboardFrame(CAMERA_DEFAULT_ZOOM, profile)
  const panels = ["area_left", "area_chat", "area_actions", "area_queue"]
    .map((id) => profile.nodes.find((item) => item.id === id))
    .map(
      (node) =>
        `<div class="panel" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px;box-shadow:inset 0 0 0 ${profile.borderOuter}px ${STYLE.border}, inset 0 0 0 ${profile.borderOuter + profile.borderInner}px ${STYLE.gold}"></div>`,
    )
    .join("")
  const bits = profile.nodes
    .filter((node) => !node.id.endsWith("_hit") && node.group !== "area")
    .map((node) => {
      const font = node.fontSize ?? Math.max(10, profile.screenW / 128)
      const valueClass = node.fontRole === "value" ? " value" : ""
      const queueAttr = node.id.endsWith("_time") ? ` data-queue="${escapeHtml(node.id.slice(0, -5))}"` : ""
      const text = TEXT.get(node.id) ?? node.label
      return `<div class="node${valueClass}"${queueAttr} style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px;font-size:${font}px">${escapeHtml(text)}</div>`
    })
    .join("")
  return `<section><h2>${escapeHtml(label)}</h2><div class="frame" style="width:${profile.screenW}px;height:${profile.screenH}px">${panels}<img alt="" src="../../public/art/board/city-placeholder.svg" style="left:${world.x}px;top:${world.y}px;width:${world.w}px;height:${world.h}px"/>${bits}</div></section>`
}

const queueBoot = MOCK_QUEUE.map((slot) => ({
  id: slot.id,
  title: queueTitle(slot),
  seconds: slot.seconds,
  status: slot.status,
  text: formatHMS(slot.seconds),
}))

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>主城 UI 灰盒</title>
  <style>
    body { margin: 0; background: ${STYLE.border}; color: ${STYLE.text}; font-family: ${STYLE.fontTitle}; }
    h1, h2, p { margin: 16px; }
    .frame { position: relative; margin: 16px; background: ${STYLE.grass}; overflow: hidden; }
    .frame img, .panel, .node { position: absolute; box-sizing: border-box; }
    .frame img { pointer-events: none; }
    .panel { background: linear-gradient(180deg, ${STYLE.panelRaise} 0%, ${STYLE.panel} 100%); z-index: 1; }
    .node { z-index: 2; color: ${STYLE.text}; overflow: hidden; white-space: nowrap; }
    .value { font-family: ${STYLE.fontValue}; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <h1>主城 UI 灰盒</h1>
  <p>可直接打開。數字來自 1280 基準乘 1.5。隊列在建倒數每秒跳，格式 HH:MM:SS。城外底色 ${STYLE.grass}。</p>
  <p>資源：${escapeHtml(MOCK_RESOURCES.map((item) => `${item.name} ${item.value}`).join(" · "))}</p>
  ${frameMarkup(UI_1280, "1280×720")}
  ${frameMarkup(UI_1920, "1920×1080")}
  <script>
    const queue = ${JSON.stringify(queueBoot)};
    const started = Date.now();
    function pad(value) { return String(value).padStart(2, "0"); }
    function hms(total) {
      const safe = Math.max(0, Math.floor(total));
      return pad(Math.floor(safe / 3600)) + ":" + pad(Math.floor((safe % 3600) / 60)) + ":" + pad(safe % 60);
    }
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      for (const slot of queue) {
        const remain = slot.status === "building" ? Math.max(0, slot.seconds - elapsed) : slot.seconds;
        const text = hms(remain);
        for (const node of document.querySelectorAll("[data-queue='" + slot.id + "']")) node.textContent = text;
      }
    }, 1000);
  </script>
</body>
</html>
`

mkdirSync(dirname(htmlPath), { recursive: true })
writeFileSync(docPath, markdown)
writeFileSync(htmlPath, html)
process.stdout.write(`${docPath}\n${htmlPath}\n`)

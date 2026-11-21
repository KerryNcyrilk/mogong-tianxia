import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { zoneAabb } from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"
import { MOCK_COMBAT_ENTRIES, MOCK_QUEUE, MOCK_RESOURCES, formatHMS, queueTitle } from "../src/ui/city/mock.ts"
import { AREA_IDS, SUBJECT_IDS, layoutAt, worldBoxToScreen } from "../src/ui/city/rects.ts"
import { CAMERA_DEFAULT_ZOOM, CAMERA_ZOOMS, STYLE, UI_1280, UI_1920, scale } from "../src/ui/city/tokens.ts"

const here = dirname(fileURLToPath(import.meta.url))
const cityDir = resolve(here, "../src/ui/city")
const ALLOWED_HEX = new Set([
  "#2B1F17",
  "#3A2A1C",
  "#1A120C",
  "#C8A96B",
  "#E8DCC0",
  "#9C8F78",
  "#6E8B4F",
  "#6B625A",
  "#C9A227",
  "#A5342A",
  "#A09B60",
])

function nodeById(profile, id) {
  const found = profile.nodes.find((item) => item.id === id)
  if (!found) throw new Error(`missing ui node ${id}`)
  return found
}

function numericLeaves(value, path, output) {
  if (typeof value === "number") {
    output.push({ path, value })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => numericLeaves(item, `${path}[${index}]`, output))
    return
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) numericLeaves(item, `${path}.${key}`, output)
  }
}

function walk(dir, output = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, output)
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) output.push(path)
  }
  return output
}

function overlapArea(a, b) {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (width <= 1e-6 || height <= 1e-6) return 0
  return width * height
}

function contains(outer, inner) {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.w <= outer.x + outer.w + 1e-6 &&
    inner.y + inner.h <= outer.y + outer.h + 1e-6
  )
}

function areasLine() {
  const areas = AREA_IDS.map((id) => nodeById(UI_1280, id))
  const widths = areas.map((area) => area.w)
  const sum = widths.reduce((total, width) => total + width, 0)
  const ordered = [...areas].sort((a, b) => a.x - b.x || a.y - b.y)
  let gaps = 0
  for (let index = 0; index < ordered.length - 1; index += 1) {
    gaps += Math.abs(ordered[index + 1].x - (ordered[index].x + ordered[index].w))
  }
  const flush =
    ordered[0].x === 0 &&
    ordered[ordered.length - 1].x + ordered[ordered.length - 1].w === UI_1280.screenW &&
    areas[0].y === 0 &&
    areas[0].h === UI_1280.screenH &&
    areas.slice(1).every((area) => area.y + area.h === UI_1280.screenH && area.h === 70)
  const pass = areas.length === 4 && sum === 1280 && gaps === 0 && flush && widths.join("+") === "276+391+455+158"
  const body = `(${widths.join("+")}=${sum}) gaps: ${gaps}`
  return { pass, line: pass ? `areas: 4 ${body}` : `areas: FAIL ${body}` }
}

function sourceIssues(files) {
  const issues = []
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    if (text.includes("rgba(") || text.includes("opacity")) issues.push(`${file} translucent`)
    for (const hex of text.match(/#[0-9A-Fa-f]{3,8}/g) ?? []) {
      if (!ALLOWED_HEX.has(hex.toUpperCase())) issues.push(`${file} ${hex}`)
    }
  }
  return issues
}

function contentIssues() {
  const issues = []
  const names = ["人口", "玉石", "刀幣", "糧食", "木材", "生鐵", "石頭"]
  const values = ["330", "112", "245600", "51298/63002", "8420/9000", "3120/4500", "980/1300"]
  const formats = ["int", "int", "int", "pair", "pair", "pair", "pair"]
  if (MOCK_RESOURCES.length !== 7) issues.push("resource count")
  MOCK_RESOURCES.forEach((resource, index) => {
    if (resource.name !== names[index] || resource.value !== values[index] || resource.format !== formats[index]) {
      issues.push(`resource ${resource.id}`)
    }
    const icon = nodeById(UI_1280, `${resource.id}_icon`)
    const value = nodeById(UI_1280, `${resource.id}_value`)
    const plus = nodeById(UI_1280, `${resource.id}_plus`)
    if (icon.w !== 18 || icon.h !== 21) issues.push(`${resource.id} icon`)
    if (value.fontSize !== 12 || value.fontRole !== "value") issues.push(`${resource.id} value font`)
    if (plus.w !== 24 || plus.h !== 20) issues.push(`${resource.id} plus`)
  })
  const building = MOCK_QUEUE.filter((slot) => slot.status === "building")
  const queued = MOCK_QUEUE.filter((slot) => slot.status === "queued")
  if (MOCK_QUEUE.length !== 3 || building.length !== 2 || queued.length !== 1) issues.push("queue shape")
  const titles = MOCK_QUEUE.map(queueTitle)
  if (!titles.includes("農田 17級") || !titles.includes("倉庫 13級")) issues.push("queue titles")
  if (formatHMS(29 * 60 + 59) !== "00:29:59" || formatHMS(0) !== "00:00:00") issues.push("hms")
  const seps = UI_1280.nodes.filter((item) => item.id.startsWith("queue_sep_"))
  if (seps.length !== 2 || seps.some((item) => item.h !== 1)) issues.push("queue sep")
  const bars = ["queue_farm_bar", "queue_storage_bar", "queue_wait_bar"].map((id) => nodeById(UI_1280, id))
  if (bars.some((bar) => bar.w !== 4)) issues.push("queue bar")
  return issues
}

function styleLine(files) {
  const issues = [...sourceIssues(files), ...contentIssues()]
  const pass = STYLE.alpha === 1 && UI_1280.borderOuter === 2 && UI_1280.borderInner === 1 && issues.length === 0
  if (!pass && issues.length > 0) console.error(issues.join("\n"))
  const alpha = Number(STYLE.alpha).toFixed(2)
  return { pass, line: `style: ${pass ? "PASS" : "FAIL"} (alpha ${alpha}, border ${UI_1280.borderOuter}px/${UI_1280.borderInner}px)` }
}

function scaleLine() {
  const base = []
  const wide = []
  numericLeaves(UI_1280, "ui", base)
  numericLeaves(UI_1920, "ui", wide)
  let pass = JSON.stringify(UI_1920) === JSON.stringify(scale(UI_1280, 1.5))
  pass &&= base.length === wide.length && base.every((item, index) => wide[index].path === item.path && wide[index].value === item.value * 1.5)
  const chat = nodeById(UI_1920, "area_chat")
  const actions = nodeById(UI_1920, "area_actions")
  const queue = nodeById(UI_1920, "area_queue")
  pass &&= nodeById(UI_1920, "area_left").w === 414
  pass &&= chat.x === 414 && chat.y === 975 && chat.w === 391 * 1.5 && chat.h === 105
  pass &&= actions.x === 667 * 1.5 && actions.y === 975 && actions.w === 455 * 1.5 && actions.h === 105
  pass &&= queue.x === 1683 && queue.y === 975 && queue.w === 237 && queue.h === 105
  pass &&= UI_1920.safe.x === 414 && UI_1920.safe.y === 0 && UI_1920.safe.x + UI_1920.safe.w === 1920
  pass &&= UI_1920.safe.h === 975 && UI_1920.safe.y + UI_1920.safe.h === 975
  pass &&= UI_1920.camera.anchorX === 1167 && UI_1920.camera.anchorY === 487.5
  return { pass, line: `scale: ${pass ? "PASS" : "FAIL"} (${base.length} values, 1920 = 1280*1.5)` }
}

function safeLine() {
  const layout = loadCityLayoutFile()
  let pass = true
  let intersect = 0
  for (const profile of [UI_1280, UI_1920]) {
    const subjects = SUBJECT_IDS.map((id) => {
      const zone = layout.zones.find((item) => item.id === id)
      if (!zone) throw new Error(`missing zone ${id}`)
      return worldBoxToScreen(zoneAabb(zone), CAMERA_DEFAULT_ZOOM, profile)
    })
    if (!subjects.every((box) => contains(profile.safe, box))) pass = false
    for (const ui of profile.nodes) {
      for (const subject of subjects) intersect += overlapArea(ui, subject)
    }
  }
  if (!pass || intersect !== 0) console.error(`safe intersect=${intersect}`)
  return {
    pass: pass && intersect === 0,
    line: `safe: ${pass && intersect === 0 ? "PASS" : "FAIL"} (gov/drill/gate_s inside, ui∩safe=${intersect === 0 ? 0 : intersect})`,
  }
}

function cameraLine() {
  const layout = loadCityLayoutFile()
  const drill = layout.zones.find((zone) => zone.id === "drill")
  let pass = CAMERA_ZOOMS.length === 4 && CAMERA_ZOOMS.every((zoom, index) => zoom === [0.4, 0.5, 1.0, 1.2][index])
  for (const profile of [UI_1280, UI_1920]) {
    const fingerprints = CAMERA_ZOOMS.map((zoom) => JSON.stringify(layoutAt(zoom, profile)))
    if (new Set(fingerprints).size !== 1) pass = false
  }
  const moved = CAMERA_ZOOMS.map((zoom) => JSON.stringify(worldBoxToScreen(zoneAabb(drill), zoom, UI_1280)))
  if (new Set(moved).size !== CAMERA_ZOOMS.length) pass = false
  return { pass, line: `camera: ${pass ? "PASS" : "FAIL"} (${CAMERA_ZOOMS.length} zooms, ui fixed)` }
}

function framingLine() {
  const layout = loadCityLayoutFile()
  const view = { x: 0, y: 0, w: UI_1280.screenW, h: UI_1280.screenH }
  const boxOf = (id) => {
    const zone = layout.zones.find((item) => item.id === id)
    if (!zone) throw new Error(`missing zone ${id}`)
    return worldBoxToScreen(zoneAabb(zone), 0.4, UI_1280)
  }
  const need = ["wall_n", "wall_e", "wall_w", "wall_s_e", "wall_s_w", "gate_s", "forest", "iron_mine", "farm", "quarry", "beacon"]
  const missed = need.filter((id) => overlapArea(boxOf(id), view) <= 0 || overlapArea(boxOf(id), UI_1280.safe) <= 0)
  const gate = boxOf("gate_s")
  const north = boxOf("wall_n")
  const leftBiased = gate.x + gate.w / 2 < UI_1280.screenW / 2
  const facingNorth = gate.y + gate.h / 2 > north.y + north.h / 2
  const pass = missed.length === 0 && leftBiased && facingNorth
  if (!pass) console.error(`framing missed=${missed.join(",") || "-"} left=${leftBiased} north=${facingNorth}`)
  return { pass, line: `framing: ${pass ? "PASS" : "FAIL"} (zoom 0.4 walls, belt, left gate, facing north)` }
}

function typographyLine() {
  let pass = true
  for (const node of UI_1280.nodes) {
    if (node.fontRole === "body" && !(node.fontSize >= 10)) pass = false
    if (node.fontRole === "value" && !(node.fontSize >= 12)) pass = false
    if (node.hit === "control" && !(node.w >= 32 && node.h >= 32)) pass = false
    if (node.hit === "ring" && !(node.w >= 44 && node.h >= 44)) pass = false
  }
  for (const node of UI_1920.nodes) {
    if (node.fontSize !== undefined && !(node.fontSize >= 15)) pass = false
  }
  pass &&= UI_1280.nodes.some((node) => node.fontRole === "body")
  pass &&= UI_1280.nodes.some((node) => node.fontRole === "value")
  pass &&= UI_1280.nodes.some((node) => node.hit === "control")
  pass &&= UI_1280.nodes.some((node) => node.hit === "ring")
  return { pass, line: `typography: ${pass ? "PASS" : "FAIL"} (min 10/12px, hit 32, ring 44)` }
}

function importCount(files) {
  const patterns = [
    /import\s+[^'"\n]*from\s+["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+[^'"\n]*from\s+["']([^"']+)["']/g,
  ]
  let count = 0
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const spec = match[1]
        const resolved = spec.startsWith(".") ? resolve(dirname(file), spec).replaceAll("\\", "/") : spec
        if (resolved.includes("/src/combat/") || resolved.endsWith("/BattleView.tsx") || resolved.endsWith("/BattleView.ts")) {
          count += 1
        }
      }
    }
  }
  return count
}

function combatLine(files) {
  const disabled = MOCK_COMBAT_ENTRIES.filter((entry) => entry.disabled && entry.note === "戰鬥系統待 B6")
  const tsx = files
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
  const namesOk = ["校場", "點兵場", "競技"].every((name) => tsx.includes(name))
  const phraseCount = tsx.split("戰鬥系統待 B6").length - 1
  const disabledCount = (tsx.match(/\bdisabled\b/g) ?? []).length
  const imports = importCount(files)
  const pass = disabled.length === 3 && namesOk && phraseCount >= 3 && disabledCount >= 3 && imports === 0
  return { pass, line: `combat-frozen: ${pass ? "PASS" : "FAIL"} (${disabled.length} entries disabled, imports ${imports})` }
}

const files = walk(cityDir)
const lines = [areasLine(), styleLine(files), scaleLine(), safeLine(), cameraLine(), framingLine(), typographyLine(), combatLine(files)]
process.stdout.write(`${lines.map((item) => item.line).join("\n")}\n`)
process.exit(lines.every((item) => item.pass) ? 0 : 1)

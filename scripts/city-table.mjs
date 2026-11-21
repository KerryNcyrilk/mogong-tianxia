import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadCityLayout } from "../src/city/layout.ts"

const RETIRED_MD5 = "e380c3abaea0e451008b2c03fcd5ae13"
const here = dirname(fileURLToPath(import.meta.url))
const layoutPath = resolve(here, "../data/cityLayout.json")
const docPath = resolve(here, "../docs/主城座標表_v1.md")

function cell(value) {
  const text = String(value ?? "")
  if (text.includes("|") || text.includes("\n")) {
    throw new Error(`table cell contains a character that would break Markdown: ${JSON.stringify(text)}`)
  }
  return text
}

let markdown
try {
  const bytes = readFileSync(layoutPath)
  const md5 = createHash("md5").update(bytes).digest("hex")
  if (md5 === RETIRED_MD5) {
    throw new Error("data/cityLayout.json is still the retired Doubao 28×20 file")
  }
  const layout = loadCityLayout(bytes.toString("utf8"))
  if (layout.zones.length !== 37) throw new Error(`expected 37 zones, got ${layout.zones.length}`)
  if (layout.meta.version !== "iris-v1") throw new Error("layout version is not iris-v1")
  const rows = layout.zones.map(
    (zone) =>
      `| ${cell(zone.id)} | ${cell(zone.name)} | ${cell(zone.kind)} | ${cell(zone.x)} | ${cell(zone.y)} | ${cell(zone.w)} | ${cell(zone.h)} | ${cell(zone.note ?? "")} |`,
  )
  markdown = [
    "# 主城座標表 v1",
    "",
    "由 `scripts/city-table.mjs` 自 `data/cityLayout.json`（Iris v1，28×24）生成。這份 JSON 是座標權威。",
    "",
    `fingerprint: md5 ${md5}。豆包 28×20 的 md5 ${RETIRED_MD5} 已退役，不是座標權威。封存見 \`data/archive/cityLayout.doubao-28x20.NOT-AUTHORITATIVE.json\`。`,
    "",
    "**37 區。座標以 JSON 為準，不從總覽圖量格。**",
    "",
    "| id | name | kind | x | y | w | h | note |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n")
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

writeFileSync(docPath, markdown)
process.stdout.write(`${docPath}\n`)

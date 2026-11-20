import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadCityLayout } from "../src/city/layout.ts"

const OFFICIAL_MD5 = "e380c3abaea0e451008b2c03fcd5ae13"
const here = dirname(fileURLToPath(import.meta.url))
const layoutPath = resolve(here, "../data/cityLayout.json")

function cell(value) {
  const text = String(value)
  if (text.includes("|") || text.includes("\n")) {
    throw new Error(`table cell contains a character that would break Markdown: ${JSON.stringify(text)}`)
  }
  return text
}

let markdown
try {
  const bytes = readFileSync(layoutPath)
  const md5 = createHash("md5").update(bytes).digest("hex")
  if (md5 !== OFFICIAL_MD5) {
    throw new Error(`data/cityLayout.json md5 ${md5} !== ${OFFICIAL_MD5}`)
  }
  const layout = loadCityLayout(bytes.toString("utf8"))
  if (layout.zones.length !== 31) throw new Error(`expected 31 zones, got ${layout.zones.length}`)
  const rows = layout.zones.map((zone) =>
    `| ${cell(zone.id)} | ${cell(zone.name)} | ${cell(zone.layer)} | ${cell(zone.kind)} | ${cell(zone.x)} | ${cell(zone.y)} | ${cell(zone.w)} | ${cell(zone.h)} | ${cell(zone.sprite)} |`,
  )
  markdown = [
    "# 主城座標表 v1",
    "",
    `source: spec/cityLayout.v1.json（md5 ${OFFICIAL_MD5}，Kerry 原檔，byte 未改）`,
    "",
    "**31 係正確數；舊文件寫 26／28 係錯，以 JSON 為準**",
    "",
    "| id | name | layer | kind | x | y | w | h | sprite |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n")
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

process.stdout.write(markdown)

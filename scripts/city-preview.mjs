import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ARTBOARD_H, ARTBOARD_W } from "../src/city/coords.ts"
import { loadCityLayoutFile } from "../src/city/layout.node.ts"
import { renderCitySvg } from "../src/city/scene.ts"

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, "../public/art/board/city-placeholder.svg")

let svg
try {
  const layout = loadCityLayoutFile()
  svg = renderCitySvg(layout)
  for (const zone of layout.zones) {
    if (!svg.includes(`id="zone-${zone.id}"`)) throw new Error(`preview skipped zone ${zone.id}`)
  }
  if (!svg.includes('data-layout="iris-v1"')) throw new Error("preview is not tagged iris-v1")
  if (layout.zones.length !== 37) throw new Error(`expected 37 zones, got ${layout.zones.length}`)
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, svg)
process.stdout.write(`${outPath}\n${ARTBOARD_W}×${ARTBOARD_H}\n`)

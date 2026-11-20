import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkCityLayout, cityCheckPassed, formatCityCheck, loadCityLayout } from "../src/city/zones.ts"

const here = dirname(fileURLToPath(import.meta.url))
const defaultLayout = resolve(here, "../src/city/fixtures/city-layout.fixture.json")
const layoutPath = process.argv[2] ? resolve(process.argv[2]) : defaultLayout

let layout
try {
  layout = loadCityLayout(readFileSync(layoutPath, "utf8"))
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error"
  console.error(message)
  process.exit(1)
}

const result = checkCityLayout(layout)
process.stdout.write(formatCityCheck(result))
process.exit(cityCheckPassed(result) ? 0 : 1)

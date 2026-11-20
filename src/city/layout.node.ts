/**
 * Node-only loader. Scripts import this file.
 * The browser barrel (`src/city/index.ts`) and `layout.ts` must not import it.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { loadCityLayout } from "./layout.ts"

const defaultLayoutPath = fileURLToPath(new URL("../../data/cityLayout.json", import.meta.url))

/** Node-only. Scripts call this; the browser should pass JSON text to loadCityLayout. */
export function loadCityLayoutFile(path: string = defaultLayoutPath) {
  return loadCityLayout(readFileSync(path, "utf8"))
}

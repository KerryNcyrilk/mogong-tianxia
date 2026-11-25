import internalJson from "../../data/internal.json"
import type { InternalConfig } from "./types.ts"

/** The one and only tunable source: data/internal.json (B5 ruling ④). */
export const INTERNAL_CONFIG = internalJson as unknown as InternalConfig

export function assertConfig(config: InternalConfig): void {
  if (config.schema !== 1) throw new Error("internal.json schema mismatch")
  if (config.resources.length !== 7) throw new Error("internal.json must define 7 resources")
  if (config.tax.rates.length !== 3) throw new Error("internal.json must define 3 tax rates")
  for (const def of config.resources) {
    if (!(def.key in config.start)) throw new Error(`internal.json start missing ${def.key}`)
  }
}

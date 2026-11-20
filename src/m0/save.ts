import { SCHEMA_VERSION, type SaveState } from "./settle.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readBag(value: unknown, label: string): Record<string, number> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  const bag: Record<string, number> = {}
  for (const [key, rate] of Object.entries(value)) {
    if (typeof rate !== "number" || !Number.isFinite(rate)) throw new Error(`${label}.${key} must be a finite number`)
    bag[key] = rate
  }
  return bag
}

function readRates(value: unknown, label: string): SaveState["producers"] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((row, index) => {
    if (!isRecord(row) || typeof row.id !== "string") throw new Error(`${label}[${index}].id must be a string`)
    return { id: row.id, perHour: readBag(row.perHour, `${label}[${index}].perHour`) }
  })
}

/** JSON, UTF-8, LF. Pretty-printed so the line ending rule is visible. */
export function serializeSave(state: SaveState): string {
  const body = {
    schemaVersion: state.schemaVersion,
    resources: state.resources,
    producers: state.producers,
    consumers: state.consumers,
  }
  return `${JSON.stringify(body, null, 2).replace(/\r\n/g, "\n")}\n`
}

export function parseSave(text: string): SaveState {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value)) throw new Error("save must be an object")
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error(`save schemaVersion must be ${SCHEMA_VERSION}`)
  return {
    schemaVersion: SCHEMA_VERSION,
    resources: readBag(value.resources, "resources"),
    producers: readRates(value.producers, "producers"),
    consumers: readRates(value.consumers, "consumers"),
  }
}

import { SAVE_KEY as GENERAL_SAVE_KEY } from "../../general/engine.ts"
import { SAVE_KEY as INTERNAL_SAVE_KEY } from "../../internal/engine.ts"
import { LAST_AT_KEY } from "../../ui/city/persist.ts"
import { readOverrides, type DevOverrideBag } from "../devOverrides.ts"
import { devEvents, type DevEvent } from "./eventRing.ts"

export const DEBUG_BUNDLE_SCHEMA = "debug-bundle.v1"

export interface DebugBundle {
  schema: typeof DEBUG_BUNDLE_SCHEMA
  at: number
  save: {
    internal: string | null
    general: string | null
    lastAt: string | null
  }
  devOverrides: DevOverrideBag | null
  events: DevEvent[]
}

type Store = { getItem(key: string): string | null }

function browserStore(): Store | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

function readKey(store: Store | null, key: string): string | null {
  if (!store) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

/** 存檔讀自傳入的 storage；覆寫與事件流讀記憶體。不寫硬碟。 */
export function buildDebugBundle(store?: Store | null, at = Date.now()): DebugBundle {
  const source = store === undefined ? browserStore() : store
  const events = devEvents().slice(-30)
  return {
    schema: DEBUG_BUNDLE_SCHEMA,
    at,
    save: {
      internal: readKey(source, INTERNAL_SAVE_KEY),
      general: readKey(source, GENERAL_SAVE_KEY),
      lastAt: readKey(source, LAST_AT_KEY),
    },
    devOverrides: readOverrides(),
    events,
  }
}

export function debugBundleJson(store?: Store | null, at = Date.now()): string {
  return JSON.stringify(buildDebugBundle(store, at), null, 2)
}

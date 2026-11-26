import { INTERNAL_CONFIG } from "../../internal/config.ts"
import { tick } from "../../internal/engine.ts"
import type { InternalState } from "../../internal/types.ts"
import type { RosterState } from "../../general/types.ts"

const LAST_AT = "mogong.internal.lastAt"
const OFFLINE_CAP_HOURS = 12

export function markSaved(at = Date.now()): void {
  try {
    localStorage.setItem(LAST_AT, String(at))
  } catch {
    // 私隱模式忽略
  }
}

export interface OfflineReport {
  seconds: number
  rows: { key: string; label: string; gain: number }[]
  state: InternalState
}

/** 離線收益：以存檔時間戳結算，上限 12 小時，受倉庫上限約束（tick 內已夾）。 */
export function settleOffline(state: InternalState): OfflineReport | null {
  let last = 0
  try {
    last = Number(localStorage.getItem(LAST_AT) ?? 0)
  } catch {
    last = 0
  }
  if (!last) return null
  const seconds = Math.min(Math.floor((Date.now() - last) / 1000), OFFLINE_CAP_HOURS * 3600)
  if (seconds < 120) return null
  const next = tick(state, INTERNAL_CONFIG, seconds)
  const rows = INTERNAL_CONFIG.resources
    .map((def) => ({
      key: def.key,
      label: def.name,
      gain: Math.floor(next.resources[def.key] - state.resources[def.key]),
    }))
    .filter((row) => row.gain > 0)
  return { seconds, rows, state: next }
}

export function exportSave(internal: InternalState, roster: RosterState): string {
  const payload = JSON.stringify({ internal, roster, at: Date.now() }, null, 0)
  return btoa(unescape(encodeURIComponent(payload)))
}

export function importSave(text: string): { internal: InternalState; roster: RosterState } | null {
  try {
    const raw = decodeURIComponent(escape(atob(text.trim())))
    const parsed = JSON.parse(raw) as { internal?: InternalState; roster?: RosterState }
    if (!parsed.internal || !parsed.roster) return null
    if (parsed.internal.schema !== 1) return null
    return { internal: parsed.internal, roster: parsed.roster }
  } catch {
    return null
  }
}

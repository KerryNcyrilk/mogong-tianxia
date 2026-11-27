import { INTERNAL_CONFIG } from "../../internal/config.ts"
import type { InternalState } from "../../internal/types.ts"

export type UpgradePreviewMode = "resource" | "pop" | "queue"

export interface UpgradePreview {
  kind: string
  /** 只有「人口已滿」需要強制文案：官方升級費用不含人口。 */
  forceReason: string | null
  state: InternalState
}

function clone(state: InternalState): InternalState {
  return JSON.parse(JSON.stringify(state)) as InternalState
}

/** 做出一份不寫存檔的預覽狀態，讓現有 UpgradeDialog 顯示禁用原因。 */
export function buildUpgradePreview(current: InternalState, mode: UpgradePreviewMode): UpgradePreview {
  const state = clone(current)
  if (mode === "resource") {
    for (const key of Object.keys(state.resources) as (keyof InternalState["resources"])[]) {
      state.resources[key] = 0
    }
    return { kind: "gov", forceReason: null, state }
  }
  if (mode === "queue") {
    const house = INTERNAL_CONFIG.buildings.find((item) => item.kind === "house")
    const seconds = house?.seconds ?? 1
    state.slots = state.slots.map((slot) => ({
      ...slot,
      kind: "house",
      label: house?.label ?? slot.label,
      levelAtStart: state.levels.house ?? 1,
      seconds,
      remaining: seconds,
      elapsed: 0,
      status: "building",
      paid: {},
    }))
    return { kind: "gov", forceReason: null, state }
  }
  const pop = INTERNAL_CONFIG.resources.find((item) => item.key === "pop")
  const cap = pop?.cap ? pop.cap.base + pop.cap.unit * (state.levels.pop ?? pop.cap.levels) : state.resources.pop
  state.resources.pop = cap
  return { kind: "house", forceReason: "人口已滿", state }
}

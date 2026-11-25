import stagesJson from "../../data/stages.json"
import { inBounds } from "../combat/grid.ts"
import { isUnitType } from "../combat/catalog.ts"
import type { Stage, StageFile } from "./types.ts"

/** data/stages.json 是 B7 唯一可調真源；這裡只做載入與自檢。 */
export const STAGE_FILE = stagesJson as unknown as StageFile

export function stageById(id: string, file: StageFile = STAGE_FILE): Stage | null {
  return file.stages.find((stage) => stage.id === id) ?? null
}

export function assertStageFile(file: StageFile = STAGE_FILE): void {
  if (file.schemaVersion !== "stages.b7.v0.1") throw new Error("stages.json schema mismatch")
  if (file.stages.length < 1) throw new Error("stages.json needs at least one stage")
  if (file.attacker.positions.length !== 3) throw new Error("stages.json attacker needs 3 positions")
  for (const position of file.attacker.positions) {
    if (!inBounds(position.x, position.y)) throw new Error(`attacker position out of bounds ${position.x},${position.y}`)
  }
  const seen = new Set(file.attacker.positions.map((position) => `${position.x},${position.y}`))
  if (seen.size !== file.attacker.positions.length) throw new Error("attacker positions overlap")
  for (const stage of file.stages) {
    if (stage.enemy.length === 0) throw new Error(`stage ${stage.id} has no enemy`)
    const cells = new Set(seen)
    for (const draft of stage.enemy) {
      if (!isUnitType(draft.type)) throw new Error(`stage ${stage.id} unknown unit ${draft.type}`)
      if (draft.count < 1) throw new Error(`stage ${stage.id} enemy count ${draft.count}`)
      if (!inBounds(draft.x, draft.y)) throw new Error(`stage ${stage.id} enemy out of bounds ${draft.x},${draft.y}`)
      const key = `${draft.x},${draft.y}`
      if (cells.has(key)) throw new Error(`stage ${stage.id} cell occupied ${key}`)
      cells.add(key)
    }
  }
  const rules = file.settle
  for (const [key, value] of Object.entries(rules)) {
    if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`settle.${key} must be a number`)
  }
  if (rules.woundPctOnLose < 0 || rules.woundPctOnLose > 1) throw new Error("settle.woundPctOnLose must be 0..1")
  if (rules.retreatKeepPct < 0 || rules.retreatKeepPct > 1) throw new Error("settle.retreatKeepPct must be 0..1")
}

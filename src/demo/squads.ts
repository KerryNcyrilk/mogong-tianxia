import type { Squad, UnitType } from "../combat/types.ts"
import type { GeneralConfig, RosterState } from "../general/types.ts"
import { battleGeneral } from "../general/engine.ts"
import { SANDBOX_UNITS } from "../sandbox/scenario.ts"
import type { DeployedSlot, ExpeditionReason, Stage, StageFile } from "./types.ts"

/**
 * B7 §2.2：校場三格 → Squad[]。兵數在編隊時已由兵池扣除，
 * 戰後只按存活數回池，所以這裡不再二次扣兵。
 * 敵方按 data/stages.json 的關卡編制，攻防取 sandbox 同一張數值表（與 B2 棋盤同尺度）。
 */
export function buildSquads(
  roster: RosterState,
  config: GeneralConfig,
  stage: Stage,
  file: StageFile,
): { ok: boolean; reason?: ExpeditionReason; squads: Squad[]; deployed: DeployedSlot[] } {
  const squads: Squad[] = []
  const deployed: DeployedSlot[] = []
  let seq = 1

  for (let index = 0; index < roster.formation.length; index += 1) {
    const slot = roster.formation[index]
    const position = file.attacker.positions[index]
    if (!slot?.generalId || !slot.unit || !position) continue
    const unit = slot.unit as UnitType
    const row = SANDBOX_UNITS[unit]
    if (!row) return { ok: false, reason: "unknown-unit", squads: [], deployed: [] }
    const record = battleGeneral(roster, slot.generalId, config)
    const hp = slot.count * row.hpPer
    const squadId = `mo-${index}-${unit}`
    squads.push({
      id: squadId,
      side: "attacker",
      type: unit,
      atk: row.atk,
      def: row.def,
      count: slot.count,
      hp,
      maxHp: hp,
      hpPer: row.hpPer,
      range: row.range,
      move: row.move,
      x: position.x,
      y: position.y,
      seq,
      general: record ? { id: record.id, name: record.name, atk: record.atk, def: record.def, skills: record.skills } : null,
    })
    deployed.push({ slotIndex: index, generalId: slot.generalId, unit, count: slot.count, squadId, hpPer: row.hpPer })
    seq += 1
  }

  if (squads.length === 0) return { ok: false, reason: "empty-formation", squads: [], deployed: [] }

  for (const draft of stage.enemy) {
    const row = SANDBOX_UNITS[draft.type]
    if (!row) return { ok: false, reason: "unknown-unit", squads: [], deployed: [] }
    const hp = draft.count * row.hpPer
    squads.push({
      id: `qin-${draft.type}-${draft.x}${draft.y}`,
      side: "defender",
      type: draft.type,
      atk: row.atk,
      def: row.def,
      count: draft.count,
      hp,
      maxHp: hp,
      hpPer: row.hpPer,
      range: row.range,
      move: row.move,
      x: draft.x,
      y: draft.y,
      seq,
      general: null,
    })
    seq += 1
  }

  return { ok: true, squads, deployed }
}

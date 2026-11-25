import generalsJson from "../../data/generals.json"
import type { GeneralConfig } from "./types.ts"

/** B6 唯一可調真源：data/generals.json。 */
export const GENERAL_CONFIG = generalsJson as unknown as GeneralConfig

export function assertGeneralConfig(config: GeneralConfig = GENERAL_CONFIG): void {
  if (config.schemaVersion !== "generals.v1.0") throw new Error("generals.json schema mismatch")
  if (config.troops.length !== 7) throw new Error("generals.json must define 7 troop rows")
  if (config.equipment.slots.length !== 3) throw new Error("generals.json must define 3 equip slots")
  if (config.tavern.slots !== 3) throw new Error("generals.json tavern must offer 3")
  if (config.formation.slots !== 3) throw new Error("generals.json formation must have 3 slots")
  for (const entry of config.pool) {
    if (!config.archetypes.some((item) => item.id === entry.archetype)) throw new Error(`unknown archetype ${entry.archetype}`)
    for (const skill of entry.skills) {
      if (!config.skills.some((item) => item.id === skill)) throw new Error(`unknown skill ${skill}`)
    }
  }
}

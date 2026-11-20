export const M0_TURN_LIMIT = 15

export interface SpeedUnit {
  id: string
  spd: number
}

/**
 * M0 default when the spec file is absent: higher spd acts first, then smaller id.
 * This does not replace combat-core initiative, which keeps the locked v3.1 tie rank.
 */
export function orderBySpeedThenId<T extends SpeedUnit>(units: readonly T[]): T[] {
  return units.slice().sort((a, b) => {
    if (a.spd !== b.spd) return b.spd - a.spd
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
}

/** Floats stay float until this final step. */
export function roundFinalDamage(value: number): number {
  return Math.round(value)
}

/**
 * M0 default: a fight still unfinished at the turn cap is a loss for the attacker.
 * combat-core keeps the ACCEPT rule of comparing remaining HP instead.
 */
export function unfinishedAttackerLoses(turn: number): "defender" | null {
  if (turn >= M0_TURN_LIMIT) return "defender"
  return null
}

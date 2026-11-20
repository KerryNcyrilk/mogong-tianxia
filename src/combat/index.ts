export { balance } from "./balance.ts"
export { createBattle, isAlive, runBattle, sideHp, step } from "./battle.ts"
export type { BattleEvent, BattleState } from "./battle.ts"
export { COUNTER_PAIRS, COUNTER_TARGET, counterMultiplier } from "./counter.ts"
export type { CounterPair } from "./counter.ts"
export {
  attackPrime,
  calculateDamage,
  defensePrime,
  lossesFromDamage,
  skillDamage,
  skillLosses,
  stackTotalHp,
  turnsToClear,
} from "./damage.ts"
export { GRID_COLS, GRID_ROWS, cellKey, chebyshev, inBounds, occupancy, placeSquad } from "./grid.ts"
export { SPEED, TIE_RANK, UNIT_LABEL, initiativeOrder } from "./initiative.ts"
export type { DamageInput, General, Side, Squad, UnitType } from "./types.ts"

import { describe, expect, test } from "vitest"
import { allArtSlots } from "../src/art/manifest.ts"
import { balance } from "../src/combat/balance.ts"
import { createBattle, runBattle, sideHp, step } from "../src/combat/battle.ts"
import { resolveBattle, resolveTurn, type BattleState } from "../src/combat/core.ts"
import { counterMultiplier } from "../src/combat/counter.ts"
import {
  calcDamage,
  calculateDamage,
  lossesFromDamage,
  skillDamage,
  stackTotalHp,
  turnsToClear,
} from "../src/combat/damage.ts"
import { GRID_COLS, GRID_ROWS, occupancy, placeSquad } from "../src/combat/grid.ts"
import { SPEED, initiativeOrder } from "../src/combat/initiative.ts"
import type { General, Squad, UnitSnapshot, UnitType } from "../src/combat/types.ts"
import { createScenario } from "../src/sandbox/scenario.ts"
import catalog from "../data/units.json" with { type: "json" }

function general(partial: Partial<General> = {}): General {
  return {
    id: partial.id ?? "fixture-general",
    name: partial.name ?? "夾具",
    atk: partial.atk ?? 0,
    def: partial.def ?? 40,
  }
}

function hit(partial: {
  atk: number
  def: number
  count: number
  attackerType: UnitType
  defenderType: UnitType
  attackerGeneral?: General | null
}) {
  return calculateDamage({
    atk: partial.atk,
    def: partial.def,
    count: partial.count,
    attackerType: partial.attackerType,
    defenderType: partial.defenderType,
    attackerGeneral: partial.attackerGeneral ?? null,
    defenderGeneral: null,
    retaliation: false,
  })
}

function expectNear(actual: number, expected: number, rel: number) {
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(rel)
}

function squad(partial: Partial<Squad> & Pick<Squad, "id" | "side" | "type">): Squad {
  const count = partial.count ?? 10
  const hpPer = partial.hpPer ?? 10
  const hp = partial.hp ?? count * hpPer
  return {
    id: partial.id,
    side: partial.side,
    type: partial.type,
    atk: partial.atk ?? 10,
    def: partial.def ?? 5,
    count,
    hp,
    maxHp: partial.maxHp ?? hp,
    hpPer,
    range: partial.range ?? 1,
    move: partial.move ?? 0,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    seq: partial.seq ?? 0,
    general: partial.general ?? null,
  }
}

function snap(partial: Partial<UnitSnapshot> & Pick<UnitSnapshot, "id" | "side">): UnitSnapshot {
  const unit: UnitSnapshot = {
    id: partial.id,
    side: partial.side,
    atk: partial.atk ?? 0,
    def: partial.def ?? 0,
    spd: partial.spd ?? 1,
    range: partial.range ?? 1,
    hp: partial.hp ?? 100,
  }
  if (partial.index !== undefined) unit.index = partial.index
  if (partial.x !== undefined) unit.x = partial.x
  if (partial.y !== undefined) unit.y = partial.y
  return unit
}

function fight(units: UnitSnapshot[], turn = 0): BattleState {
  return { units, turn }
}

function target(id: string) {
  const row = catalog.targets.find((item) => item.id === id)
  if (!row) throw new Error(id)
  return row
}

function pairHit(attacker: string, defender: string): number {
  return calcDamage(snap({ id: attacker, atk: 1000, side: "attacker" }), snap({ id: defender, def: 0, side: "defender" }))
}

function expectMultiplier(pairs: readonly (readonly [string, string])[], mult: number) {
  for (const [attacker, defender] of pairs) {
    expect(counterMultiplier(attacker, defender)).toBe(mult)
    expect(pairHit(attacker, defender)).toBe(1000 * mult)
  }
}

describe("v4.0 A formula", () => {
  test("A no-counter hit stays at C 1.00", () => {
    // Folded from the first slice E8: scholar vs shield is outside the ring, and 神獸 stays outside it.
    expect(counterMultiplier("xuezhe", "dun")).toBe(1)
    expect(counterMultiplier("scholar", "shield")).toBe(1)
    expect(counterMultiplier("beast", "cavalry")).toBe(1)
    expect(counterMultiplier("halberd", "beast")).toBe(1)
    const damage = calcDamage(snap({ id: "xuezhe", atk: 500, side: "attacker" }), snap({ id: "dun", def: 0, side: "defender" }))
    expect(damage).toBe(500)
  })

  test("A defense is subtracted inside the formula", () => {
    const open = calcDamage(snap({ id: "xuezhe", atk: 500, side: "attacker" }), snap({ id: "dun", def: 0, side: "defender" }))
    const walled = calcDamage(snap({ id: "xuezhe", atk: 500, side: "attacker" }), snap({ id: "dun", def: 125, side: "defender" }))
    expect(open).toBe(500)
    expect(walled).toBe(375)
    expect(open - walled).toBe(125)
  })

  test("A floor drops the fraction, including one half", () => {
    const half = calcDamage(snap({ id: "xuezhe", atk: 2, side: "attacker" }), snap({ id: "gong", def: 0, side: "defender" }))
    const below = calcDamage(snap({ id: "gong", atk: 3, side: "attacker" }), snap({ id: "xuezhe", def: 0, side: "defender" }))
    expect(2 * 1.25).toBe(2.5)
    expect(half).toBe(2)
    expect(below).toBe(2)
  })
})

describe("v4.0 B counters", () => {
  // Folded from the first slice E1–E7. Each directed pair is its own case.
  // English grid ids resolve through the same ring. Elites resolve through aliases.
  test("B xuezhe to gong is 1.25", () => {
    expectMultiplier(
      [
        ["xuezhe", "gong"],
        ["scholar", "bow"],
        ["xuezhe", "qiang-nu"],
      ],
      1.25,
    )
  })

  test("B gong to dun is 1.25", () => {
    expectMultiplier(
      [
        ["gong", "dun"],
        ["bow", "shield"],
        ["qiang-nu", "dun"],
        ["gong", "tie-dun"],
        ["qiang-nu", "tie-dun"],
      ],
      1.25,
    )
  })

  test("B dun to dao is 1.25", () => {
    expectMultiplier(
      [
        ["dun", "dao"],
        ["shield", "blade"],
        ["tie-dun", "dao"],
        ["dun", "rui-dao"],
        ["tie-dun", "rui-dao"],
      ],
      1.25,
    )
  })

  test("B dao to ji is 1.25", () => {
    expectMultiplier(
      [
        ["dao", "ji"],
        ["blade", "halberd"],
        ["rui-dao", "ji"],
        ["dao", "chang-ji"],
        ["rui-dao", "chang-ji"],
      ],
      1.25,
    )
  })

  test("B ji to qi is 1.25", () => {
    expectMultiplier(
      [
        ["ji", "qi"],
        ["halberd", "cavalry"],
        ["chang-ji", "qi"],
        ["ji", "zhong-qi"],
        ["chang-ji", "zhong-qi"],
      ],
      1.25,
    )
  })

  test("B qi to xuezhe is 1.25", () => {
    expectMultiplier(
      [
        ["qi", "xuezhe"],
        ["cavalry", "scholar"],
        ["zhong-qi", "xuezhe"],
      ],
      1.25,
    )
  })

  test("B gong to xuezhe is 0.80", () => {
    expectMultiplier(
      [
        ["gong", "xuezhe"],
        ["bow", "scholar"],
        ["qiang-nu", "xuezhe"],
      ],
      0.8,
    )
  })

  test("B dun to gong is 0.80", () => {
    expectMultiplier(
      [
        ["dun", "gong"],
        ["shield", "bow"],
        ["tie-dun", "gong"],
        ["dun", "qiang-nu"],
        ["tie-dun", "qiang-nu"],
      ],
      0.8,
    )
  })

  test("B dao to dun is 0.80", () => {
    expectMultiplier(
      [
        ["dao", "dun"],
        ["blade", "shield"],
        ["rui-dao", "dun"],
        ["dao", "tie-dun"],
        ["rui-dao", "tie-dun"],
      ],
      0.8,
    )
  })

  test("B ji to dao is 0.80", () => {
    expectMultiplier(
      [
        ["ji", "dao"],
        ["halberd", "blade"],
        ["chang-ji", "dao"],
        ["ji", "rui-dao"],
        ["chang-ji", "rui-dao"],
      ],
      0.8,
    )
  })

  test("B qi to ji is 0.80", () => {
    expectMultiplier(
      [
        ["qi", "ji"],
        ["cavalry", "halberd"],
        ["zhong-qi", "ji"],
        ["qi", "chang-ji"],
        ["zhong-qi", "chang-ji"],
      ],
      0.8,
    )
  })

  test("B xuezhe to qi is 0.80", () => {
    expectMultiplier(
      [
        ["xuezhe", "qi"],
        ["scholar", "cavalry"],
        ["xuezhe", "zhong-qi"],
      ],
      0.8,
    )
  })
})

describe("v4.0 C morale", () => {
  test("C morale 0.75 scales after defense", () => {
    const damage = calcDamage(snap({ id: "solo", atk: 1000, side: "attacker" }), snap({ id: "dummy", def: 0, side: "defender" }), {
      morale: 0.75,
    })
    expect(damage).toBe(750)
  })

  test("C morale 1.25 scales after defense", () => {
    const damage = calcDamage(snap({ id: "solo", atk: 1000, side: "attacker" }), snap({ id: "dummy", def: 0, side: "defender" }), {
      morale: 1.25,
    })
    expect(damage).toBe(1250)
  })
})

describe("v4.0 D anchors", () => {
  test("D A1 is 1000", () => {
    const row = target("TARGET-A1")
    expect(row.atk).toBe(1000)
    expect(row.def).toBe(0)
    const damage = calcDamage(snap({ id: "TARGET-A1", atk: row.atk, side: "attacker" }), snap({ id: "neutral", def: row.def, side: "defender" }))
    expect(damage).toBe(1000)
  })

  test("D A2 is 1250", () => {
    const row = target("TARGET-A2")
    expect(row.atk).toBe(1000)
    expect(row.def).toBe(0)
    const damage = calcDamage(snap({ id: "dao", atk: row.atk, side: "attacker" }), snap({ id: "ji", def: row.def, side: "defender" }))
    expect(counterMultiplier("dao", "ji")).toBe(1.25)
    expect(damage).toBe(1250)
  })

  test("D A5 is 4374", () => {
    const row = target("TARGET-A5")
    expect(row.atk).toBe(5832)
    expect(row.def).toBe(0)
    expect(row.atk * 1 * 0.75).toBe(4374)
    const damage = calcDamage(
      snap({ id: "TARGET-A5", atk: row.atk, side: "attacker" }),
      snap({ id: "TARGET-A1", def: row.def, side: "defender" }),
      { morale: 0.75 },
    )
    expect(damage).toBe(4374)
  })
})

describe("v4.0 E initiative", () => {
  test("E higher spd acts first", () => {
    const state = resolveTurn(
      fight([
        snap({ id: "slow", side: "attacker", spd: 1, atk: 0, index: 0 }),
        snap({ id: "fast", side: "defender", spd: 9, atk: 0, index: 0 }),
        snap({ id: "mid", side: "attacker", spd: 4, atk: 0, index: 0 }),
      ]),
    )
    expect(state.order).toEqual(["fast", "mid", "slow"])
  })

  test("E equal spd lets the attacker act first", () => {
    const state = resolveTurn(
      fight([
        snap({ id: "d", side: "defender", spd: 10, atk: 0, index: 0 }),
        snap({ id: "a", side: "attacker", spd: 10, atk: 0, index: 9 }),
      ]),
    )
    expect(state.order?.[0]).toBe("a")
  })

  test("E the same side and spd follow formation index", () => {
    const state = resolveTurn(
      fight([
        snap({ id: "late", side: "attacker", spd: 5, atk: 0, index: 2 }),
        snap({ id: "early", side: "attacker", spd: 5, atk: 0, index: 0 }),
        snap({ id: "mid", side: "attacker", spd: 5, atk: 0, index: 1 }),
        snap({ id: "foe", side: "defender", spd: 1, atk: 0, index: 0 }),
      ]),
    )
    expect(state.order).toEqual(["early", "mid", "late", "foe"])
  })

  test("E a unit that dies is removed from the rest of the turn", () => {
    const start = fight([
      snap({ id: "killer", side: "attacker", spd: 40, atk: 500, hp: 80, index: 0 }),
      snap({ id: "victim", side: "defender", spd: 30, atk: 500, hp: 10, index: 0 }),
      snap({ id: "other", side: "defender", spd: 20, atk: 0, hp: 80, index: 1 }),
      snap({ id: "tail", side: "attacker", spd: 10, atk: 0, hp: 80, index: 1 }),
    ])
    const first = resolveTurn(start)
    expect(first.order).toEqual(["killer", "other", "tail"])
    expect(first.units.find((unit) => unit.id === "victim")?.hp).toBe(0)
    expect(first.units.find((unit) => unit.id === "killer")?.hp).toBe(80)
    expect(first.units.find((unit) => unit.id === "other")?.hp).toBe(80)
    const second = resolveTurn(first)
    expect(second.turn).toBe(2)
    expect(second.order).not.toContain("victim")
    expect(start.units.find((unit) => unit.id === "victim")?.hp).toBe(10)
  })
})

describe("v4.0 F outcome", () => {
  test("F a wiped side loses", () => {
    const attackerWins = resolveBattle(
      fight([
        snap({ id: "a", side: "attacker", spd: 5, atk: 1000, hp: 500 }),
        snap({ id: "d", side: "defender", spd: 1, atk: 0, hp: 100 }),
      ]),
    )
    expect(attackerWins).toEqual({ winner: "attacker", turns: 1, reason: "wipe" })

    const defenderWins = resolveBattle(
      fight([
        snap({ id: "a", side: "attacker", spd: 1, atk: 0, hp: 100 }),
        snap({ id: "d", side: "defender", spd: 5, atk: 1000, hp: 500 }),
      ]),
    )
    expect(defenderWins).toEqual({ winner: "defender", turns: 1, reason: "wipe" })
  })

  test("F turn 15 with both sides alive is an attacker loss", () => {
    const result = resolveBattle(
      fight([
        snap({ id: "a", side: "attacker", atk: 0, hp: 20, spd: 2 }),
        snap({ id: "d", side: "defender", atk: 0, hp: 20, spd: 1 }),
      ]),
    )
    expect(result.turns).toBe(15)
    expect(result.winner).toBe("defender")
    expect(result.reason).toBe("attacker-lose")
  })

  test("F turn 14 does not end the battle", () => {
    let state = fight([
      snap({ id: "a", side: "attacker", atk: 0, hp: 20, spd: 2 }),
      snap({ id: "d", side: "defender", atk: 0, hp: 20, spd: 1 }),
    ])
    for (let n = 0; n < 14; n += 1) state = resolveTurn(state)
    expect(state.turn).toBe(14)
    expect(state.units.every((unit) => unit.hp > 0)).toBe(true)
    const continued = resolveBattle(state)
    expect(continued.turns).toBe(15)
    expect(continued.winner).toBe("defender")
    expect(continued.reason).toBe("attacker-lose")
  })

  test("F a mutual wipe in the same turn is a defender win", () => {
    const result = resolveBattle(
      fight([
        snap({ id: "a", side: "attacker", spd: 10, atk: 1000, hp: 100 }),
        snap({ id: "d", side: "defender", spd: 1, atk: 1000, hp: 100 }),
      ]),
    )
    expect(result).toEqual({ winner: "defender", turns: 1, reason: "mutual-wipe" })
  })

  test("F turns counts the turn that actually ends the fight", () => {
    const result = resolveBattle(
      fight([
        snap({ id: "a", side: "attacker", spd: 3, atk: 100, hp: 900 }),
        snap({ id: "d", side: "defender", spd: 1, atk: 0, hp: 250 }),
      ]),
    )
    expect(result).toEqual({ winner: "attacker", turns: 3, reason: "wipe" })
  })
})

describe("v4.0 G bounds", () => {
  test("G negative damage clamps to 0", () => {
    const atk = 4
    const defense = 100
    const raw = (atk * 1.25 - defense) * 1
    expect(raw).toBe(-95)
    expect(Math.floor(raw)).toBeLessThan(0)
    expect(calcDamage(snap({ id: "dao", atk, side: "attacker" }), snap({ id: "ji", def: defense, side: "defender" }))).toBe(0)
    expect(calcDamage(snap({ id: "a", atk: 0, side: "attacker" }), snap({ id: "d", def: 25, side: "defender" }))).toBe(0)
  })

  test("G overkill is discarded", () => {
    const state = resolveTurn(
      fight([
        snap({ id: "a", side: "attacker", spd: 5, atk: 500, hp: 100, index: 0 }),
        snap({ id: "d1", side: "defender", spd: 1, def: 0, hp: 40, index: 0 }),
        snap({ id: "d2", side: "defender", spd: 1, def: 0, hp: 40, index: 1 }),
      ]),
    )
    expect(state.units.find((unit) => unit.id === "d1")?.hp).toBe(0)
    expect(state.units.find((unit) => unit.id === "d2")?.hp).toBe(40)
  })

  test("G a huge atk does not wrap", () => {
    const atk = Number.MAX_SAFE_INTEGER
    expect(atk).toBeGreaterThan(2_147_483_647)
    const damage = calcDamage(snap({ id: "big", atk, side: "attacker" }), snap({ id: "z", def: 0, side: "defender" }))
    expect(damage).toBe(atk)
  })

  test("G defense above the attack value deals 0", () => {
    const damage = calcDamage(snap({ id: "a", atk: 80, side: "attacker" }), snap({ id: "d", def: 81, side: "defender" }))
    expect(damage).toBe(0)
  })
})

describe("grid slice kept from the first combat tests", () => {
  test("balance.json holds the v4.0 tunables", () => {
    expect(balance).toEqual({
      HERO_COEF: 0.001,
      COUNTER_MULT: 1.25,
      COUNTER_WEAK: 0.8,
      DMG_FLOOR: 0,
      TURN_LIMIT: 15,
    })
    expect(Object.keys(balance)).toEqual(["HERO_COEF", "COUNTER_MULT", "COUNTER_WEAK", "DMG_FLOOR", "TURN_LIMIT"])
  })

  test("live unit table keeps defense above zero", () => {
    for (const row of Object.values(catalog.units)) {
      expect(row.def).toBeGreaterThan(0)
    }
  })

  test("grid slice A1 1620 archers atk 2.0, no general, no advantage, fixture DEF 0 → 3240", () => {
    const damage = hit({
      atk: 2,
      def: 0,
      count: 1620,
      attackerType: "bow",
      defenderType: "blade",
    })
    expect(damage).toBe(3240)
  })

  test("grid slice A2 560 scholars atk 10.0, no general, no advantage, fixture DEF 0 → 5600", () => {
    const damage = hit({
      atk: 10,
      def: 0,
      count: 560,
      attackerType: "scholar",
      defenderType: "shield",
    })
    expect(damage).toBe(5600)
  })

  test("grid slice A3 skill attribute 400, coefficient 7.5 → 3000 within 1%", () => {
    const damage = skillDamage(7.5, 400, null)
    expectNear(damage, 3000, 0.01)
  })

  test("grid slice A4 tower floor 10, 840 archers × 10 HP → total HP 8400", () => {
    expect(stackTotalHp(840, 10)).toBe(8400)
  })

  test("grid slice A5 general atk 70 versus 8400 HP clears in at most 2 turns at 4374 per turn", () => {
    const damage = hit({
      atk: 2,
      def: 0,
      count: 1620,
      attackerType: "bow",
      defenderType: "blade",
      attackerGeneral: general({ atk: 70, def: 40 }),
    })
    expect(damage).toBe(4374)
    expect(8400 / damage).toBeCloseTo(1.92, 2)
    expect(turnsToClear(8400, damage)).toBeLessThanOrEqual(2)
    expect(lossesFromDamage(damage, 10)).toBe(437)
  })

  test("negative base damage on the grid slice clamps to 0, with or without attack aura", () => {
    const plain = hit({ atk: 1.4, def: 3, count: 20, attackerType: "shield", defenderType: "shield" })
    const aura = calculateDamage({
      atk: 1.4,
      def: 3,
      count: 20,
      attackerType: "shield",
      defenderType: "shield",
      attackerGeneral: general({ atk: 70 }),
      defenderGeneral: null,
      retaliation: false,
    })
    expect(plain).toBe(0)
    expect(aura).toBe(0)
  })

  test("retaliation uses the same formula with advantage forced to 1, once per unit per turn", () => {
    const bow = squad({
      id: "bow",
      side: "attacker",
      type: "bow",
      atk: 10,
      def: 3,
      count: 20,
      hpPer: 1000,
      hp: 20000,
      x: 0,
      y: 0,
      seq: 0,
    })
    const scholar = squad({
      id: "scholar",
      side: "defender",
      type: "scholar",
      atk: 8,
      def: 4,
      count: 20,
      hpPer: 1000,
      hp: 20000,
      x: 1,
      y: 0,
      seq: 1,
    })
    const state = step(createBattle([bow, scholar]))
    expect(state.log.find((event) => event.kind === "attack")).toMatchObject({ damage: 80 })
    expect(state.log.find((event) => event.kind === "retaliation")).toMatchObject({ damage: 100 })

    const bladeA = squad({ id: "a", side: "attacker", type: "blade", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 0, y: 0, seq: 0 })
    const bladeB = squad({ id: "b", side: "attacker", type: "blade", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 0, y: 2, seq: 1 })
    const shield = squad({ id: "s", side: "defender", type: "shield", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 1, y: 1, seq: 2 })
    const second = step(step(createBattle([bladeA, bladeB, shield])))
    expect(second.log.filter((event) => event.kind === "retaliation")).toHaveLength(1)
    expect(second.squads.find((unit) => unit.id === "b")?.hp).toBe(500)
  })

  test("grid initiative order is cavalry, blade, beast, bow, scholar, halberd, shield", () => {
    expect(SPEED).toEqual({
      cavalry: 7,
      blade: 6,
      beast: 6,
      bow: 4,
      scholar: 4,
      halberd: 4,
      shield: 3,
    })
    const ordered = initiativeOrder([
      { type: "shield" as const, seq: 1, id: "shield" },
      { type: "halberd" as const, seq: 1, id: "halberd" },
      { type: "scholar" as const, seq: 4, id: "scholar-late" },
      { type: "bow" as const, seq: 1, id: "bow" },
      { type: "beast" as const, seq: 1, id: "beast" },
      { type: "blade" as const, seq: 9, id: "blade-late" },
      { type: "blade" as const, seq: 2, id: "blade-early" },
      { type: "cavalry" as const, seq: 8, id: "cavalry" },
      { type: "scholar" as const, seq: 1, id: "scholar-early" },
    ])
    expect(ordered.map((unit) => unit.id)).toEqual([
      "cavalry",
      "blade-early",
      "blade-late",
      "beast",
      "bow",
      "scholar-early",
      "scholar-late",
      "halberd",
      "shield",
    ])
  })

  test("fifteen grid turns still unresolved is an attacker loss", () => {
    const attacker = squad({
      id: "shield",
      side: "attacker",
      type: "shield",
      atk: 1,
      def: 100,
      count: 10,
      hp: 1000,
      hpPer: 100,
      x: 0,
      y: 0,
    })
    const defender = squad({
      id: "blade",
      side: "defender",
      type: "blade",
      atk: 1,
      def: 100,
      count: 10,
      hp: 400,
      hpPer: 40,
      x: 1,
      y: 0,
      seq: 1,
    })
    const stalled = runBattle(createBattle([attacker, defender]))
    expect(stalled.reason).toBe("turn-limit")
    expect(stalled.turn).toBe(15)
    expect(sideHp(stalled.squads, "attacker")).toBe(1000)
    expect(sideHp(stalled.squads, "defender")).toBe(400)
    expect(stalled.winner).toBe("defender")
  })

  test("grid is 12 by 8 and a general does not take a cell or a roster slot", () => {
    expect(GRID_COLS).toBe(12)
    expect(GRID_ROWS).toBe(8)
    const placed = placeSquad([], { id: "a", x: 0, y: 0 })
    expect(placed.ok).toBe(true)
    if (!placed.ok) return
    expect(placeSquad(placed.units, { id: "b", x: 0, y: 0 })).toMatchObject({ ok: false, reason: "occupied" })
    expect(placeSquad([], { id: "c", x: 12, y: 0 })).toMatchObject({ ok: false, reason: "out-of-bounds" })
    const roster = [squad({ id: "a", side: "attacker", type: "blade", general: general({ id: "mo", name: "墨翟" }) })]
    expect(roster).toHaveLength(1)
    expect(occupancy(roster).size).toBe(1)
  })

  test("art manifest keeps a stable slot for every unit, the aura, the board, and chrome", () => {
    const keys = allArtSlots().map((entry) => entry.key)
    expect(keys).toEqual([
      "unit.cavalry",
      "unit.blade",
      "unit.halberd",
      "unit.bow",
      "unit.shield",
      "unit.scholar",
      "unit.beast",
      "marker.general-aura",
      "board.ground",
      "chrome.initiative",
      "chrome.hp",
      "chrome.buttons",
      "chrome.log",
    ])
    for (const entry of allArtSlots()) expect(entry.status).toBe("placeholder")
  })

  test("sandbox squads keep positive defense and open on cavalry", () => {
    const scenario = createScenario()
    for (const unit of scenario) expect(unit.def).toBeGreaterThan(0)
    const first = runBattle(createBattle(scenario))
    const opening = first.log[0]
    if (!opening || opening.kind === "turn-limit") throw new Error("沙盒第一筆戰報不是部隊行動")
    expect(opening.actorId).toBe("mo-cavalry")
    expect(first.phase).toBe("done")
  })
})

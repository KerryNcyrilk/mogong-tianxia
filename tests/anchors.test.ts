import { describe, expect, test } from "vitest"
import { balance } from "../src/combat/balance.ts"
import { createBattle, runBattle, sideHp, step } from "../src/combat/battle.ts"
import { COUNTER_TARGET } from "../src/combat/counter.ts"
import {
  calculateDamage,
  lossesFromDamage,
  skillDamage,
  stackTotalHp,
  turnsToClear,
} from "../src/combat/damage.ts"
import { GRID_COLS, GRID_ROWS, occupancy, placeSquad } from "../src/combat/grid.ts"
import { SPEED, initiativeOrder } from "../src/combat/initiative.ts"
import type { General, Squad, UnitType } from "../src/combat/types.ts"
import { allArtSlots } from "../src/art/manifest.ts"
import catalog from "../data/units.json" with { type: "json" }
import { createScenario } from "../src/sandbox/scenario.ts"

const REL_5 = 0.05

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

describe("balance.json", () => {
  test("holds exactly the four locked tunables", () => {
    expect(balance).toEqual({
      HERO_COEF: 0.001,
      COUNTER_MULT: 1.3,
      DMG_FLOOR: 0.1,
      TURN_LIMIT: 15,
    })
    expect(Object.keys(balance)).toEqual(["HERO_COEF", "COUNTER_MULT", "DMG_FLOOR", "TURN_LIMIT"])
  })

  test("live unit table keeps defense above zero", () => {
    for (const row of Object.values(catalog.units)) {
      expect(row.def).toBeGreaterThan(0)
    }
  })
})

describe("A group", () => {
  test("A1 1620 archers atk 2.0, no general, no advantage, fixture DEF 0 → 3240", () => {
    const damage = hit({
      atk: 2,
      def: 0,
      count: 1620,
      attackerType: "bow",
      defenderType: "blade",
    })
    expect(damage).toBe(3240)
  })

  test("A2 560 scholars atk 10.0, no general, no advantage, fixture DEF 0 → 5600", () => {
    const damage = hit({
      atk: 10,
      def: 0,
      count: 560,
      attackerType: "scholar",
      defenderType: "shield",
    })
    expect(damage).toBe(5600)
  })

  test("A3 skill attribute 400, coefficient 7.5 → 3000 within 1%", () => {
    const damage = skillDamage(7.5, 400, null)
    expectNear(damage, 3000, 0.01)
  })

  test("A4 tower floor 10, 840 archers × 10 HP → total HP 8400", () => {
    expect(stackTotalHp(840, 10)).toBe(8400)
  })

  test("A5 A1 plus general atk 70 versus 8400 HP clears in at most 2 turns at 4374 per turn", () => {
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
})

describe("E group", () => {
  // v3.2 §1. One shape for every case. def 0 is a fixture, not a unit-table rule.
  // 神獸 is outside the cycle: COUNTER_TARGET.beast is null, and nothing counters beast.
  const N = 100
  const atk = 2
  const hp = 1000
  const neutral = "beast" as const

  function finalDamage(attacker: UnitType, defender: UnitType) {
    return calculateDamage({
      atk,
      def: 0,
      count: N,
      attackerType: attacker,
      defenderType: defender,
      attackerGeneral: null,
      defenderGeneral: null,
      retaliation: false,
    })
  }

  function damageRatio(attacker: UnitType, targetA: UnitType, targetB: UnitType) {
    const left = {
      attacker,
      count: N,
      hp,
      def: 0 as const,
      aura: false,
      skill: false,
      retaliation: false,
      type: targetA,
    }
    const right = { ...left, type: targetB }
    expect(left.count).toBe(right.count)
    expect(left.hp).toBe(right.hp)
    expect(left.def).toBe(0)
    expect(right.def).toBe(0)
    expect(COUNTER_TARGET.beast).toBeNull()
    expect(COUNTER_TARGET[attacker]).not.toBe(neutral)
    expect(Object.values(COUNTER_TARGET)).not.toContain(neutral)
    return finalDamage(attacker, targetA) / finalDamage(attacker, targetB)
  }

  test("E1 halberd vs cavalry over halberd vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.halberd).toBe("cavalry")
    expectNear(damageRatio("halberd", "cavalry", neutral), 1.3, REL_5)
  })

  test("E2 scholar vs bow over scholar vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.scholar).toBe("bow")
    expectNear(damageRatio("scholar", "bow", neutral), 1.3, REL_5)
  })

  test("E3 cavalry vs scholar over cavalry vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.cavalry).toBe("scholar")
    expectNear(damageRatio("cavalry", "scholar", neutral), 1.3, REL_5)
  })

  test("E4 bow vs shield over bow vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.bow).toBe("shield")
    expectNear(damageRatio("bow", "shield", neutral), 1.3, REL_5)
  })

  test("E5 shield vs blade over shield vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.shield).toBe("blade")
    expectNear(damageRatio("shield", "blade", neutral), 1.3, REL_5)
  })

  test("E6 blade vs halberd over blade vs neutral is 1.3×", () => {
    expect(COUNTER_TARGET.blade).toBe("halberd")
    expectNear(damageRatio("blade", "halberd", neutral), 1.3, REL_5)
  })

  test("E7 bow vs scholar over bow vs neutral is 1.0; 1.3 is P0", () => {
    expect(COUNTER_TARGET.bow).not.toBe("scholar")
    const ratio = damageRatio("bow", "scholar", neutral)
    expect(ratio).toBe(1)
    expect(Math.abs(ratio - 1.3) / 1.3).toBeGreaterThan(REL_5)
  })

  test("E8 scholar vs shield over scholar vs neutral is 1.0; 1.3 is P0", () => {
    expect(COUNTER_TARGET.scholar).not.toBe("shield")
    const ratio = damageRatio("scholar", "shield", neutral)
    expect(ratio).toBe(1)
    expect(Math.abs(ratio - 1.3) / 1.3).toBeGreaterThan(REL_5)
  })
})

describe("rules outside A and E ids", () => {
  test("counter table is the one-way cycle and beasts sit outside it", () => {
    expect(COUNTER_TARGET).toEqual({
      scholar: "bow",
      bow: "shield",
      shield: "blade",
      blade: "halberd",
      halberd: "cavalry",
      cavalry: "scholar",
      beast: null,
    })
    for (const attacker of Object.keys(COUNTER_TARGET) as UnitType[]) {
      const defender = COUNTER_TARGET[attacker]
      if (!defender) continue
      expect(COUNTER_TARGET[defender]).not.toBe(attacker)
    }
  })

  test("shield versus shield stays on the 0.1 floor, with or without attack aura", () => {
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
    expect(plain).toBe(2)
    expect(aura).toBe(2)
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
    expect(state.log.find((event) => event.kind === "attack")).toMatchObject({ damage: 120 })
    expect(state.log.find((event) => event.kind === "retaliation")).toMatchObject({ damage: 100 })

    const bladeA = squad({ id: "a", side: "attacker", type: "blade", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 0, y: 0, seq: 0 })
    const bladeB = squad({ id: "b", side: "attacker", type: "blade", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 0, y: 2, seq: 1 })
    const shield = squad({ id: "s", side: "defender", type: "shield", atk: 5, def: 5, count: 10, hp: 500, hpPer: 50, x: 1, y: 1, seq: 2 })
    const second = step(step(createBattle([bladeA, bladeB, shield])))
    expect(second.log.filter((event) => event.kind === "retaliation")).toHaveLength(1)
    expect(second.squads.find((unit) => unit.id === "b")?.hp).toBe(500)
  })

  test("initiative order is cavalry, blade, beast, bow, scholar, halberd, shield", () => {
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

  test("fifteen turns compare remaining total HP", () => {
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
    expect(sideHp(stalled.squads, "attacker")).toBe(970)
    expect(sideHp(stalled.squads, "defender")).toBe(370)
    expect(stalled.winner).toBe("attacker")
  })

  test("grid is 12 by 8 and a general does not take a cell or a roster slot", () => {
    expect(GRID_COLS).toBe(12)
    expect(GRID_ROWS).toBe(8)
    const placed = placeSquad([], { id: "a", x: 0, y: 0 })
    expect(placed.ok).toBe(true)
    if (!placed.ok) return
    expect(placeSquad(placed.units, { id: "b", x: 0, y: 0 })).toMatchObject({ ok: false, reason: "occupied" })
    expect(placeSquad([], { id: "c", x: 12, y: 0 })).toMatchObject({ ok: false, reason: "out-of-bounds" })
    const roster = [
      squad({ id: "a", side: "attacker", type: "blade", general: general({ id: "mo", name: "墨翟" }) }),
    ]
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

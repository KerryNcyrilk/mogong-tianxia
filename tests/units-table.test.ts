import { describe, expect, test } from "vitest"
import { COMBAT_FIELDS } from "../src/combat/catalog.ts"
import { COUNTER_PAIRS, COUNTER_TARGET, counterMultiplier } from "../src/combat/counter.ts"
import { calculateDamage } from "../src/combat/damage.ts"
import { SPEED } from "../src/combat/initiative.ts"
import type { UnitType } from "../src/combat/types.ts"
import catalog from "../data/units.json" with { type: "json" }

const RING = [
  ["scholar", "bow"],
  ["bow", "shield"],
  ["shield", "blade"],
  ["blade", "halberd"],
  ["halberd", "cavalry"],
  ["cavalry", "scholar"],
] as const

const IDENTITY = ["id", "name", "tier"] as const

function edge(pair: { attacker: string; defender: string }): string {
  return `${pair.attacker}->${pair.defender}`
}

describe("units.json B1 table", () => {
  test("holds 11 slots and 3 targets, with six combat fields on every row", () => {
    const live = Object.values(catalog.units)
    const slots = [...live, ...catalog.pendingUnits]
    expect(live).toHaveLength(7)
    expect(catalog.pendingUnits).toHaveLength(4)
    expect(slots).toHaveLength(11)
    expect(catalog.targets).toHaveLength(3)
    for (const row of [...slots, ...catalog.targets]) {
      for (const key of IDENTITY) expect(row).toHaveProperty(key)
      for (const key of COMBAT_FIELDS) expect(row).toHaveProperty(key)
      for (const key of COMBAT_FIELDS) expect(row.source).toHaveProperty(key)
    }
  })

  test("counter set is the six-edge ring, expanded to 12 directed pairs", () => {
    expect(catalog.counter).toHaveLength(12)
    const counters = catalog.counter.filter((pair) => pair.relation === "counters")
    const countered = catalog.counter.filter((pair) => pair.relation === "countered-by")
    expect(counters.map(edge).sort()).toEqual(RING.map((pair) => pair.join("->")).sort())
    expect(countered.map(edge).sort()).toEqual(RING.map(([attacker, defender]) => `${defender}->${attacker}`).sort())
    expect(new Set(catalog.counter.map(edge)).size).toBe(12)
  })

  test("every TARGET-* fixture has def 0 and tier test", () => {
    expect(catalog.targets.map((row) => row.id)).toEqual(["TARGET-A1", "TARGET-A2", "TARGET-A5"])
    for (const row of catalog.targets) {
      expect(row.id.startsWith("TARGET-")).toBe(true)
      expect(row.def).toBe(0)
      expect(row.tier).toBe("test")
      expect(row.source.def).toBe("fixture-def-0")
    }
  })

  test("live speeds are the table values and pending combat numbers stay unset", () => {
    for (const [id, row] of Object.entries(catalog.units)) {
      expect(SPEED[id as UnitType]).toBe(row.spd)
      expect(row.def).toBeGreaterThan(0)
    }
    for (const row of catalog.pendingUnits) {
      for (const key of COMBAT_FIELDS) {
        expect(row[key]).toBeNull()
        expect(row.source[key]).toBe("pending-14.7")
      }
    }
  })
})

describe("counter pairs from the table", () => {
  test("all 12 directed pairs match the one-way multiplier", () => {
    expect(COUNTER_PAIRS).toHaveLength(12)
    const atk = 2
    const count = 100
    for (const pair of COUNTER_PAIRS) {
      const expected = pair.relation === "counters" ? 1.3 : 1
      expect(counterMultiplier(pair.attacker, pair.defender, false)).toBe(expected)
      const damage = calculateDamage({
        atk,
        def: 0,
        count,
        attackerType: pair.attacker,
        defenderType: pair.defender,
        attackerGeneral: null,
        defenderGeneral: null,
        retaliation: false,
      })
      expect(damage).toBe(atk * count * expected)
    }
    expect(COUNTER_TARGET).toEqual({
      scholar: "bow",
      bow: "shield",
      shield: "blade",
      blade: "halberd",
      halberd: "cavalry",
      cavalry: "scholar",
      beast: null,
    })
  })
})

describe("target def 0 damage", () => {
  test("TARGET-A5 def 0 keeps the A5 anchor at 4374", () => {
    const target = catalog.targets.find((row) => row.id === "TARGET-A5")
    expect(target?.def).toBe(0)
    const count = 1620
    const atk = 2
    const generalAtk = 70
    const theoretical = atk * (1 + generalAtk / 200) * count - (target?.def ?? 1) * count
    const damage = calculateDamage({
      atk,
      def: target?.def ?? 1,
      count,
      attackerType: "bow",
      defenderType: "blade",
      attackerGeneral: { id: "fixture-general", name: "夾具", atk: generalAtk, def: 40 },
      defenderGeneral: null,
      retaliation: false,
    })
    expect(theoretical).toBe(4374)
    expect(damage).toBe(4374)
    expect(damage).toBe(theoretical)
  })

  test("each zero-def target makes damage equal the def-0 theoretical value", () => {
    const cases = [
      { id: "TARGET-A1", atk: 2, count: 1620, attackerType: "bow" as const, defenderType: "blade" as const, generalAtk: 0, expected: 3240 },
      { id: "TARGET-A2", atk: 10, count: 560, attackerType: "scholar" as const, defenderType: "shield" as const, generalAtk: 0, expected: 5600 },
      { id: "TARGET-A5", atk: 2, count: 1620, attackerType: "bow" as const, defenderType: "blade" as const, generalAtk: 70, expected: 4374 },
    ]
    for (const item of cases) {
      const target = catalog.targets.find((row) => row.id === item.id)
      expect(target?.def).toBe(0)
      const atkPrime = item.atk * (1 + item.generalAtk / 200)
      const theoretical = atkPrime * item.count * 1 - (target?.def ?? 1) * item.count
      const damage = calculateDamage({
        atk: item.atk,
        def: target?.def ?? 1,
        count: item.count,
        attackerType: item.attackerType,
        defenderType: item.defenderType,
        attackerGeneral: item.generalAtk === 0 ? null : { id: "fixture-general", name: "夾具", atk: item.generalAtk, def: 40 },
        defenderGeneral: null,
        retaliation: false,
      })
      expect(damage).toBe(item.expected)
      expect(damage).toBe(theoretical)
    }
  })
})

import { describe, expect, test } from "vitest"
import { balance } from "../src/combat/balance.ts"
import { COMBAT_FIELDS } from "../src/combat/catalog.ts"
import { COUNTER_PAIRS, canonicalUnitId } from "../src/combat/counter.ts"
import catalog from "../data/units.json" with { type: "json" }

const IDENTITY = ["id", "name", "tier"] as const

const UNITS = [
  ["dao", "刀兵", "base", 420, 260, 60, 1, 1000],
  ["ji", "戟兵", "base", 380, 320, 55, 2, 1100],
  ["gong", "弓兵", "base", 460, 180, 65, 4, 800],
  ["dun", "盾兵", "base", 240, 480, 45, 1, 1400],
  ["qi", "騎兵", "base", 520, 300, 90, 2, 1200],
  ["xuezhe", "學者", "base", 500, 200, 70, 3, 700],
  ["rui-dao", "銳刀", "elite", 630, 340, 60, 1, 1200],
  ["chang-ji", "長戟衛", "elite", 570, 420, 55, 2, 1320],
  ["qiang-nu", "強弩", "elite", 690, 235, 65, 5, 960],
  ["tie-dun", "鐵盾", "elite", 360, 625, 45, 1, 1680],
  ["zhong-qi", "重騎", "elite", 780, 390, 90, 2, 1440],
] as const

describe("v4.0 H data", () => {
  test("H1 11 units are complete and the empty slots are gone", () => {
    expect(catalog.units).toHaveLength(11)
    expect(catalog.units.filter((row) => row.tier === "base")).toHaveLength(6)
    expect(catalog.units.filter((row) => row.tier === "elite")).toHaveLength(5)
    expect("pendingUnits" in catalog).toBe(false)
    expect(JSON.stringify(catalog).includes("pending")).toBe(false)
    expect(catalog.units.map((row) => row.name)).not.toContain("神獸")
    expect(catalog.units.filter((row) => row.id === "xuezhe" || catalog.aliases[row.id as keyof typeof catalog.aliases] === "xuezhe")).toHaveLength(1)
    const text = JSON.stringify(catalog)
    for (const retired of ["cavalry", "blade", "beast", "bow", "scholar", "halberd", "shield"]) {
      expect(text.includes(retired)).toBe(false)
    }
    expect(catalog.units.map((row) => [row.id, row.name, row.tier, row.atk, row.def, row.spd, row.range, row.hp])).toEqual(
      UNITS.map((row) => [...row]),
    )
    for (const row of catalog.units) {
      for (const key of IDENTITY) expect(row[key]).not.toEqual("")
      for (const key of COMBAT_FIELDS) {
        expect(typeof row[key]).toBe("number")
        expect(Number.isFinite(row[key])).toBe(true)
      }
      expect(row.def).toBeGreaterThan(0)
      expect(row.hp).toBeGreaterThan(0)
    }
  })

  test("H2 counter set is the twelve directed pairs", () => {
    expect(catalog.counters).toHaveLength(12)
    expect(COUNTER_PAIRS).toEqual(catalog.counters)
    const advantage = catalog.counters.filter((pair) => pair.mult === balance.COUNTER_MULT)
    const reverse = catalog.counters.filter((pair) => pair.mult === balance.COUNTER_WEAK)
    expect(advantage).toHaveLength(6)
    expect(reverse).toHaveLength(6)
    expect(advantage.map((pair) => pair.mult)).toEqual([1.25, 1.25, 1.25, 1.25, 1.25, 1.25])
    expect(reverse.map((pair) => pair.mult)).toEqual([0.8, 0.8, 0.8, 0.8, 0.8, 0.8])
    expect(catalog.counters).toEqual([
      { attacker: "xuezhe", defender: "gong", mult: 1.25 },
      { attacker: "gong", defender: "dun", mult: 1.25 },
      { attacker: "dun", defender: "dao", mult: 1.25 },
      { attacker: "dao", defender: "ji", mult: 1.25 },
      { attacker: "ji", defender: "qi", mult: 1.25 },
      { attacker: "qi", defender: "xuezhe", mult: 1.25 },
      { attacker: "gong", defender: "xuezhe", mult: 0.8 },
      { attacker: "dun", defender: "gong", mult: 0.8 },
      { attacker: "dao", defender: "dun", mult: 0.8 },
      { attacker: "ji", defender: "dao", mult: 0.8 },
      { attacker: "qi", defender: "ji", mult: 0.8 },
      { attacker: "xuezhe", defender: "qi", mult: 0.8 },
    ])
    expect(new Set(catalog.counters.map((pair) => `${pair.attacker}->${pair.defender}`)).size).toBe(12)
  })

  test("H3 three targets have def 0 and A5 atk is 5832", () => {
    expect(catalog.targets).toHaveLength(3)
    expect(catalog.targets.map((row) => row.id)).toEqual(["TARGET-A1", "TARGET-A2", "TARGET-A5"])
    for (const row of catalog.targets) expect(row.def).toBe(0)
    expect(catalog.targets.map((row) => [row.id, row.atk, row.def, row.hp])).toEqual([
      ["TARGET-A1", 1000, 0, 99999],
      ["TARGET-A2", 1000, 0, 99999],
      ["TARGET-A5", 5832, 0, 99999],
    ])
  })

  test("H4 schema, formula, turn cap, and elite aliases are present", () => {
    expect(catalog.schemaVersion).toBe("units.v4.0")
    expect(catalog.formula).toEqual({
      type: "linear-sub-def",
      rounding: "floor",
      minDamage: 0,
      defaultMorale: 1,
    })
    expect(catalog.turnLimit).toBe(15)
    expect(catalog.turnLimitResult).toBe("attacker-lose")
    expect(catalog.aliases).toEqual({
      "rui-dao": "dao",
      "chang-ji": "ji",
      "qiang-nu": "gong",
      "tie-dun": "dun",
      "zhong-qi": "qi",
    })
    expect(canonicalUnitId("rui-dao")).toBe("dao")
    expect(canonicalUnitId("chang-ji")).toBe("ji")
    expect(canonicalUnitId("qiang-nu")).toBe("gong")
    expect(canonicalUnitId("tie-dun")).toBe("dun")
    expect(canonicalUnitId("zhong-qi")).toBe("qi")
    expect(canonicalUnitId("xuezhe")).toBe("xuezhe")
    expect(canonicalUnitId("dao")).toBe("dao")
    for (const row of catalog.units) {
      for (const key of [...IDENTITY, ...COMBAT_FIELDS]) expect(row).toHaveProperty(key)
    }
    for (const row of catalog.targets) {
      expect(row).toHaveProperty("id")
      expect(row).toHaveProperty("atk")
      expect(row).toHaveProperty("def")
      expect(row).toHaveProperty("hp")
    }
  })
})

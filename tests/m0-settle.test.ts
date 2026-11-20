import { describe, expect, test } from "vitest"
import { orderBySpeedThenId, roundFinalDamage, unfinishedAttackerLoses } from "../src/m0/defaults.ts"
import { parseSave, serializeSave } from "../src/m0/save.ts"
import { HOUR_MS, settle, settleHours, type SaveState } from "../src/m0/settle.ts"

function save(partial: Pick<SaveState, "resources" | "producers" | "consumers">): SaveState {
  return { schemaVersion: "m0.1", ...partial }
}

const manual = save({
  resources: { food: 5 },
  producers: [{ id: "farm", perHour: { food: 4 } }],
  consumers: [{ id: "camp", perHour: { food: 1 } }],
})

describe("M0 settle", () => {
  test("same input returns the same output and does not read the clock", () => {
    const now = Date.now
    const random = Math.random
    Date.now = () => {
      throw new Error("clock")
    }
    Math.random = () => {
      throw new Error("random")
    }
    try {
      const first = settleHours(manual, 13)
      const second = settleHours(manual, 13)
      expect(first).toEqual(second)
      expect(manual.resources.food).toBe(5)
      expect(first.resources).not.toBe(manual.resources)
    } finally {
      Date.now = now
      Math.random = random
    }
  })

  test("exactly 12 hours is not capped; time past the cap is ignored", () => {
    const atCap = settle(manual, 12 * HOUR_MS)
    const pastCap = settle(manual, 13 * HOUR_MS)
    expect(atCap.capped).toBe(false)
    expect(atCap.appliedHours).toBe(12)
    expect(atCap.resources.food).toBe(5 + 4 * 12 - 1 * 12)
    expect(pastCap.capped).toBe(true)
    expect(pastCap.appliedMs).toBe(12 * HOUR_MS)
    expect(pastCap.appliedHours).toBe(12)
    expect(pastCap.resources.food).toBe(atCap.resources.food)
    expect(pastCap.resources.food).not.toBe(5 + 4 * 13 - 1 * 13)
  })

  test("produce-then-consume diverges from the reverse order when stock is short", () => {
    const short = save({
      resources: { food: 0 },
      producers: [{ id: "farm", perHour: { food: 6 } }],
      consumers: [{ id: "camp", perHour: { food: 10 } }],
    })
    const enough = save({
      resources: { food: 20 },
      producers: [{ id: "farm", perHour: { food: 6 } }],
      consumers: [{ id: "camp", perHour: { food: 10 } }],
    })
    function consumeThenProduce(food: number, produced: number, demanded: number) {
      const afterConsume = food - Math.min(Math.max(food, 0), demanded)
      return afterConsume + produced
    }
    const shortResult = settleHours(short, 1)
    expect(shortResult.resources.food).toBe(0)
    expect(consumeThenProduce(0, 6, 10)).toBe(6)
    expect(shortResult.resources.food).not.toBe(consumeThenProduce(0, 6, 10))

    const enoughResult = settleHours(enough, 1)
    expect(enoughResult.resources.food).toBe(16)
    expect(consumeThenProduce(20, 6, 10)).toBe(16)
  })

  test("manual example from t=0 to t=13h matches the 12 hour hand calculation", () => {
    const result = settleHours(manual, 13)
    const cappedHours = 12
    const hand = 5 + 4 * cappedHours - 1 * cappedHours
    expect(result.capped).toBe(true)
    expect(result.elapsedMs).toBe(13 * HOUR_MS)
    expect(result.appliedHours).toBe(cappedHours)
    expect(result.resources.food).toBe(hand)
    expect(hand).toBe(41)
  })

  test("save format is JSON schema m0.1 with LF and no CR", () => {
    const text = serializeSave(manual)
    expect(text.includes("\r")).toBe(false)
    expect(text.endsWith("\n")).toBe(true)
    expect(text.includes('"schemaVersion": "m0.1"')).toBe(true)
    const bytes = new TextEncoder().encode(text)
    expect(new TextDecoder("utf-8").decode(bytes)).toBe(text)
    expect(parseSave(text)).toEqual(manual)
  })

  test("speed ties break by smaller id, and damage rounds only at the end", () => {
    const ordered = orderBySpeedThenId([
      { id: "b", spd: 1, tag: "b" },
      { id: "a", spd: 1, tag: "a" },
      { id: "d", spd: 3, tag: "d" },
      { id: "c", spd: 3, tag: "c" },
      { id: "same", spd: 2, tag: "first" },
      { id: "same", spd: 2, tag: "second" },
    ])
    expect(ordered.map((row) => row.tag)).toEqual(["c", "d", "first", "second", "a", "b"])
    const intermediate = 1.4 * 20 * 1.35
    expect(intermediate).toBeCloseTo(37.8, 10)
    expect(intermediate).not.toBe(38)
    expect(roundFinalDamage(intermediate)).toBe(38)
  })

  test("M0 unfinished turn cap is an attacker loss and stays outside combat-core", () => {
    expect(unfinishedAttackerLoses(14)).toBeNull()
    expect(unfinishedAttackerLoses(15)).toBe("defender")
  })
})

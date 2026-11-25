import { beforeEach, describe, expect, it } from "vitest"
import { INTERNAL_CONFIG, assertConfig } from "../src/internal/config.ts"
import {
  SAVE_VERSION,
  cancel,
  capOf,
  claim,
  createState,
  deserialize,
  enqueue,
  formatResource,
  isProtected,
  rollEvents,
  serialize,
  setTax,
  tick,
} from "../src/internal/engine.ts"
import type { InternalState } from "../src/internal/types.ts"

const config = INTERNAL_CONFIG
const LONG_AGO = Date.now() - 72 * 3600 * 1000

function fresh(seed = 20261124): InternalState {
  return createState(config, LONG_AGO, seed)
}

beforeEach(() => assertConfig(config))

describe("B5 內政循環引擎", () => {
  it("GB1 tick 3600 s 的七資源增量與表一致（±1）", () => {
    const state = tick(fresh(), config, 3600)
    expect(state.resources.pop).toBeCloseTo(320 + 12, 0)
    expect(state.resources.jade).toBeCloseTo(112 + 1, 0)
    expect(state.resources.coin).toBeCloseTo(245608 + 360, 0)
    expect(state.resources.food).toBeCloseTo(51298 + 480, 0)
    expect(state.resources.wood).toBeCloseTo(51298 + 480, 0)
    expect(state.resources.iron).toBeCloseTo(51298 + 240, 0)
    expect(state.resources.stone).toBeCloseTo(51298 + 240, 0)
  })

  it("GB2 糧食到上限即停，並顯示 滿", () => {
    const state = tick(fresh(), config, 3600 * 40)
    const cap = capOf(config.resources.find((def) => def.key === "food")!)
    expect(state.resources.food).toBe(cap)
    expect(formatResource(state, config, "food")).toContain("滿")
  })

  it("GB3 並發兩個 build 只一個開工，資源各扣一次", () => {
    const base = fresh()
    const first = enqueue(base, config, "house")
    const second = enqueue(first.state, config, "farm")
    expect(first.ok && second.ok).toBe(true)
    expect(first.state.slots.filter((slot) => slot.status === "building")).toHaveLength(1)
    const coinAfter = base.resources.coin - 1200 - 900
    expect(second.state.resources.coin).toBe(coinAfter)
  })

  it("GB4 取消退還 70%，刀幣不退", () => {
    const base = fresh()
    const queued = enqueue(base, config, "house")
    const cancelled = cancel(queued.state, config, "slot_1")
    expect(cancelled.ok).toBe(true)
    expect(cancelled.refunded.wood).toBe(Math.floor(300 * config.refundPct))
    expect(cancelled.refunded.coin).toBeUndefined()
    expect(cancelled.state.resources.wood).toBe(base.resources.wood - 300 + 210)
    expect(cancelled.state.resources.coin).toBe(base.resources.coin - 1200)
  })

  it("GB5 存檔 round-trip 完整；未知版本不覆蓋", () => {
    const played = tick(setTax(fresh(), "high"), config, 600)
    const restored = deserialize(serialize(played), config)
    expect(restored?.resources).toEqual(played.resources)
    expect(restored?.tax).toBe("high")
    expect(deserialize('{"version":9,"state":{}}', config)).toBeNull()
  })

  it("GB6 固定種子 1000 h：三類事件次數落在期望 ±10%", () => {
    const state = tick(fresh(), config, 3600 * 1000)
    const rolled = rollEvents(state, config, 1000)
    const counts = rolled.events.reduce<Record<string, number>>((bag, event) => {
      bag[event.id] = (bag[event.id] ?? 0) + 1
      return bag
    }, {})
    expect(counts.harvest ?? 0).toBeGreaterThanOrEqual(36)
    expect(counts.harvest ?? 0).toBeLessThanOrEqual(44)
    expect(counts.fire ?? 0).toBeGreaterThanOrEqual(7)
    expect(counts.refugee ?? 0).toBeGreaterThanOrEqual(27)
    expect(counts.refugee ?? 0).toBeLessThanOrEqual(33)
  })

  it("新手保護 24 h 內不觸發負面事件", () => {
    const state = createState(config, Date.now(), 7)
    expect(isProtected(state, config)).toBe(true)
    const rolled = rollEvents(state, config, 24)
    expect(rolled.events.every((event) => event.id === "harvest")).toBe(true)
  })

  it("稅率只影響刀幣與民心", () => {
    const low = tick(setTax(fresh(), "low"), config, 3600)
    const high = tick(setTax(fresh(), "high"), config, 3600)
    expect(low.resources.coin).toBeLessThan(high.resources.coin)
    expect(low.resources.food).toBe(high.resources.food)
    expect(low.morale).toBe(71)
    expect(high.morale).toBe(67)
  })

  it("claim 升級後隊列可再用，時長按 1+0.15×(Lv-1)", () => {
    const state = enqueue(fresh(), config, "gov").state
    const done = tick(state, config, 345)
    expect(done.slots[0].status).toBe("done")
    const after = claim(done, "slot_1")
    expect(after.state.levels.gov).toBe(2)
    expect(after.state.slots[0].kind).toBe("")
  })
})

describe("B5 存檔格式", () => {
  it("SAVE_VERSION 固定為 1，序列化帶 version 欄", () => {
    expect(SAVE_VERSION).toBe(1)
    expect(JSON.parse(serialize(fresh())).version).toBe(1)
  })
})

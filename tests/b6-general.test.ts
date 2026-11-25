import { describe, expect, it } from "vitest"
import { applyCommand, createBoard, type BoardState } from "../src/combat/board.ts"
import type { Side, Squad, UnitType } from "../src/combat/types.ts"
import { GENERAL_CONFIG, assertGeneralConfig } from "../src/general/config.ts"
import {
  createRoster,
  deserialize,
  equip,
  expPct,
  expToNext,
  gainExp,
  recruit,
  refreshTavern,
  serialize,
  setFormation,
  statsOf,
  troopRows,
} from "../src/general/engine.ts"

const NOW = Date.UTC(2026, 10, 25, 5, 0, 0)

function roster() {
  return createRoster(GENERAL_CONFIG, NOW)
}

const TYPE: Record<string, { atk: number; def: number; spd: number; range: number; hp: number }> = {
  bow: { atk: 460, def: 180, spd: 65, range: 4, hp: 800 },
  blade: { atk: 420, def: 260, spd: 60, range: 1, hp: 1000 },
  cavalry: { atk: 520, def: 300, spd: 90, range: 2, hp: 1200 },
}

function squad(id: string, side: Side, type: UnitType, x: number, y: number, seq: number): Squad {
  const stats = TYPE[type] ?? TYPE.blade!
  return {
    id,
    side,
    type,
    atk: stats.atk,
    def: stats.def,
    count: 10,
    hp: stats.hp,
    maxHp: stats.hp,
    hpPer: stats.hp / 10,
    range: stats.range,
    move: 2,
    x,
    y,
    seq,
    general: {
      id: "g_qinwuyang",
      name: "禽滑釐",
      atk: 12,
      def: 12,
      skills: [{ id: "sk_huoji", name: "火計", range: 3, power: 1.4, cooldown: 2 }],
    },
  }
}

function board(): BoardState {
  return createBoard([squad("a1", "attacker", "bow", 0, 0, 0), squad("d1", "defender", "blade", 2, 0, 0)])
}

describe("GB6-1 配置與曲線", () => {
  it("generals.json 自檢通過，七行兵力、三格編隊", () => {
    expect(() => assertGeneralConfig()).not.toThrow()
    expect(GENERAL_CONFIG.troops.length).toBe(7)
    expect(GENERAL_CONFIG.formation.slots).toBe(3)
  })

  it("升級曲線 100 → 135 → 182", () => {
    expect(expToNext(1, GENERAL_CONFIG)).toBe(100)
    expect(expToNext(2, GENERAL_CONFIG)).toBe(135)
    expect(expToNext(3, GENERAL_CONFIG)).toBe(182)
  })

  it("單次升級：滿 100 經驗升 1 級、餘 0", () => {
    const next = gainExp(roster(), "g_mozi", 100, GENERAL_CONFIG)
    const record = next.state.generals.find((item) => item.id === "g_mozi")
    expect(next.levels).toBe(1)
    expect(record?.level).toBe(2)
    expect(record?.exp).toBe(0)
  })

  it("跨級：餵 300 經驗可連升 2 級", () => {
    const next = gainExp(roster(), "g_mozi", 300, GENERAL_CONFIG)
    expect(next.levels).toBe(2)
    expect(next.state.generals[0]?.level).toBe(3)
    expect(next.state.generals[0]?.exp).toBe(300 - 100 - 135)
  })

  it("滿級封頂，不再囤經驗", () => {
    let state = roster()
    state = gainExp(state, "g_mozi", 1e12, GENERAL_CONFIG).state
    const record = state.generals[0]
    expect(record?.level).toBe(GENERAL_CONFIG.level.max)
    expect(record?.exp).toBe(0)
    expect(expPct(record!, GENERAL_CONFIG)).toBe(100)
  })
})

describe("GB6-2 屬性、裝備、被動", () => {
  it("墨翟 Lv.1：攻10 防18（死守 +15%）統14，帶兵 2508（兵法 +10%）", () => {
    const stats = statsOf(roster().generals[0]!, GENERAL_CONFIG)
    expect(stats.atk).toBe(10)
    expect(stats.def).toBe(18)
    expect(stats.lead).toBe(14)
    expect(stats.troopCap).toBe(2508)
  })

  it("升級後每級 +3 攻 / +2 防 / +1 統", () => {
    const state = gainExp(roster(), "g_mozi", 100, GENERAL_CONFIG).state
    const stats = statsOf(state.generals[0]!, GENERAL_CONFIG)
    expect(stats.atk).toBe(13)
    expect(stats.lead).toBe(15)
    expect(stats.troopCap).toBe(Math.round((600 + 15 * 120) * 1.1))
  })

  it("裝備加成：青龍刀 +12 攻、鐵甲 +14 防", () => {
    let state = roster()
    state = equip(state, "g_mozi", "eq_qinglong", GENERAL_CONFIG).state
    state = equip(state, "g_mozi", "eq_tiejia", GENERAL_CONFIG).state
    const stats = statsOf(state.generals[0]!, GENERAL_CONFIG)
    expect(stats.atk).toBe(22)
    expect(stats.def).toBe(Math.round(30 * 1.15))
  })
})

describe("GB6-3 酒館招募", () => {
  it("同日刷新結果一致，固定三名候選", () => {
    const first = refreshTavern(roster(), GENERAL_CONFIG, NOW)
    const second = refreshTavern(createRoster(GENERAL_CONFIG, NOW + 3600_000), GENERAL_CONFIG, NOW)
    expect(first.tavern.offers).toEqual(second.tavern.offers)
    expect(first.tavern.offers.length).toBe(3)
    expect(first.tavern.offers).not.toContain("g_mozi")
  })

  it("錢糧足夠 → 招募成功並從候選移除", () => {
    const state = refreshTavern(roster(), GENERAL_CONFIG, NOW)
    const offer = state.tavern.offers[0]!
    const result = recruit(state, GENERAL_CONFIG, offer, { coin: 10_000, jade: 5 }, NOW)
    expect(result.ok).toBe(true)
    expect(result.state.generals.length).toBe(2)
    expect(result.state.tavern.offers).not.toContain(offer)
    expect(result.cost).toEqual({ coin: 2000, jade: 1 })
  })

  it("資源不足 / 不在今日名單 → 拒絕", () => {
    const state = refreshTavern(roster(), GENERAL_CONFIG, NOW)
    const offer = state.tavern.offers[0]!
    expect(recruit(state, GENERAL_CONFIG, offer, { coin: 0, jade: 0 }).reason).toBe("not-enough-resource")
    expect(recruit(state, GENERAL_CONFIG, "g_gaoshi", { coin: 10_000, jade: 5 }).reason).toBe("no-offer")
  })
})

describe("GB6-4 校場編隊", () => {
  it("編隊扣兵池，撤格回池", () => {
    const state = roster()
    const set = setFormation(state, GENERAL_CONFIG, 0, "g_mozi", "blade", 300)
    expect(set.ok).toBe(true)
    expect(set.state.troops.blade).toBe(900)
    expect(set.state.formation[0]?.count).toBe(300)
    const cleared = setFormation(set.state, GENERAL_CONFIG, 0, null, null, 0)
    expect(cleared.ok).toBe(true)
    expect(cleared.state.troops.blade).toBe(1200)
  })

  it("超過帶兵上限 → bad-count；同將兩格 → general-busy", () => {
    const state = roster()
    expect(setFormation(state, GENERAL_CONFIG, 0, "g_mozi", "blade", 2000).reason).toBe("bad-count")
    const set = setFormation(state, GENERAL_CONFIG, 0, "g_mozi", "blade", 100).state
    expect(setFormation(set, GENERAL_CONFIG, 1, "g_mozi", "blade", 100).reason).toBe("general-busy")
  })

  it("兵力七行對齊 data/generals.json", () => {
    expect(troopRows(roster(), GENERAL_CONFIG).map((row) => row.name)).toEqual([
      "刀兵",
      "戟兵",
      "弓兵",
      "盾兵",
      "騎兵",
      "學者",
      "神獸",
    ])
  })
})

describe("GB6-5 存檔與戰棋技能接口", () => {
  it("序列化 → 反序列化，等級與編隊保留", () => {
    let state = roster()
    state = gainExp(state, "g_mozi", 500, GENERAL_CONFIG).state
    state = setFormation(state, GENERAL_CONFIG, 0, "g_mozi", "blade", 200).state
    const round = deserialize(serialize(state), GENERAL_CONFIG)
    expect(round?.generals[0]?.level).toBe(state.generals[0]?.level)
    expect(round?.formation[0]?.count).toBe(200)
    expect(round?.troops.blade).toBe(1000)
  })

  it("火計：射程 3、傷害 ×1.4、扣血並進冷卻", () => {
    const state = board()
    const before = state.units.find((unit) => unit.id === "d1")!.hp
    const result = applyCommand(state, { type: "skill", unitId: "a1", skillId: "sk_huoji", targetId: "d1" })
    expect(result.ok).toBe(true)
    const target = result.state.units.find((unit) => unit.id === "d1")!
    expect(before - target.hp).toBeGreaterThan(0)
    expect(result.state.units.find((unit) => unit.id === "a1")!.cd.sk_huoji).toBe(2)
    const again = applyCommand({ ...result.state, side: "attacker", acted: [] }, { type: "skill", unitId: "a1", skillId: "sk_huoji", targetId: "d1" })
    expect(again.reason).toBe("cooling")
  })

  it("技能射程外用 out-of-range，沒學過用 no-skill", () => {
    const state = createBoard([squad("a1", "attacker", "bow", 0, 0, 0), squad("d1", "defender", "blade", 6, 0, 0)])
    expect(applyCommand(state, { type: "skill", unitId: "a1", skillId: "sk_huoji", targetId: "d1" }).reason).toBe("out-of-range")
    expect(applyCommand(state, { type: "skill", unitId: "a1", skillId: "sk_tuji", targetId: "d1" }).reason).toBe("no-skill")
  })
})

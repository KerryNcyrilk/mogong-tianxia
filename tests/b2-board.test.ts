import { describe, expect, it } from "vitest"
import {
  applyCommand,
  autoTurn,
  createBoard,
  initiative,
  manhattan,
  reachable,
  type Command,
} from "../src/combat/board.ts"
import type { Side, Squad, UnitType } from "../src/combat/types.ts"

const TYPE: Record<string, { atk: number; def: number; spd: number; range: number; hp: number }> = {
  blade: { atk: 420, def: 260, spd: 60, range: 1, hp: 1000 },
  bow: { atk: 460, def: 180, spd: 65, range: 4, hp: 800 },
  cavalry: { atk: 520, def: 300, spd: 90, range: 2, hp: 1200 },
  shield: { atk: 240, def: 480, spd: 45, range: 1, hp: 1400 },
  scholar: { atk: 500, def: 200, spd: 70, range: 3, hp: 700 },
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
    general: null,
  }
}

describe("GB2-1 一格一步", () => {
  it("超出移動力 → blocked", () => {
    const state = createBoard([squad("a1", "attacker", "blade", 0, 0, 0)])
    const result = applyCommand(state, { type: "move", unitId: "a1", to: { x: 4, y: 0 } })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("blocked")
  })

  it("移動力內 → ok 並更新座標", () => {
    const state = createBoard([squad("a1", "attacker", "cavalry", 0, 0, 0)])
    const result = applyCommand(state, { type: "move", unitId: "a1", to: { x: 3, y: 1 } })
    expect(result.ok).toBe(true)
    const moved = result.state.units.find((unit) => unit.id === "a1")
    expect(moved && [moved.x, moved.y]).toEqual([3, 1])
  })
})

describe("GB2-2 射程（曼哈頓）", () => {
  it("弓兵距 4 可攻、距 5 out-of-range", () => {
    const near = createBoard([squad("b1", "attacker", "bow", 0, 0, 0), squad("e1", "defender", "blade", 4, 0, 0)])
    const hit = applyCommand(near, { type: "attack", unitId: "b1", targetId: "e1" })
    expect(hit.ok).toBe(true)
    expect(hit.state.units.find((unit) => unit.id === "e1")?.hp).toBeLessThan(1000)

    const far = createBoard([squad("b1", "attacker", "bow", 0, 0, 0), squad("e1", "defender", "blade", 5, 0, 0)])
    const miss = applyCommand(far, { type: "attack", unitId: "b1", targetId: "e1" })
    expect(miss.ok).toBe(false)
    expect(miss.reason).toBe("out-of-range")
  })

  it("刀兵射程 1：距 2 打不到", () => {
    const state = createBoard([squad("d1", "attacker", "blade", 0, 0, 0), squad("e1", "defender", "blade", 2, 0, 0)])
    expect(applyCommand(state, { type: "attack", unitId: "d1", targetId: "e1" }).reason).toBe("out-of-range")
  })
})

describe("GB2-3 佔格與繞行", () => {
  it("目標格被佔 → blocked", () => {
    const state = createBoard([
      squad("a1", "attacker", "blade", 0, 0, 0),
      squad("a2", "attacker", "blade", 1, 0, 1),
    ])
    const result = applyCommand(state, { type: "move", unitId: "a1", to: { x: 1, y: 0 } })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("blocked")
  })

  it("繞行可達：正前方被友軍佔，仍可由下方繞過", () => {
    const state = createBoard([
      squad("a1", "attacker", "blade", 0, 0, 0),
      squad("a2", "attacker", "blade", 1, 0, 1),
    ])
    const reach = reachable(state, "a1")
    expect(reach.has("2,1")).toBe(true)
  })
})

describe("GB2-4 回合序與士氣", () => {
  it("同速攻方先行：攻方全動完才換守方", () => {
    const state = createBoard([
      squad("a1", "attacker", "blade", 0, 0, 0),
      squad("d1", "defender", "blade", 6, 3, 1),
    ])
    expect(initiative(state)[0]?.id).toBe("a1")
    const afterAttacker = applyCommand(state, { type: "wait", unitId: "a1" }).state
    expect(afterAttacker.side).toBe("defender")
    const afterDefender = applyCommand(afterAttacker, { type: "wait", unitId: "d1" }).state
    expect(afterDefender.side).toBe("attacker")
    expect(afterDefender.turn).toBe(2)
  })

  it("敵方單位在攻方回合下指令 → not-your-turn", () => {
    const state = createBoard([squad("a1", "attacker", "blade", 0, 0, 0), squad("d1", "defender", "blade", 6, 3, 1)])
    const result = applyCommand(state, { type: "wait", unitId: "d1" })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("not-your-turn")
  })

  it("傷害用同一 v4.0 公式（ATK×C−DEF）×士氣且不低於最低傷害", () => {
    const state = createBoard([squad("a1", "attacker", "blade", 0, 0, 0), squad("d1", "defender", "blade", 1, 0, 1)])
    const result = applyCommand(state, { type: "attack", unitId: "a1", targetId: "d1" })
    const log = result.state.log.at(-1)
    expect(log?.kind).toBe("attack")
    expect(log?.damage).toBeGreaterThan(0)
  })
})

describe("GB2-5 託管可重現", () => {
  const build = () =>
    createBoard([
      squad("a1", "attacker", "blade", 0, 2, 0),
      squad("a2", "attacker", "bow", 1, 3, 1),
      squad("d1", "defender", "blade", 9, 3, 0),
      squad("d2", "defender", "shield", 10, 4, 1),
    ])

  it("同一初始狀態兩次 autoTurn 命令序列完全相同", () => {
    const first = autoTurn({ ...build(), auto: true })
    const second = autoTurn({ ...build(), auto: true })
    expect(JSON.stringify(first.commands)).toBe(JSON.stringify(second.commands))
    expect(first.commands.length).toBeGreaterThan(2)
  })

  it("託管會推進回合", () => {
    const first = autoTurn({ ...build(), auto: true })
    expect(first.state.turn).toBeGreaterThan(1)
  })

  it("命令序列可重放得到同一終局", () => {
    const first = autoTurn({ ...build(), auto: true })
    let replay = { ...build(), auto: true }
    for (const command of first.commands as Command[]) {
      replay = applyCommand(replay, command).state
    }
    expect(JSON.stringify(replay.units.map((unit) => [unit.id, unit.hp, unit.x, unit.y]))).toBe(
      JSON.stringify(first.state.units.map((unit) => [unit.id, unit.hp, unit.x, unit.y])),
    )
  })
})

describe("toggleAuto 與邊界", () => {
  it("切換託管不消耗行動", () => {
    const state = createBoard([squad("a1", "attacker", "blade", 0, 0, 0)])
    const on = applyCommand(state, { type: "toggleAuto", enabled: true })
    expect(on.ok).toBe(true)
    expect(on.state.auto).toBe(true)
    expect(on.state.acted).toEqual([])
    const off = applyCommand(on.state, { type: "toggleAuto", enabled: false })
    expect(off.state.auto).toBe(false)
  })

  it("曼哈頓距離計算", () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
  })
})

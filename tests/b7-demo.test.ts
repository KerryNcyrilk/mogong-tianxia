import { describe, expect, it } from "vitest"
import { GENERAL_CONFIG } from "../src/general/config.ts"
import { INTERNAL_CONFIG } from "../src/internal/config.ts"
import { createRoster, makeGeneral, setFormation, statsOf, troopRows, save as saveRoster, load as loadRoster } from "../src/general/engine.ts"
import { createState, save as saveInternal, load as loadInternal } from "../src/internal/engine.ts"
import { createBoard, autoTurn, retreat, alive } from "../src/combat/board.ts"
import { STAGE_FILE, assertStageFile, stageById } from "../src/demo/stages.ts"
import { buildSquads } from "../src/demo/squads.ts"
import { settleBattle, outcomeOf, survivorsOf } from "../src/demo/settle.ts"
import { recruitTroops } from "../src/demo/recruit.ts"
import { HOTSPOT_FILE, assertHotspotFile, hotspotAt } from "../src/demo/hotspots.ts"
import type { RosterState } from "../src/general/types.ts"
import type { InternalState } from "../src/internal/types.ts"

function memoryStore(): Pick<Storage, "setItem" | "getItem"> {
  const map = new Map<string, string>()
  return { setItem: (key, value) => void map.set(key, value), getItem: (key) => map.get(key) ?? null }
}

function rosterWithThree(): RosterState {
  const base = createRoster(GENERAL_CONFIG, 1700000000000)
  const extra = ["g_qinwuyang", "g_mengsheng"]
    .map((id) => makeGeneral(id, GENERAL_CONFIG, 1700000000000))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  return { ...base, generals: [...base.generals, ...extra] }
}

function fillThree(roster: RosterState, counts: [number, number, number]): RosterState {
  let state = roster
  const units: ["blade", "bow", "shield"] = ["blade", "bow", "shield"]
  for (const [index, general] of roster.generals.slice(0, 3).entries()) {
    const unit = units[index]
    const result = setFormation(state, GENERAL_CONFIG, index, general.id, unit, counts[index])
    if (!result.ok) throw new Error(`formation ${index}: ${result.reason}`)
    state = result.state
  }
  return state
}

describe("GB7-1 關卡真源", () => {
  it("stages.json 自檢通過，三關卡攻守格不重疊", () => {
    expect(() => assertStageFile()).not.toThrow()
    expect(STAGE_FILE.stages.length).toBe(3)
    expect(STAGE_FILE.attacker.positions.length).toBe(3)
    expect(stageById("s_qinying")?.name).toBe("秦營")
    expect(STAGE_FILE.settle.winExpPerEnemy).toBe(0.6)
  })

  it("校場三格全空 → empty-formation", () => {
    const roster = rosterWithThree()
    const result = buildSquads(roster, GENERAL_CONFIG, STAGE_FILE.stages[0], STAGE_FILE)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("empty-formation")
  })

  it("三格齊備 → 攻守雙方都落盤且格不重疊", () => {
    const roster = fillThree(rosterWithThree(), [400, 300, 400])
    const stage = stageById("s_shankou")
    expect(stage).not.toBeNull()
    const built = buildSquads(roster, GENERAL_CONFIG, stage!, STAGE_FILE)
    expect(built.ok).toBe(true)
    expect(built.squads.length).toBe(3 + stage!.enemy.length)
    expect(built.deployed.length).toBe(3)
    expect(built.deployed[0]?.hpPer).toBe(10)
    expect(built.squads.filter((squad) => squad.side === "attacker").map((squad) => `${squad.x},${squad.y}`)).toEqual(["1,2", "2,4", "1,6"])
    expect(() => createBoard(built.squads)).not.toThrow()
  })
})

describe("GB7-2 出征屬性", () => {
  it("武將光環與主動技能掛到出戰部隊", () => {
    const roster = fillThree(rosterWithThree(), [300, 200, 300])
    const built = buildSquads(roster, GENERAL_CONFIG, STAGE_FILE.stages[0], STAGE_FILE)
    const bow = built.squads.find((squad) => squad.type === "bow")
    expect(bow?.general?.name).toBe("禽滑釐")
    expect(bow?.general?.skills?.map((skill) => skill.id)).toContain("sk_huoji")
    const record = roster.generals.find((item) => item.id === "g_qinwuyang")
    expect(bow?.general?.atk).toBe(record ? statsOf(record, GENERAL_CONFIG).atk : -1)
  })

  it("兵數與兵力換算：hp＝兵數×每兵 hp", () => {
    const roster = fillThree(rosterWithThree(), [500, 100, 250])
    const built = buildSquads(roster, GENERAL_CONFIG, STAGE_FILE.stages[0], STAGE_FILE)
    const blade = built.squads.find((squad) => squad.type === "blade" && squad.side === "attacker")
    expect(blade?.hp).toBe(5000)
    expect(blade?.maxHp).toBe(5000)
    const unit = createBoard(built.squads).units.find((item) => item.id === "mo-0-blade")
    expect(unit).toBeDefined()
    expect(survivorsOf({ ...unit!, hp: 2600 }, built.deployed, 10)).toBe(260)
  })
})

describe("GB7-3 戰後結算", () => {
  it("打贏：經驗＝敵兵×0.6、戰利品＝敵兵×2、存活回池、編隊清空", () => {
    const roster = fillThree(rosterWithThree(), [600, 400, 600])
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const stage = stageById("s_yecun")!
    const built = buildSquads(roster, GENERAL_CONFIG, stage, STAGE_FILE)
    let board = createBoard(built.squads)
    for (let guard = 0; guard < 60 && !board.over; guard += 1) board = autoTurn(board).state

    expect(board.over).toBe("attacker")
    const settled = settleBattle({ board, roster, internal, config: GENERAL_CONFIG, internalConfig: INTERNAL_CONFIG, stage, file: STAGE_FILE, deployed: built.deployed })
    const report = settled.report
    expect(report.outcome).toBe("win")
    expect(report.enemyDeployed).toBe(30)
    expect(report.expPerGeneral).toBe(6)
    expect(report.lootCoin).toBe(60)
    expect(settled.internal.resources.coin).toBe(internal.resources.coin + 60)
    expect(settled.internal.morale).toBe(internal.morale + 5)
    expect(settled.roster.formation.every((slot) => slot.generalId === null)).toBe(true)
    expect(report.returned + report.lost).toBe(1600)
    expect(report.levels[0]?.to).toBeGreaterThanOrEqual(1)
    expect(settled.internal.eventLog.at(-1)?.id).toBe("battle")
  })

  it("打輸：傷兵 40% 回池、經驗只按殲敵、民心 −8", () => {
    const roster = rosterWithThree()
    const one = setFormation(roster, GENERAL_CONFIG, 0, roster.generals[0]!.id, "blade", 100)
    expect(one.ok).toBe(true)
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const stage = stageById("s_qinying")!
    const built = buildSquads(one.state, GENERAL_CONFIG, stage, STAGE_FILE)
    let board = createBoard(built.squads)
    for (let guard = 0; guard < 60 && !board.over; guard += 1) board = autoTurn(board).state

    expect(board.over).toBe("defender")
    const settled = settleBattle({ board, roster: one.state, internal, config: GENERAL_CONFIG, internalConfig: INTERNAL_CONFIG, stage, file: STAGE_FILE, deployed: built.deployed })
    expect(settled.report.outcome).toBe("lose")
    expect(settled.report.returned).toBe(40)
    expect(settled.report.lost).toBe(60)
    expect(settled.report.lootCoin).toBe(0)
    expect(settled.internal.morale).toBe(internal.morale - 8)
    expect(settled.report.expPerGeneral).toBe(Math.floor(settled.report.enemyKilled * 0.4))
  })

  it("撤退：判負、保留 70%、不算全滅", () => {
    const roster = rosterWithThree()
    const one = setFormation(roster, GENERAL_CONFIG, 0, roster.generals[0]!.id, "blade", 500)
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const stage = stageById("s_shankou")!
    const built = buildSquads(one.state, GENERAL_CONFIG, stage, STAGE_FILE)
    const board = retreat(createBoard(built.squads))
    expect(board.over).toBe("defender")
    expect(board.retreated).toBe(true)
    expect(outcomeOf(board)).toBe("retreat")
    const settled = settleBattle({ board, roster: one.state, internal, config: GENERAL_CONFIG, internalConfig: INTERNAL_CONFIG, stage, file: STAGE_FILE, deployed: built.deployed })
    expect(settled.report.returned).toBeGreaterThanOrEqual(350)
    expect(settled.report.returned + settled.report.lost).toBe(500)
    expect(settled.internal.morale).toBe(internal.morale - 8)
  })

  it("滿編三格：經驗均分，尾差歸第一位", () => {
    const roster = fillThree(rosterWithThree(), [900, 700, 600])
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const stage = stageById("s_shankou")!
    const built = buildSquads(roster, GENERAL_CONFIG, stage, STAGE_FILE)
    let board = createBoard(built.squads)
    for (let guard = 0; guard < 80 && !board.over; guard += 1) board = autoTurn(board).state
    expect(alive(board.units, "attacker").length).toBeGreaterThan(0)
    const settled = settleBattle({ board, roster, internal, config: GENERAL_CONFIG, internalConfig: INTERNAL_CONFIG, stage, file: STAGE_FILE, deployed: built.deployed })
    const share = settled.report.expPerGeneral
    expect(settled.report.levels.length).toBe(3)
    expect(share * 3).toBeLessThanOrEqual(settled.report.enemyDeployed * 2)
    for (const entry of settled.report.levels) expect(entry.to).toBeGreaterThanOrEqual(entry.from)
  })
})

describe("GB7-4 徵兵", () => {
  it("每 100 兵扣刀幣 300／糧 120／人口 1", () => {
    const roster = createRoster(GENERAL_CONFIG, 1700000000000)
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const before = roster.troops.blade ?? 0
    const result = recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "blade", 200)
    expect(result.ok).toBe(true)
    expect(result.roster.troops.blade).toBe(before + 200)
    expect(result.internal.resources.coin).toBe(internal.resources.coin - 600)
    expect(result.internal.resources.food).toBe(internal.resources.food - 240)
    expect(result.internal.resources.pop).toBe(internal.resources.pop - 2)
  })

  it("三個拒絕理由都固定", () => {
    const roster = createRoster(GENERAL_CONFIG, 1700000000000)
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    expect(recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "dragon", 100).reason).toBe("unknown-unit")
    const poor: InternalState = { ...internal, resources: { ...internal.resources, coin: 10 } }
    expect(recruitTroops(roster, poor, GENERAL_CONFIG, INTERNAL_CONFIG, "blade", 100).reason).toBe("no-resource")
    const full: RosterState = { ...roster, troops: { ...roster.troops, bow: 2000 } }
    expect(recruitTroops(full, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "bow", 100).reason).toBe("pop-cap")
  })
})

describe("GB7-5 存檔與熱區", () => {
  it("戰後數值存檔重載一致（兵力七行、武將等級、刀幣）", () => {
    const store = memoryStore()
    const roster = fillThree(rosterWithThree(), [400, 300, 400])
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const stage = stageById("s_yecun")!
    const built = buildSquads(roster, GENERAL_CONFIG, stage, STAGE_FILE)
    let board = createBoard(built.squads)
    for (let guard = 0; guard < 60 && !board.over; guard += 1) board = autoTurn(board).state
    const settled = settleBattle({ board, roster, internal, config: GENERAL_CONFIG, internalConfig: INTERNAL_CONFIG, stage, file: STAGE_FILE, deployed: built.deployed })

    saveRoster(settled.roster, store)
    saveInternal(settled.internal, store)
    const back = loadRoster(GENERAL_CONFIG, store)
    const internalBack = loadInternal(INTERNAL_CONFIG, store)
    expect(back).not.toBeNull()
    expect(troopRows(back!, GENERAL_CONFIG)).toEqual(troopRows(settled.roster, GENERAL_CONFIG))
    expect(back!.generals.map((item) => item.level)).toEqual(settled.roster.generals.map((item) => item.level))
    expect(internalBack?.resources.coin).toBe(settled.internal.resources.coin)
  })

  it("cityHotspots.json 自檢通過且可命中校場／官府", () => {
    expect(() => assertHotspotFile()).not.toThrow()
    expect(HOTSPOT_FILE.canvas.w).toBe(2496)
    const drill = HOTSPOT_FILE.hotspots.find((item) => item.id === "drill")!
    const center = {
      x: (drill.polygon[0]!.x + drill.polygon[2]!.x) / 2,
      y: (drill.polygon[0]!.y + drill.polygon[2]!.y) / 2,
    }
    expect(hotspotAt(center)?.id).toBe("drill")
    expect(hotspotAt({ x: 10, y: 10 })).toBeNull()
    expect(HOTSPOT_FILE.hotspots.map((item) => item.action)).toContain("出征")
  })
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { autoTurn, createBoard, type BoardState, type BoardUnit } from "../src/combat/board.ts"
import type { Side } from "../src/combat/types.ts"
import { RECRUIT_COST, recruitTroops } from "../src/demo/recruit.ts"
import { buildSquads } from "../src/demo/squads.ts"
import { settleBattle } from "../src/demo/settle.ts"
import { STAGE_FILE } from "../src/demo/stages.ts"
import { GENERAL_CONFIG } from "../src/general/config.ts"
import { createRoster, setFormation } from "../src/general/engine.ts"
import { INTERNAL_CONFIG } from "../src/internal/config.ts"
import { createState, enqueue, tick } from "../src/internal/engine.ts"
import { createScenario } from "../src/sandbox/scenario.ts"
import { adjustBoardHit, stepAutoBoard, troopDamageFactor } from "../src/dev/boardTune.ts"
import {
  IRON_PER_100,
  RECRUIT_BASE,
  STORAGE_KEY,
  applyStartResources,
  attachOverrideStorage,
  balanceOverrideJson,
  consoleRequested,
  drillExpOf,
  finishBuildQueue,
  hotkeyAction,
  moraleThresholdOf,
  overrideDiff,
  overridesIdle,
  priceRecruit,
  pushRecruitJob,
  readOverrides,
  reloadOverrides,
  resetOverrides,
  scaledTickSeconds,
  takeRecruitJobs,
  troopDamageWeight,
  updateOverrides,
  winExpPerEnemyOf,
  withResource,
} from "../src/dev/devOverrides.ts"

function memoryStore() {
  const map = new Map<string, string>()
  let reads = 0
  return {
    reads: () => reads,
    map,
    storage: {
      getItem: (key: string) => {
        reads += 1
        return map.get(key) ?? null
      },
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
      removeItem: (key: string) => {
        map.delete(key)
      },
    },
  }
}

let store = memoryStore()

beforeEach(() => {
  store = memoryStore()
  attachOverrideStorage(store.storage)
})

afterEach(() => {
  resetOverrides()
  attachOverrideStorage(null)
})

function piece(partial: Partial<BoardUnit> & { id: string; side: Side; hp: number }): BoardUnit {
  return {
    type: "blade",
    atk: 10,
    def: 8,
    spd: 50,
    maxHp: partial.maxHp ?? partial.hp,
    range: 1,
    move: 2,
    x: 0,
    y: 0,
    index: 0,
    generalAtk: 0,
    generalDef: 0,
    skills: [],
    cd: {},
    ...partial,
  }
}

function hit(before: BoardState, damage: number, unitId = "a0", targetId = "d1"): BoardState {
  const units = before.units.map((unit) => ({ ...unit, cd: { ...unit.cd } }))
  const target = units.find((unit) => unit.id === targetId)
  if (!target) throw new Error("missing target")
  target.hp = Math.max(0, target.hp - damage)
  return adjustBoardHit(before, {
    ok: true,
    reason: null,
    state: {
      ...before,
      units,
      acted: [unitId],
      log: [{ turn: before.turn, side: before.side, unitId, kind: "attack", targetId, damage }],
    },
  })
}

describe("DEV-CONSOLE-V1 覆寫層", () => {
  it("空存檔只讀一次，之後原值原樣返回", () => {
    expect(STORAGE_KEY).toBe("mg_dev_overrides_v1")
    expect(scaledTickSeconds(1)).toBe(1)
    expect(drillExpOf(12)).toBe(12)
    expect(winExpPerEnemyOf(0.6)).toBe(0.6)
    expect(troopDamageWeight()).toBe(0)
    expect(moraleThresholdOf()).toBe(0.5)
    expect(troopDamageFactor(24)).toBe(1)
    expect(overridesIdle()).toBe(true)
    expect(store.reads()).toBe(1)
    expect(readOverrides()).toBeNull()
    expect(overrideDiff()).toEqual({})
  })

  it("寫入後走記憶體，壞檔與恢復預設都回到原值", () => {
    updateOverrides({ timescale: 1000, moraleThreshold: 0.9, unitCost: { blade: 1 } })
    expect(scaledTickSeconds(1)).toBe(100)
    expect(moraleThresholdOf()).toBe(0.5)
    expect(readOverrides()?.unitCost).toBeUndefined()
    expect(store.reads()).toBe(1)
    const saved = store.map.get(STORAGE_KEY) ?? ""
    expect(saved.includes("timescale")).toBe(true)
    reloadOverrides()
    expect(scaledTickSeconds(3)).toBe(300)
    store.map.set(STORAGE_KEY, "{")
    reloadOverrides()
    expect(overridesIdle()).toBe(true)
    expect(drillExpOf(12)).toBe(12)
    updateOverrides({ drillExp: 0.2, winExpMultiplier: 2 })
    resetOverrides()
    expect(store.map.has(STORAGE_KEY)).toBe(false)
    expect(winExpPerEnemyOf(0.6)).toBe(0.6)
    expect(store.reads()).toBeGreaterThan(1)
    expect(scaledTickSeconds(1)).toBe(1)
  })

  it("差異只含改過的欄位，平衡檔帶齊六項", () => {
    updateOverrides({
      start: { coin: 12000 },
      iron: { on: true, ratio: 1.5 },
      unitCost: { beast: 4 },
      drillExp: 0.2,
      winExpMultiplier: 4 / 0.6,
      troopDamageWeight: 1,
      moraleThreshold: 0.25,
    })
    const diff = overrideDiff()
    expect(diff["start.coin"]).toEqual({ from: INTERNAL_CONFIG.start.coin, to: 12000 })
    expect(diff["start.food"]).toBeUndefined()
    expect(diff["iron.on"]).toEqual({ from: false, to: true })
    expect(diff["iron.ratio"]).toEqual({ from: 1, to: 1.5 })
    expect(diff["unitCost.beast"]).toEqual({ from: 1, to: 4 })
    expect(diff["unitCost.blade"]).toBeUndefined()
    expect(diff.drillExp).toEqual({ from: 12, to: 0.2 })
    expect(diff.troopDamageWeight).toEqual({ from: 0, to: 1 })
    expect(diff.moraleThreshold).toEqual({ from: 0.5, to: 0.25 })
    const file = JSON.parse(balanceOverrideJson()) as {
      schema: string
      iron: { on: boolean; ratio: number; per100: { cavalry: number; shield: number } }
      unitCost: Record<string, number>
      drillExpPerMinute: number
      troopDamageWeight: number
      moraleThreshold: number
    }
    expect(file.schema).toBe("balance-override.v1")
    expect(file.iron.per100.cavalry).toBe(IRON_PER_100.cavalry)
    expect(file.iron.per100.shield).toBe(50)
    expect(file.unitCost.blade).toBe(1)
    expect(file.unitCost.beast).toBe(4)
    expect(file.drillExpPerMinute).toBe(0.2)
    expect(file.troopDamageWeight).toBe(1)
    expect(file.moraleThreshold).toBe(0.25)
  })

  it("起始資源、上限抬升與建造隊列", () => {
    const state = createState(INTERNAL_CONFIG, 1)
    expect(applyStartResources(state)).toBe(state)
    updateOverrides({ start: { coin: 12000 } })
    const restarted = applyStartResources(state)
    expect(restarted).not.toBe(state)
    expect(restarted.resources.coin).toBe(12000)
    expect(restarted.resources.food).toBe(state.resources.food)
    expect(state.resources.coin).toBe(INTERNAL_CONFIG.start.coin)

    const rich = withResource(state, INTERNAL_CONFIG, "coin", state.resources.coin + 10000)
    expect(rich.resources.coin).toBe(state.resources.coin + 10000)
    const crowded = withResource(state, INTERNAL_CONFIG, "pop", 10000)
    expect(crowded.resources.pop).toBe(10000)
    expect(tick(crowded, INTERNAL_CONFIG, 1).resources.pop).toBe(10000)
    expect(finishBuildQueue(state)).toEqual({ state, finished: 0 })

    const house = enqueue(state, INTERNAL_CONFIG, "house")
    const farm = enqueue(house.state, INTERNAL_CONFIG, "farm")
    const done = finishBuildQueue(farm.state)
    expect(done.finished).toBe(2)
    expect(done.state.levels.house).toBe(2)
    expect(done.state.levels.farm).toBe(2)
    expect(done.state.slots.every((slot) => slot.kind === "")).toBe(true)
  })

  it("徵兵倍率與生鐵開關不改基礎價常數", () => {
    expect(RECRUIT_BASE).toEqual(RECRUIT_COST)
    const roster = createRoster(GENERAL_CONFIG, 1700000000000)
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const plain = recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "blade", 100)
    expect(plain.ok).toBe(true)
    expect(plain.internal.resources.coin).toBe(internal.resources.coin - 300)
    expect(plain.internal.resources.food).toBe(internal.resources.food - 120)
    expect(plain.internal.resources.pop).toBe(internal.resources.pop - 1)
    expect(plain.internal.resources.iron).toBe(internal.resources.iron)
    expect(plain.cost && "iron" in plain.cost).toBe(false)

    updateOverrides({ unitCost: { blade: 2, shield: 1 } })
    const doubled = recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "blade", 100)
    expect(doubled.internal.resources.coin).toBe(internal.resources.coin - 600)
    expect(doubled.internal.resources.food).toBe(internal.resources.food - 240)
    expect(doubled.cost?.pop).toBe(1)
    expect(doubled.internal.resources.iron).toBe(internal.resources.iron)

    updateOverrides({ iron: { on: true, ratio: 0.5 }, unitCost: { blade: 1 } })
    expect(priceRecruit("cavalry", 1).iron).toBe(40)
    expect(priceRecruit("shield", 1).iron).toBe(25)
    expect(priceRecruit("blade", 1).iron).toBe(0)
    const cavalry = recruitTroops(roster, internal, GENERAL_CONFIG, INTERNAL_CONFIG, "cavalry", 100)
    expect(cavalry.ok).toBe(true)
    expect(cavalry.internal.resources.iron).toBe(internal.resources.iron - 40)
    const broke = { ...internal, resources: { ...internal.resources, iron: 10 } }
    const denied = recruitTroops(roster, broke, GENERAL_CONFIG, INTERNAL_CONFIG, "shield", 100)
    expect(denied.reason).toBe("no-resource")
    expect(denied.cost?.iron).toBe(25)
    expect(broke.resources.iron).toBe(10)

    const job = pushRecruitJob("blade", 100)
    expect(takeRecruitJobs()).toEqual([job])
    expect(takeRecruitJobs()).toEqual([])
  })

  it("勝場經驗倍率只乘勝場係數", () => {
    const roster = createRoster(GENERAL_CONFIG, 1700000000000)
    const general = roster.generals[0]
    if (!general) throw new Error("no general")
    const formed = setFormation(roster, GENERAL_CONFIG, 0, general.id, "blade", 100)
    if (!formed.ok) throw new Error(formed.reason ?? "formation")
    const stage = STAGE_FILE.stages[0]
    if (!stage) throw new Error("no stage")
    const built = buildSquads(formed.state, GENERAL_CONFIG, stage, STAGE_FILE)
    expect(built.ok).toBe(true)
    const board = { ...createBoard(built.squads), over: "attacker" as const }
    const internal = createState(INTERNAL_CONFIG, 1700000000000)
    const input = {
      board,
      roster: formed.state,
      internal,
      config: GENERAL_CONFIG,
      internalConfig: INTERNAL_CONFIG,
      stage,
      file: STAGE_FILE,
      deployed: built.deployed,
    }
    expect(settleBattle(input).report.expPerGeneral).toBe(18)
    updateOverrides({ winExpMultiplier: 2 })
    expect(settleBattle(input).report.expPerGeneral).toBe(36)
  })

  it("人數權重與士氣門檻：預設不改狀態，開啟後才加傷", () => {
    const board = createBoard(createScenario())
    const plain = autoTurn(board).state
    const wrapped = stepAutoBoard(board)
    expect(wrapped.units.map((unit) => unit.hp)).toEqual(plain.units.map((unit) => unit.hp))

    const attackers = [0, 1, 2, 3, 4].map((index) =>
      piece({ id: `a${index}`, side: "attacker", hp: index < 2 ? 10 : 0, x: index, y: 0, index, maxHp: index === 0 ? 240 : 10 }),
    )
    const before: BoardState = {
      units: [...attackers, piece({ id: "d1", side: "defender", hp: 500, x: 6, y: 0, type: "shield", maxHp: 500 })],
      turn: 6,
      side: "attacker",
      auto: false,
      acted: [],
      log: [],
      over: null,
    }
    const untouched = hit(before, 9)
    expect(untouched.units.find((unit) => unit.id === "d1")?.hp).toBe(491)

    updateOverrides({ moraleThreshold: 0.3 })
    const eased = hit(before, 9)
    expect(eased.units.find((unit) => unit.id === "d1")?.hp).toBe(490)
    expect(eased.log[0]?.damage).toBe(10)
    const early = hit({ ...before, turn: 5 }, 9)
    expect(early.units.find((unit) => unit.id === "d1")?.hp).toBe(491)
    const broken = hit(
      {
        ...before,
        units: before.units.map((unit, index) => (unit.side === "attacker" && index !== 0 ? { ...unit, hp: 0 } : unit)),
      },
      9,
    )
    expect(broken.units.find((unit) => unit.id === "d1")?.hp).toBe(491)

    updateOverrides({ troopDamageWeight: 1, moraleThreshold: 0.5 })
    expect(troopDamageFactor(24)).toBe(24)
    const weighted = hit(before, 5)
    expect(weighted.log[0]?.damage).toBe(120)
    expect(weighted.units.find((unit) => unit.id === "d1")?.hp).toBe(380)
    expect(before.units.find((unit) => unit.id === "d1")?.hp).toBe(500)

    const heavy = stepAutoBoard(board)
    expect(heavy.units).toHaveLength(board.units.length)
    expect(heavy.over === null || heavy.over === "attacker" || heavy.over === "defender").toBe(true)
  })

  it("熱鍵與 ?dev=1", () => {
    expect(consoleRequested("?dev=1")).toBe(true)
    expect(consoleRequested("?dev=1&skin=v3")).toBe(true)
    expect(consoleRequested("")).toBe(false)
    expect(consoleRequested("?dev=0")).toBe(false)
    expect(hotkeyAction({ ctrlKey: true, shiftKey: true, key: "D" })).toBe("toggle")
    expect(hotkeyAction({ ctrlKey: true, shiftKey: false, key: "d" })).toBe("ignore")
    expect(hotkeyAction({ ctrlKey: false, shiftKey: false, key: "`" })).toBe("toggle")
    expect(hotkeyAction({ ctrlKey: false, shiftKey: false, key: "x", code: "Backquote" })).toBe("toggle")
    expect(hotkeyAction({ ctrlKey: false, shiftKey: false, key: "`", targetTag: "INPUT" })).toBe("ignore")
    expect(hotkeyAction({ ctrlKey: false, shiftKey: false, key: "`", targetTag: "TEXTAREA" })).toBe("ignore")
    expect(hotkeyAction({ ctrlKey: true, shiftKey: true, key: "d", targetTag: "INPUT" })).toBe("toggle")
  })
})

import { describe, expect, it } from "vitest"
import { calcDamage } from "../src/combat/damage.ts"
import { DamageRingLog, explainDamage } from "../src/dev/damageLog.ts"
import {
  CHEATS_OFF,
  SPEEDS,
  STAGES,
  endSide,
  placeUnit,
  removeUnit,
  sandboxCommand,
  sandboxAutoStep,
  stageBoard,
  testDuelBoard,
  tickMs,
} from "../src/dev/stageLab.ts"
import {
  GENERAL_LEVEL_MAX,
  SNAPSHOT_NAMES,
  TimeMachine,
  corruptSaves,
  createSnapshot,
  generalAura,
  injectGeneral,
  injectTroops,
  validateSave,
} from "../src/dev/timeMachine.ts"

describe("DEV-CONSOLE-V2A 第二階段：傷害環形日誌", () => {
  it("拆解結果與 combat/damage.calcDamage 同值（棋盤引擎）", () => {
    const breakdown = explainDamage({
      atk: 11,
      def: 8,
      attackerType: "bow",
      defenderType: "blade",
      morale: 1,
      mode: "grid",
    })
    const engine = calcDamage(
      { id: "bow", atk: 11, def: 6, spd: 50, range: 3, hp: 208, side: "attacker" },
      { id: "blade", atk: 10, def: 8, spd: 50, range: 1, hp: 280, side: "defender" },
      { morale: 1 },
    )
    expect(breakdown.final).toBe(engine)
    expect(breakdown.counter).toBeGreaterThan(0)
  })

  it("環形上限 200 筆，覆寫最舊、累計筆數照算", () => {
    const ring = new DamageRingLog(200)
    for (let index = 0; index < 205; index += 1) {
      ring.push({
        turn: 1,
        actorId: "a",
        targetId: "b",
        attackerType: "bow",
        defenderType: "blade",
        damage: index,
        engine: "grid",
        breakdown: explainDamage({ atk: 11, def: 8, attackerType: "bow", defenderType: "blade", morale: 1, mode: "grid" }),
      })
    }
    expect(ring.size).toBe(200)
    expect(ring.totalPushed).toBe(205)
    expect(ring.list()[0]?.seq).toBe(6)
    expect(ring.latest(3).map((entry) => entry.damage)).toEqual([202, 203, 204])
    expect(ring.json().capacity).toBe(200)
  })

  it("沙盒攻擊會寫入日誌，且 damage ≤ 拆解值（受目標剩血夾住）", () => {
    const ring = new DamageRingLog()
    const before = testDuelBoard()
    const targetBefore = before.units.find((unit) => unit.side === "defender")
    const result = sandboxCommand(
      before,
      { type: "attack", unitId: "mo-bow-1", targetId: "qin-blade-2" },
      CHEATS_OFF,
      ring,
    )
    expect(result.ok).toBe(true)
    expect(result.entry).not.toBeNull()
    expect(ring.size).toBe(1)
    expect(result.entry?.engine).toBe("grid")
    expect(result.entry?.damage).toBe(Math.min(targetBefore?.hp ?? 0, result.entry?.breakdown.final ?? 0))
  })
})

describe("DEV-CONSOLE-V2A 第二階段：12×8 沙盒", () => {
  it("S1–S10 十關齊備，S1 棋盤 5 隊（3 攻 2 守）", () => {
    expect(STAGES.length).toBe(10)
    const board = stageBoard("s_yecun")
    expect(board.units.length).toBe(5)
    expect(board.units.filter((unit) => unit.side === "defender").length).toBe(2)
  })

  it("空格放兵成功，佔用格放兵被拒", () => {
    const base = stageBoard("s_yecun")
    const placed = placeUnit(base, { side: "attacker", type: "shield", count: 20, x: 3, y: 7 })
    expect(placed.units.length).toBe(base.units.length + 1)
    const refused = placeUnit(base, { side: "attacker", type: "shield", count: 20, x: 1, y: 2 })
    expect(refused.units.length).toBe(base.units.length)
    const newUnit = placed.units[placed.units.length - 1]
    const removed = removeUnit(placed, newUnit.id)
    expect(removed.units.length).toBe(base.units.length)
  })

  it("倍速映射 1×/2×/4×/8× ＝ 600/300/150/75ms", () => {
    expect(SPEEDS).toEqual([1, 2, 4, 8])
    expect(SPEEDS.map((speed) => tickMs(speed))).toEqual([600, 300, 150, 75])
  })

  it("三項作弊：一擊必殺、無敵、無限行動力、敵軍凍結", () => {
    const base = testDuelBoard()
    const oneShot = sandboxCommand(base, { type: "attack", unitId: "mo-bow-1", targetId: "qin-blade-2" }, {
      ...CHEATS_OFF,
      oneShot: true,
    })
    expect(oneShot.state.units.find((unit) => unit.id === "qin-blade-2")?.hp).toBe(0)
    expect(oneShot.state.over).toBe("attacker")

    const invincible = sandboxCommand(base, { type: "wait", unitId: "mo-bow-1" }, { ...CHEATS_OFF, invincible: true })
    expect(invincible.state.units.find((unit) => unit.id === "mo-bow-1")?.hp).toBe(
      invincible.state.units.find((unit) => unit.id === "mo-bow-1")?.maxHp,
    )

    const infinite = sandboxCommand(base, { type: "wait", unitId: "mo-bow-1" }, { ...CHEATS_OFF, infiniteAction: true })
    expect(infinite.state.acted.includes("mo-bow-1")).toBe(false)

    const frozen = sandboxAutoStep({ ...base, side: "defender" }, { ...CHEATS_OFF, freezeEnemy: true })
    expect(frozen.state.side).toBe("attacker")
    expect(frozen.state.turn).toBe(2)
  })

  it("強制結束本輪：先換邊，兩邊都結束才入下一回合", () => {
    const base = testDuelBoard()
    const first = endSide(base)
    expect(first.side).toBe("defender")
    expect(first.turn).toBe(1)
    const second = endSide(first)
    expect(second.side).toBe("attacker")
    expect(second.turn).toBe(2)
  })
})

describe("DEV-CONSOLE-V2A 第二階段：武將注入與時間機器", () => {
  it("武將等級光環：Lv.1 18/10、Lv.50 165/108", () => {
    expect(generalAura(1)).toEqual({ atk: 18, def: 10 })
    expect(generalAura(GENERAL_LEVEL_MAX)).toEqual({ atk: 18 + 3 * 49, def: 10 + 2 * 49 })
  })

  it("五套標準快照齊備，低士氣只剩一隊 30% 血", () => {
    expect(SNAPSHOT_NAMES.length).toBe(5)
    const low = createSnapshot("lowMorale")
    const alive = low.units.filter((unit) => unit.side === "attacker" && unit.hp > 0)
    expect(alive.length).toBe(1)
    expect(alive[0].hp).toBe(Math.max(1, Math.round(alive[0].maxHp * 0.3)))
    expect(createSnapshot("qinShield").units.filter((unit) => unit.side === "defender").length).toBe(4)
  })

  it("10 步 Undo：第 11 步仍只保留最近 10 份，undo 可退", () => {
    const machine = new TimeMachine(10)
    const base = testDuelBoard()
    for (let step = 0; step < 11; step += 1) {
      machine.record({ ...base, turn: step + 1 })
    }
    expect(machine.depth).toBe(10)
    expect(machine.total).toBe(11)
    expect(machine.undo()?.turn).toBe(11)
    expect(machine.undo()?.turn).toBe(10)
    expect(machine.canUndo).toBe(true)
  })

  it("武將注入與七兵補隊都落在棋盤內", () => {
    const base = stageBoard("s_yecun")
    const injected = injectGeneral(base, "mo-blade-1", 30)
    expect(injected.units.find((unit) => unit.id === "mo-blade-1")?.generalAtk).toBe(generalAura(30).atk)
    const troops = injectTroops(base, { side: "defender", type: "beast", count: 6 })
    expect(troops.placed).not.toBeNull()
    expect(troops.state.units.length).toBe(base.units.length + 1)
  })

  it("壞檔生成器五例，校驗逐條給出錯誤而非靜靜通過", () => {
    const cases = corruptSaves()
    expect(cases.length).toBe(5)
    const bad = cases.slice(0, 4).map((row) => validateSave(row.text))
    expect(bad.every((row) => !row.ok)).toBe(true)
    expect(bad.every((row) => row.errors.length > 0)).toBe(true)
    expect(validateSave(cases[4].text).ok).toBe(true)
  })
})

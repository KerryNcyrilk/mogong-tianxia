/// <reference types="node" />
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { V3_LAYOUT } from "../src/demo/cityV3.ts"
import {
  RESOURCE_KEYS,
  STORAGE_KEY,
  attachOverrideStorage,
  consoleRequested,
  hotkeyAction,
  overridesIdle,
  phase3Copper,
  phase3EquipAffixes,
  phase3TechLevel,
  priceRecruit,
  readOverrides,
  reloadOverrides,
  resetOverrides,
  scaledTickSeconds,
  updateOverrides,
  updatePhase3,
} from "../src/dev/devOverrides.ts"
import { buildDebugBundle } from "../src/dev/v2b/debugBundle.ts"
import { DEV_EVENT_LIMIT, attachDevClock, devEvents, pushDevEvent, resetDevEvents } from "../src/dev/v2b/eventRing.ts"
import { FRAME_PRESETS } from "../src/dev/v2b/frames.ts"
import {
  PROVISIONAL_MAX_LEVEL,
  batchBuildingLevel,
  layoutV3Diff,
  moveBadge,
  moveVertex,
  readCalibrator,
  resetCalibrator,
  toggleBuilding,
} from "../src/dev/v2b/layoutCalibrator.ts"
import { mapFrames } from "../src/dev/v2b/mapFrame.ts"
import { OFFLINE_PRESETS, SFX_TRACKS } from "../src/dev/v2b/qaCatalog.ts"
import { buildUpgradePreview } from "../src/dev/v2b/upgradePreview.ts"
import {
  marchTo,
  readWorld,
  resetWorld,
  setCoords,
  setFog,
  setInstantMarch,
  spawnMarker,
} from "../src/dev/v2b/worldBoard.ts"
import { INTERNAL_CONFIG } from "../src/internal/config.ts"
import { canPay, createState } from "../src/internal/engine.ts"
import { attachSfxMemory, heardGain, muted, setMuted, setSfxVolume, sfxVolume } from "../src/ui/city/sfx.ts"
import { UI_1280 } from "../src/ui/city/tokens.ts"

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
  resetCalibrator()
  resetWorld()
  resetDevEvents()
  attachSfxMemory(null)
})

afterEach(() => {
  resetOverrides()
  attachOverrideStorage(null)
  resetCalibrator()
  resetWorld()
  resetDevEvents()
  attachSfxMemory(null)
})

describe("DEV-CONSOLE-V2B 覆寫預留", () => {
  it("沒有覆寫時 Phase 3 讀取不增加存檔次數，官方倍率仍是原值", () => {
    expect(STORAGE_KEY).toBe("mg_dev_overrides_v1")
    expect(phase3Copper()).toBeNull()
    expect(phase3TechLevel()).toBe(0)
    expect(phase3EquipAffixes()).toEqual([])
    expect(overridesIdle()).toBe(true)
    expect(store.reads()).toBe(1)
    expect(scaledTickSeconds(1)).toBe(1)
    expect(store.reads()).toBe(1)
    expect(RESOURCE_KEYS).not.toContain("copper")
    expect(RESOURCE_KEYS).toHaveLength(7)
  })

  it("寫入銅、科技、詞條不改徵兵價，恢復後回到未覆寫", () => {
    updatePhase3({ copper: 0, techLevel: 5000, equipAffixes: ["af_lab", "bad id!!", "af_lab"] })
    expect(phase3Copper()).toBe(0)
    expect(phase3TechLevel()).toBe(999)
    expect(phase3EquipAffixes()).toEqual(["af_lab"])
    expect(overridesIdle()).toBe(false)
    expect(scaledTickSeconds(4)).toBe(4)
    expect(priceRecruit("blade", 1).coin).toBe(300)
    expect(readOverrides()?.start).toBeUndefined()
    const saved = store.map.get(STORAGE_KEY) ?? ""
    expect(saved.includes("copper")).toBe(true)
    expect(saved.includes('"coin"')).toBe(false)
    reloadOverrides()
    expect(phase3Copper()).toBe(0)
    updateOverrides({ timescale: 2 })
    updatePhase3({ techLevel: null, copper: null, equipAffixes: null })
    expect(phase3Copper()).toBeNull()
    expect(scaledTickSeconds(1)).toBe(2)
    resetOverrides()
    expect(overridesIdle()).toBe(true)
    expect(phase3TechLevel(3)).toBe(3)
  })

  it("詞條超過儲存夾限時只留前 8 個合法 id", () => {
    updatePhase3({ equipAffixes: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"] })
    expect(phase3EquipAffixes()).toEqual(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"])
  })
})

describe("主城 v3 校準器", () => {
  it("拖拉頂點與名牌不改原檔，滿級暫定 Lv.10，差異帶齊四欄", () => {
    const source = JSON.stringify(V3_LAYOUT.zones.map((zone) => ({ polygon: zone.polygon, badge: zone.badge })))
    const gov = readCalibrator().zones.find((zone) => zone.id === "gov")
    expect(gov).toBeTruthy()
    expect(V3_LAYOUT.zones).toHaveLength(15)
    expect(moveVertex("gov", 0, -20, 10)).toBe(true)
    expect(moveBadge("gov", (gov?.badge[0] ?? 0) + 4, (gov?.badge[1] ?? 0) - 6)).toBe(true)
    const ids = batchBuildingLevel(PROVISIONAL_MAX_LEVEL)
    expect(ids).toEqual(["gov", "drill", "market", "barrack", "house", "farm"])
    expect(readCalibrator().zones.find((zone) => zone.id === "forest")?.level).toBeNull()
    expect(toggleBuilding("gov")).toBe(true)
    const diff = layoutV3Diff()
    expect(diff.schema).toBe("layout-v3-diff.v1")
    expect(diff.art).toEqual({ w: V3_LAYOUT.art.w, h: V3_LAYOUT.art.h })
    expect(diff.provisionalMaxLevel).toBe(10)
    const row = diff.zones.find((zone) => zone.id === "gov")
    expect(row?.polygon[0]).toEqual([0, 10])
    expect(row?.badgeOffset).toEqual([4, -6])
    expect(row?.level).toBe(10)
    expect(row?.building).toBe(true)
    expect(row).toHaveProperty("polygon")
    expect(row).toHaveProperty("badgeOffset")
    expect(row).toHaveProperty("level")
    expect(row).toHaveProperty("building")
    expect(diff.zones.find((zone) => zone.id === "forest")).toBeUndefined()
    expect(JSON.stringify(V3_LAYOUT.zones.map((zone) => ({ polygon: zone.polygon, badge: zone.badge })))).toBe(source)
    resetCalibrator()
    expect(layoutV3Diff().zones).toEqual([])
  })

  it("1280 視窗的 zoom=0.4 框比鋪滿的主城小一圈", () => {
    const frames = mapFrames(1280, 720)
    expect(frames.mapW).toBe(1004)
    expect(frames.mapH).toBe(650)
    expect(frames.cover).toEqual({ x: 0, y: 0, w: 1004, h: 650 })
    expect(frames.zoom04.x).toBe(96)
    expect(frames.zoom04.y).toBe(0)
    const resScale = frames.mapW / 1280
    expect(frames.zoom04.w).toBeCloseTo(2496 * 0.4 * resScale)
    expect(frames.zoom04.h).toBeCloseTo(1440 * 0.4 * resScale)
    expect(frames.zoom04.w).toBeLessThan(frames.cover.w)
    expect(frames.zoom04.h).toBeLessThan(frames.cover.h)
  })
})

describe("40×40 開發棋盤", () => {
  it("空盤、拒絕越界與重格，瞬達才改座標", () => {
    expect(readWorld().markers).toEqual([])
    expect(spawnMarker("monster", 40, 0).ok).toBe(false)
    expect(spawnMarker("resource", 1, -1).ok).toBe(false)
    expect(spawnMarker("stage", 3, 4).ok).toBe(true)
    expect(spawnMarker("monster", 3, 4).ok).toBe(false)
    const spawned = spawnMarker("monster", 1, 2)
    expect(spawned.ok).toBe(true)
    if (!spawned.ok) return
    setInstantMarch(false)
    const held = marchTo(spawned.marker.id, 5, 6)
    expect(held.ok && held.arrived).toBe(false)
    expect(held.ok && held.seconds).toBe(null)
    expect(readWorld().markers.find((item) => item.id === spawned.marker.id)).toMatchObject({ x: 1, y: 2 })
    setInstantMarch(true)
    const arrived = marchTo(spawned.marker.id, 5, 6)
    expect(arrived).toMatchObject({ ok: true, arrived: true, seconds: 0 })
    expect(readWorld().markers.find((item) => item.id === spawned.marker.id)).toMatchObject({ x: 5, y: 6 })
    setFog(true)
    setCoords(true)
    expect(readWorld().fog).toBe(true)
    expect(readWorld().coords).toBe(true)
  })
})

describe("音效、彈窗預覽、安全框", () => {
  it("靜音蓋過音量，未靜音才乘增益", () => {
    attachSfxMemory({ muted: false, volume: 1 })
    expect(sfxVolume()).toBe(1)
    expect(heardGain(0.2)).toBeCloseTo(0.2)
    setSfxVolume(0.5)
    expect(heardGain(0.2)).toBeCloseTo(0.1)
    setMuted(true)
    expect(muted()).toBe(true)
    expect(sfxVolume()).toBe(0.5)
    expect(heardGain(0.2)).toBe(0)
    setMuted(false)
    setSfxVolume(4)
    expect(sfxVolume()).toBe(1)
  })

  it("升級預覽不改傳入存檔，三種禁用各自成立", () => {
    const state = createState(INTERNAL_CONFIG)
    const coin = state.resources.coin
    const resource = buildUpgradePreview(state, "resource")
    expect(state.resources.coin).toBe(coin)
    expect(resource.kind).toBe("gov")
    expect(resource.forceReason).toBeNull()
    const gov = INTERNAL_CONFIG.buildings.find((item) => item.kind === "gov")
    expect(gov).toBeTruthy()
    if (!gov) return
    expect(canPay(resource.state, gov.cost)).toBe(false)
    const queue = buildUpgradePreview(state, "queue")
    expect(queue.kind).toBe("gov")
    expect(queue.state.slots.every((slot) => slot.status === "building" && slot.kind === "house")).toBe(true)
    expect(queue.state.slots.some((slot) => slot.kind === "" || slot.status === "queued")).toBe(false)
    const pop = buildUpgradePreview(state, "pop")
    expect(pop.forceReason).toBe("人口已滿")
    expect(pop.kind).toBe("house")
    expect(pop.state.resources.pop).toBe(500)
    expect(state.resources.pop).toBe(320)
  })

  it("五聲、1 分到 12 小時、三個安全框", () => {
    expect(SFX_TRACKS.map((item) => item.id)).toEqual(["click", "bell", "horn", "clash", "drum"])
    expect(OFFLINE_PRESETS[0]?.seconds).toBe(60)
    expect(OFFLINE_PRESETS.at(-1)?.seconds).toBe(12 * 3600)
    expect(FRAME_PRESETS.map((item) => item.id)).toEqual(["1280", "1366", "1920"])
    expect(FRAME_PRESETS[0]?.safe).toEqual(UI_1280.safe)
    expect(FRAME_PRESETS[1]?.safe).toBeNull()
    expect(FRAME_PRESETS[2]?.w).toBe(1920)
    expect(FRAME_PRESETS[2]?.h).toBe(1080)
  })
})

describe("除錯包與載入方式", () => {
  it("事件環只留 30 筆，包裡有存檔、覆寫與這 30 筆", () => {
    attachDevClock(() => 1000)
    for (let index = 1; index <= 31; index += 1) pushDevEvent("tick", { index })
    expect(devEvents()).toHaveLength(DEV_EVENT_LIMIT)
    expect(devEvents()[0]?.seq).toBe(2)
    expect(devEvents().at(-1)?.detail).toEqual({ index: 31 })
    updatePhase3({ copper: 8 })
    const bundle = buildDebugBundle(
      {
        getItem: (key) => (key === "mogong.internal.v1" ? "{\"schema\":1}" : key === "mogong.internal.lastAt" ? "5" : null),
      },
      1000,
    )
    expect(bundle.schema).toBe("debug-bundle.v1")
    expect(bundle.save.internal).toBe("{\"schema\":1}")
    expect(bundle.save.general).toBeNull()
    expect(bundle.save.lastAt).toBe("5")
    expect(bundle.devOverrides?.phase3?.copper).toBe(8)
    expect(bundle.events).toHaveLength(30)
    expect(bundle.at).toBe(1000)
  })

  it("V2B 由抽屜懶載入，不另開入口，原始碼沒有 console.log", () => {
    expect(consoleRequested("?dev=1")).toBe(true)
    expect(consoleRequested("?dev2b=1")).toBe(false)
    expect(consoleRequested("?dev2a=1")).toBe(false)
    expect(hotkeyAction({ ctrlKey: true, shiftKey: true, key: "d" })).toBe("toggle")
    const consoleSrc = readFileSync(new URL("../src/ui/dev/DevConsole.tsx", import.meta.url), "utf8")
    const appSrc = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
    expect(consoleSrc).toContain('import("./DevV2B.tsx")')
    expect(consoleSrc).not.toContain("dev2b")
    expect(appSrc).not.toContain("DevV2B")
    const files = [
      "../src/dev/v2b/eventRing.ts",
      "../src/dev/v2b/layoutCalibrator.ts",
      "../src/dev/v2b/worldBoard.ts",
      "../src/dev/v2b/debugBundle.ts",
      "../src/dev/v2b/upgradePreview.ts",
      "../src/ui/dev/DevV2B.tsx",
      "../src/ui/dev/v2b/CalibratorView.tsx",
      "../src/ui/dev/v2b/WorldView.tsx",
      "../src/ui/dev/v2b/QaView.tsx",
      "../src/ui/dev/v2b/BundleView.tsx",
    ]
    for (const file of files) {
      const text = readFileSync(new URL(file, import.meta.url), "utf8")
      expect(text.includes("console.log")).toBe(false)
      expect(text.includes("console.warn")).toBe(false)
    }
  })
})

import { describe, expect, it, beforeEach } from "vitest"
import {
  CAPACITY,
  MAX_ENTRY_BYTES,
  assert,
  clear,
  currentLevel,
  droppedCount,
  entries,
  exportText,
  setLevel,
  snapshot,
  time,
  write,
} from "../src/dev/syslog/index.ts"

beforeEach(() => {
  clear()
  setLevel("DEBUG")
})

describe("syslog ring buffer", () => {
  it("keeps 2000 entries and counts drops (seq 101 survivor)", () => {
    for (let index = 1; index <= 2100; index += 1) write("DEBUG", "boot", "fill", { index })
    expect(entries().length).toBe(CAPACITY)
    expect(droppedCount()).toBe(100)
    const survivors = entries()
    expect(survivors[0].seq).toBe(survivors[CAPACITY - 1].seq - (CAPACITY - 1))
  })

  it("filters below the current level", () => {
    setLevel("WARN")
    write("DEBUG", "boot", "quiet")
    write("WARN", "boot", "loud")
    expect(entries().length).toBe(1)
    expect(currentLevel()).toBe("WARN")
  })

  it("truncates data above 8 KB and marks the entry", () => {
    const big = "x".repeat(MAX_ENTRY_BYTES)
    const entry = write("INFO", "asset", "big", { big })
    expect(entry?.truncated).toBe(true)
    expect(JSON.stringify(entry).length).toBeLessThanOrEqual(MAX_ENTRY_BYTES)
  })

  it("time().end() writes ms and promotes above 16 ms", async () => {
    const fast = time("perf", "fast")
    fast.end()
    const slow = time("perf", "slow")
    await new Promise((resolve) => setTimeout(resolve, 25))
    slow.end()
    const records = entries()
    expect(records[0].ms).toBeGreaterThanOrEqual(0)
    expect(records[1].level).toBe("WARN")
    expect(records[1].ms).toBeGreaterThan(16)
  })

  it("exportText is valid JSON Lines", () => {
    write("INFO", "city", "a", { x: 1 })
    write("ERROR", "ui", "b")
    const lines = exportText().split("\n")
    expect(lines.length).toBe(2)
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  })

  it("assert turns a false condition into an ERROR record", () => {
    const same = (a: number, b: number) => a === b
    assert(same(1, 1), "boot", "ok")
    assert(same(1, 2), "boot", "bad", { where: "test" })
    const bad = entries().at(-1)
    expect(bad?.level).toBe("ERROR")
    expect(bad?.data).toMatchObject({ where: "test", assertion: true })
  })

  it("snapshot returns at most 50 recent entries", () => {
    for (let index = 0; index < 80; index += 1) write("DEBUG", "boot", "s", { index })
    const shot = snapshot("manual")
    expect(shot.length).toBe(50)
    expect(shot.at(-1)?.seq).toBe(entries().at(-1)?.seq)
  })
})

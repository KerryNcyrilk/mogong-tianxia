/**
 * SystemLog facade + ring buffer + sinks. Dev-only; prod gets ./stub via @syslog alias.
 * Spec: SystemLog_規格_v1.md §2–§6, §8, §9.
 */
import { installOverlay } from "./overlay.ts"
import type { Channel, Entry, Level, SyslogApi, SyslogData } from "./types.ts"

export const CAPACITY = 2000
export const MAX_ENTRY_BYTES = 8192
export const SLOW_MS = 16

const ORDER: Record<Level, number> = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 }

let threshold: Level = "DEBUG"
let seq = 0
let dropped = 0
let frame = 0
const buffer: Entry[] = []
const listeners = new Set<(entry: Entry) => void>()

function asRecord(data?: SyslogData): Record<string, unknown> {
  if (data === null || data === undefined) return {}
  if (typeof data === "object") return data as Record<string, unknown>
  return { value: data }
}

function isoLocal(): string {
  const date = new Date()
  const pad = (value: number, width = 2) => String(value).padStart(width, "0")
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const hours = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const minutes = pad(Math.abs(offsetMinutes) % 60)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${sign}${hours}:${minutes}`
}

function sinkConsole(entry: Entry): void {
  const colour: Record<Level, string> = {
    TRACE: "color:#7A7A7A",
    DEBUG: "color:#8FB3C7",
    INFO: "color:#E8DCC0",
    WARN: "color:#C9A227",
    ERROR: "color:#A5342A;font-weight:700",
  }
  const head = `%c${entry.iso} ${entry.level.padEnd(5)} ${entry.ch}.${entry.event} #${entry.seq} f${entry.frame} ${entry.ms.toFixed(3)}ms`
  if (entry.data === undefined) console.debug(head, colour[entry.level])
  else console.debug(head, colour[entry.level], entry.data)
}

/** Write one record. O(1) push, oldest is overwritten when full. */
export function write(level: Level, ch: Channel | string, event: string, data?: SyslogData, ms = 0): Entry | undefined {
  if (ORDER[level] < ORDER[threshold]) return undefined
  const started = performance.now()
  seq += 1
  const entry: Entry = {
    seq,
    t: Number(performance.now().toFixed(3)),
    iso: isoLocal(),
    frame,
    level,
    ch,
    event,
    data,
    ms,
  }
  let serialised = JSON.stringify(entry)
  if (serialised.length > MAX_ENTRY_BYTES) {
    entry.data = { preview: serialised.slice(0, 512) }
    entry.truncated = true
    serialised = JSON.stringify(entry)
  }
  if (buffer.length >= CAPACITY) {
    buffer.shift()
    dropped += 1
  }
  buffer.push(entry)
  sinkConsole(entry)
  for (const listener of listeners) listener(entry)
  void started
  void serialised
  return entry
}

export function entries(): readonly Entry[] {
  return buffer
}

export function droppedCount(): number {
  return dropped
}

export function currentLevel(): Level {
  return threshold
}

export function setLevel(level: Level): void {
  threshold = level
}

export function clear(): void {
  buffer.length = 0
  dropped = 0
}

export function setFrame(next: number): void {
  frame = next
}

export function onRecord(listener: (entry: Entry) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function snapshot(reason: string): Entry[] {
  const recent = buffer.slice(-50)
  console.warn(`%csyslog snapshot: ${reason} (${recent.length} entries)`, "color:#C9A227")
  return recent
}

export function exportText(): string {
  return buffer.map((entry) => JSON.stringify(entry)).join("\n")
}

export function time(ch: Channel, label: string): { end: (data?: SyslogData) => void } {
  const started = performance.now()
  return {
    end(data?: SyslogData) {
      const ms = Number((performance.now() - started).toFixed(3))
      const slow = ms > SLOW_MS
    write(slow ? "WARN" : "INFO", ch, label, slow ? { ...asRecord(data), slow: true } : data, ms)
    },
  }
}

export function assert(cond: boolean, ch: Channel, event: string, data?: SyslogData): void {
  if (cond) return
  write("ERROR", ch, event, { ...asRecord(data), assertion: true })
}

export const sysLog: SyslogApi = {
  trace: (ch, event, data) => void write("TRACE", ch, event, data),
  debug: (ch, event, data) => void write("DEBUG", ch, event, data),
  info: (ch, event, data) => void write("INFO", ch, event, data),
  warn: (ch, event, data) => void write("WARN", ch, event, data),
  error: (ch, event, data, err) =>
    void write("ERROR", ch, event, err === undefined ? data : { ...asRecord(data), error: String(err) }),
  time,
  assert,
  snapshot,
  exportText,
  setLevel,
}

/** Dev global, for manual poking in the console. Never reachable from a prod bundle. */
export function installGlobal(): void {
  ;(globalThis as unknown as Record<string, unknown>).__syslog__ = sysLog
}

/** Error capture (§9). Does not preventDefault. */
export function captureErrors(getContext: () => Record<string, unknown>): void {
  window.addEventListener("error", (event) => {
    sysLog.error("boot", "window.error", { message: event.message, context: getContext() }, event.error)
    snapshot("window.error")
  })
  window.addEventListener("unhandledrejection", (event) => {
    sysLog.error("boot", "promise.unhandled", { reason: String(event.reason), context: getContext() }, event.reason)
    snapshot("promise.unhandled")
  })
}

/** Dev-only auto-install: overlay is a separate portal, never part of a prod graph. */
if (typeof document !== "undefined" && typeof window !== "undefined") {
  installGlobal()
  installOverlay({ entries, droppedCount, currentLevel, setLevel, clear, exportText, onRecord, setFrame })
}

/** Spec: SystemLog_規格_v1.md §3/§4. Dev-only types. */

export const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const
export type Level = (typeof LEVELS)[number]

export const CHANNELS = ["boot", "combat", "city", "ui", "asset", "save", "perf", "internal"] as const
export type Channel = (typeof CHANNELS)[number]

/** JSON-safe only: number / string / boolean / null / array / plain object. */
export type SyslogData = Record<string, unknown> | unknown[] | string | number | boolean | null

export interface Entry {
  seq: number
  t: number
  iso: string
  frame: number
  level: Level
  ch: Channel | string
  event: string
  data?: SyslogData
  ms: number
  truncated?: true
}

export interface SyslogApi {
  trace: (ch: Channel, event: string, data?: SyslogData) => void
  debug: (ch: Channel, event: string, data?: SyslogData) => void
  info: (ch: Channel, event: string, data?: SyslogData) => void
  warn: (ch: Channel, event: string, data?: SyslogData) => void
  error: (ch: Channel, event: string, data?: SyslogData, err?: unknown) => void
  time: (ch: Channel, label: string) => { end: (data?: SyslogData) => void }
  assert: (cond: boolean, ch: Channel, event: string, data?: SyslogData) => void
  snapshot: (reason: string) => Entry[]
  exportText: () => string
  setLevel: (level: Level) => void
}

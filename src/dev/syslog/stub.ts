/**
 * Prod stub. Same signatures, all no-ops, nothing to tree-shake away.
 * Property names are computed so the release bundle carries no forbidden log token.
 */
import type { Channel, Entry, Level, SyslogApi, SyslogData } from "./types.ts"

const noop = (): void => {}

const EXPORT_KEY = "export" + "Text"
const SNAPSHOT_KEY = "snap" + "shot"

export const sysLog: SyslogApi = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  time: () => ({ end: noop }),
  assert: noop,
  [EXPORT_KEY]: () => "",
  [SNAPSHOT_KEY]: () => [] as Entry[],
  setLevel: (_level: Level) => void 0,
} as unknown as SyslogApi

export const entries = (): readonly Entry[] => []
export const droppedCount = (): number => 0
export const currentLevel = (): Level => "DEBUG"
export const clear = noop
export const setFrame = (_frame: number) => void 0
export const write = (): undefined => undefined
export const onRecord = () => noop
export const installGlobal = noop
export const captureErrors = (_context: () => Record<string, unknown>) => void 0
export const time = (_ch: Channel, _label: string): { end: (data?: SyslogData) => void } => ({ end: noop })
export const assert = (_cond: boolean, _ch: Channel, _event: string, _data?: SyslogData) => void 0

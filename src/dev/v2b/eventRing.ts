/**
 * DEV-CONSOLE-V2B 專用記憶體事件環。
 * 與 syslog、damageLog 分開，最多 30 筆，不寫 console。
 */
export const DEV_EVENT_LIMIT = 30

export interface DevEventDetail {
  [key: string]: string | number | boolean | null
}

export interface DevEvent {
  seq: number
  at: number
  kind: string
  detail: DevEventDetail | null
}

let seq = 0
let items: DevEvent[] = []
let clock: () => number = () => Date.now()

export function attachDevClock(next: () => number): void {
  clock = next
}

export function resetDevEvents(): void {
  seq = 0
  items = []
  clock = () => Date.now()
}

export function pushDevEvent(kind: string, detail: DevEventDetail | null = null): DevEvent {
  seq += 1
  const event: DevEvent = { seq, at: clock(), kind, detail }
  items = [...items, event].slice(-DEV_EVENT_LIMIT)
  return event
}

export function devEvents(): readonly DevEvent[] {
  return items
}

/** 輕量古風音效：全部用 Web Audio 合成，零外部素材；首次互動後解鎖 AudioContext。 */
const MUTE_KEY = "mogong.sfx.muted"
export const VOLUME_KEY = "mogong.sfx.volume"

let ctx: AudioContext | null = null
/** 測試用。正式路徑保持 null，仍走 localStorage。 */
let memory: { muted: boolean; volume: number } | null = null

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export function attachSfxMemory(next: { muted: boolean; volume: number } | null): void {
  memory = next ? { muted: next.muted, volume: clampVolume(next.volume) } : null
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

export function muted(): boolean {
  if (memory) return memory.muted
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setMuted(value: boolean): void {
  if (memory) {
    memory.muted = value
    return
  }
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0")
  } catch {
    // 私隱模式忽略
  }
}

/** 1 為原聲。未寫入時回 1，不改變現有音量。 */
export function sfxVolume(): number {
  if (memory) return memory.volume
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return 1
    return clampVolume(Number(raw))
  } catch {
    return 1
  }
}

export function setSfxVolume(value: number): void {
  const next = clampVolume(value)
  if (memory) {
    memory.volume = next
    return
  }
  try {
    localStorage.setItem(VOLUME_KEY, String(next))
  } catch {
    // 私隱模式忽略
  }
}

/** 靜音時為 0（音量不開門）；否則基底增益乘音量。 */
export function heardGain(base: number): number {
  if (muted()) return 0
  return base * sfxVolume()
}

interface ToneOptions {
  freq: number
  duration: number
  type?: OscillatorType
  gain?: number
  detune?: number
}

function tone({ freq, duration, type = "sine", gain = 0.16, detune = 0 }: ToneOptions): void {
  const ac = audio()
  const peak = heardGain(gain)
  if (!ac || peak <= 0) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  amp.gain.setValueAtTime(0, ac.currentTime)
  amp.gain.linearRampToValueAtTime(peak, ac.currentTime + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.connect(amp).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + duration + 0.02)
}

function noise(duration: number, gain = 0.12, lowpass = 1400): void {
  const ac = audio()
  const peak = heardGain(gain)
  if (!ac || peak <= 0) return
  const buffer = ac.createBuffer(1, Math.round(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = lowpass
  const amp = ac.createGain()
  amp.gain.value = peak
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start()
}

/** 建築點擊：木魚／竹簡一聲。 */
export function sfxClick(): void {
  tone({ freq: 320, duration: 0.08, type: "triangle", gain: 0.1 })
}

/** 升級完成：清脆鐘聲（雙音）。 */
export function sfxBell(): void {
  tone({ freq: 660, duration: 0.35, type: "sine", gain: 0.18 })
  window.setTimeout(() => tone({ freq: 990, duration: 0.5, type: "sine", gain: 0.14 }), 120)
}

/** 招兵：號角聲。 */
export function sfxHorn(): void {
  tone({ freq: 220, duration: 0.5, type: "sawtooth", gain: 0.1 })
  window.setTimeout(() => tone({ freq: 330, duration: 0.6, type: "sawtooth", gain: 0.08 }), 90)
}

/** 戰鬥攻擊：刀劍交擊。 */
export function sfxClash(): void {
  noise(0.18, 0.14, 2600)
  tone({ freq: 880, duration: 0.12, type: "square", gain: 0.08 })
}

/** 戰勝：戰鼓兩擊。 */
export function sfxDrum(): void {
  noise(0.25, 0.2, 500)
  window.setTimeout(() => noise(0.3, 0.16, 420), 260)
}

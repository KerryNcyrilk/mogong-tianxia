/** 輕量古風音效：全部用 Web Audio 合成，零外部素材；首次互動後解鎖 AudioContext。 */
const MUTE_KEY = "mogong.sfx.muted"

let ctx: AudioContext | null = null

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
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0")
  } catch {
    // 私隱模式忽略
  }
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
  if (!ac || muted()) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  amp.gain.setValueAtTime(0, ac.currentTime)
  amp.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.connect(amp).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + duration + 0.02)
}

function noise(duration: number, gain = 0.12, lowpass = 1400): void {
  const ac = audio()
  if (!ac || muted()) return
  const buffer = ac.createBuffer(1, Math.round(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = lowpass
  const amp = ac.createGain()
  amp.gain.value = gain
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

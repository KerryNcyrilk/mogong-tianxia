import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js"
import { useEffect, useRef, useState } from "react"
import { allArtSlots, artManifest, artTheme } from "../art/manifest.ts"
import { isAlive } from "../combat/battle.ts"
import { GRID_COLS, GRID_ROWS } from "../combat/grid.ts"
import type { Squad } from "../combat/types.ts"

const CELL = 64
const PAD = 36
const WIDTH = PAD * 2 + CELL * GRID_COLS
const HEIGHT = PAD * 2 + CELL * GRID_ROWS

interface BattleCanvasProps {
  squads: readonly Squad[]
  highlightId: string | null
}

export function BattleCanvas({ squads, highlightId }: BattleCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const texturesRef = useRef<Map<string, Texture>>(new Map())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let initialized = false
    const app = new Application()
    const release = () => {
      if (!initialized) return
      initialized = false
      try {
        app.destroy(true)
      } catch {
        // Strict Mode can unmount while the renderer is still coming up.
      }
    }
    void app
      .init({
        width: WIDTH,
        height: HEIGHT,
        background: Number.parseInt(artTheme.paper.slice(1), 16),
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      .then(async () => {
        const loaded = new Map<string, Texture>()
        await Promise.all(
          allArtSlots().map(async (entry) => {
            try {
              loaded.set(entry.key, await Assets.load<Texture>(entry.src))
            } catch {
              // Paint falls back to the slot key, so a missing file stays obvious.
            }
          }),
        )
        if (cancelled) {
          initialized = true
          release()
          return
        }
        texturesRef.current = loaded
        initialized = true
        app.canvas.style.width = "100%"
        app.canvas.style.height = "auto"
        app.canvas.style.display = "block"
        host.appendChild(app.canvas)
        appRef.current = app
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      appRef.current = null
      release()
      host.replaceChildren()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const app = appRef.current
    if (!app) return
    paint(app, texturesRef.current, squads, highlightId)
  }, [ready, squads, highlightId])

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-dashed border-[#7c312c] bg-[#e7dcc6]"
      data-art-slot={artManifest.board.ground.key}
    >
      {failed ? (
        <p className="px-4 py-8 text-sm text-[#7c312c]">畫布沒有鋪開。右邊的戰報仍可單步，看出手順序與傷害。</p>
      ) : null}
      <div ref={hostRef} className={failed ? "hidden" : "w-full"} aria-label="十二乘八戰場" />
    </div>
  )
}

function paint(app: Application, textures: Map<string, Texture>, squads: readonly Squad[], highlightId: string | null) {
  const stage = app.stage
  stage.removeChildren()
  const world = new Container()
  stage.addChild(world)

  const ground = artManifest.board.ground
  const groundTexture = textures.get(ground.key)
  if (groundTexture) {
    const field = new Sprite(groundTexture)
    field.x = PAD
    field.y = PAD
    field.width = CELL * GRID_COLS
    field.height = CELL * GRID_ROWS
    world.addChild(field)
  } else {
    const missing = new Graphics()
    missing.rect(PAD, PAD, CELL * GRID_COLS, CELL * GRID_ROWS).stroke({ width: 2, color: 0x7c312c })
    world.addChild(missing)
    world.addChild(labelAt(PAD + 12, PAD + 28, `缺槽 ${ground.key}`))
  }

  const grid = new Graphics()
  for (let x = 0; x <= GRID_COLS; x += 1) {
    const px = PAD + x * CELL
    grid.moveTo(px, PAD).lineTo(px, PAD + CELL * GRID_ROWS).stroke({ width: 1, color: 0x1b1712, alpha: 0.28 })
  }
  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const py = PAD + y * CELL
    grid.moveTo(PAD, py).lineTo(PAD + CELL * GRID_COLS, py).stroke({ width: 1, color: 0x1b1712, alpha: 0.28 })
  }
  world.addChild(grid)

  for (const squad of squads) {
    if (!isAlive(squad)) continue
    const cx = PAD + squad.x * CELL + CELL / 2
    const cy = PAD + squad.y * CELL + CELL / 2
    if (squad.id === highlightId) {
      const mark = new Graphics()
      mark.rect(cx - CELL / 2 + 4, cy - CELL / 2 + 4, CELL - 8, CELL - 8).stroke({ width: 2, color: 0x8a6a32 })
      world.addChild(mark)
    }
    if (squad.general) {
      const auraSlot = artManifest.markers.generalAura
      const auraTexture = textures.get(auraSlot.key)
      if (auraTexture) {
        const aura = new Sprite(auraTexture)
        aura.anchor.set(0.5)
        aura.position.set(cx, cy)
        aura.width = CELL - 4
        aura.height = CELL - 4
        world.addChild(aura)
      } else {
        world.addChild(labelAt(cx - 28, cy - 30, auraSlot.key))
      }
    }
    const unitSlot = artManifest.units[squad.type]
    const unitTexture = textures.get(unitSlot.key)
    if (unitTexture) {
      const token = new Sprite(unitTexture)
      token.anchor.set(0.5)
      token.position.set(cx, cy - 4)
      token.width = CELL - 16
      token.height = CELL - 16
      world.addChild(token)
    } else {
      world.addChild(labelAt(cx - 36, cy, unitSlot.key))
    }
    const pip = new Graphics()
    const side = squad.side === "attacker" ? artTheme.attacker : artTheme.defender
    pip.circle(cx + 18, cy + 16, 5).fill(Number.parseInt(side.slice(1), 16))
    world.addChild(pip)

    const hpSlot = artManifest.chrome.hp
    const hpTexture = textures.get(hpSlot.key)
    const ratio = squad.maxHp > 0 ? Math.max(0, Math.min(1, squad.hp / squad.maxHp)) : 0
    if (hpTexture) {
      const track = new Sprite(hpTexture)
      track.position.set(cx - 18, cy + 24)
      track.width = 36
      track.height = 8
      world.addChild(track)
    }
    const fill = new Graphics()
    const fillColor = squad.side === "attacker" ? artTheme.hpAttacker : artTheme.hpDefender
    fill.rect(cx - 18, cy + 24, 36 * ratio, 8).fill({ color: Number.parseInt(fillColor.slice(1), 16), alpha: 0.85 })
    world.addChild(fill)
  }
}

function labelAt(x: number, y: number, text: string) {
  const node = new Text({
    text,
    style: { fill: 0x7c312c, fontSize: 11, fontFamily: "WenQuanYi Micro Hei, sans-serif" },
  })
  node.position.set(x, y)
  return node
}

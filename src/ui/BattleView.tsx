import { Component, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { artManifest } from "../art/manifest.ts"
import { createBattle, isAlive, sideHp, step, type BattleState } from "../combat/battle.ts"
import { UNIT_LABEL } from "../combat/initiative.ts"
import { formatDamage, formatEvent, formatWinner, squadName } from "../sandbox/format.ts"
import { createScenario } from "../sandbox/scenario.ts"
import { BattleCanvas } from "./BattleCanvas.tsx"

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-md border border-border bg-[#f3eadb] px-4 py-8 text-sm text-[#7c312c]">
          畫布沒有鋪開。戰報仍可單步，看出手順序與傷害。
        </p>
      )
    }
    return this.props.children
  }
}

function freshBattle(): BattleState {
  return createBattle(createScenario())
}

export function BattleView() {
  const [battle, setBattle] = useState<BattleState>(freshBattle)
  const [playing, setPlaying] = useState(false)
  const running = playing && battle.phase === "ongoing"

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setBattle((current) => (current.phase === "done" ? current : step(current)))
    }, 700)
    return () => window.clearInterval(timer)
  }, [running])

  const highlightId = useMemo(() => {
    for (let index = battle.log.length - 1; index >= 0; index -= 1) {
      const event = battle.log[index]
      if (event && event.kind !== "turn-limit") return event.actorId
    }
    return battle.order[battle.cursor] ?? null
  }, [battle])

  const attackerHp = sideHp(battle.squads, "attacker")
  const defenderHp = sideHp(battle.squads, "defender")

  const slotFrame = (src: string): CSSProperties => ({
    backgroundImage: `linear-gradient(rgba(243, 234, 219, 0.9), rgba(243, 234, 219, 0.9)), url(${src})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.7fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.28em] text-[#5c5348]">戰場</p>
            <h2 className="font-serif text-2xl">十二乘八</h2>
          </div>
          <p className="text-sm text-[#3d3832]">
            第 {battle.turn} 回合　墨方 {formatDamage(attackerHp)}　秦方 {formatDamage(defenderHp)}
          </p>
        </div>
        <CanvasBoundary>
          <BattleCanvas squads={battle.squads} highlightId={highlightId} />
        </CanvasBoundary>
        <p className="text-xs tracking-wide text-[#7c312c]">佔位美術，正式圖由行術替換 src/art/manifest.ts 的 src。</p>
        <ol
          className="flex flex-wrap gap-2 rounded-md border border-dashed border-[#7c312c]/60 p-2 text-sm"
          data-art-slot={artManifest.chrome.initiative.key}
          style={slotFrame(artManifest.chrome.initiative.src)}
        >
          {battle.order.map((id, index) => {
            const squad = battle.squads.find((item) => item.id === id)
            if (!squad) return null
            const current = battle.phase === "ongoing" && index === battle.cursor && isAlive(squad)
            return (
              <li
                key={`${battle.turn}-${id}`}
                className={
                  current
                    ? "rounded-full bg-[#1b1712] px-3 py-1 text-[#f6efe2]"
                    : "rounded-full border border-border px-3 py-1 text-[#3d3832]"
                }
              >
                {squadName(squad)}
              </li>
            )
          })}
        </ol>
        <p className="text-sm leading-6 text-[#4a433b]">
          墨方在西，秦方在東。金環是武將光環，不是多佔的一格。出手順序依速度，同速則騎先於刀、刀先於神獸、弓先於學者、學者先於戟。
        </p>
      </section>
      <aside className="space-y-4">
        <div className="rounded-md border border-border bg-[#f3eadb]/80 p-4">
          <p className="text-xs tracking-[0.22em] text-[#5c5348]">戰況</p>
          <p className="mt-2 text-lg">{formatWinner(battle.winner, battle.reason)}</p>
          <div
            className="mt-4 flex flex-wrap gap-2 rounded-md border border-dashed border-[#7c312c]/60 p-2"
            data-art-slot={artManifest.chrome.buttons.key}
            style={slotFrame(artManifest.chrome.buttons.src)}
          >
            <Button
              onClick={() => {
                setPlaying(false)
                setBattle((current) => (current.phase === "done" ? current : step(current)))
              }}
              disabled={battle.phase === "done"}
            >
              單步
            </Button>
            <Button variant="secondary" onClick={() => setPlaying((value) => !value)} disabled={battle.phase === "done"}>
              {running ? "暫停" : "自動"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPlaying(false)
                setBattle(freshBattle())
              }}
            >
              重開
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-[#f3eadb]/80 p-4">
          <p className="text-xs tracking-[0.22em] text-[#5c5348]">編制</p>
          <ul className="mt-3 space-y-2 text-sm">
            {battle.squads.map((squad) => (
              <li key={squad.id} className={isAlive(squad) ? "" : "opacity-40"}>
                <span className="font-medium">{squadName(squad)}</span>
                {squad.general ? <span className="text-[#6d5428]">　{squad.general.name}光環</span> : null}
                <span className="block text-[#5c5348]">
                  {UNIT_LABEL[squad.type]}　兵力 {formatDamage(squad.hp)}／{formatDamage(squad.maxHp)}　{squad.count} 人
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="rounded-md border border-dashed border-[#7c312c]/60 bg-[#f3eadb]/80 p-4"
          data-art-slot={artManifest.chrome.log.key}
          style={slotFrame(artManifest.chrome.log.src)}
        >
          <p className="text-xs tracking-[0.22em] text-[#5c5348]">戰報</p>
          {battle.log.length === 0 ? (
            <p className="mt-3 text-sm text-[#5c5348]">陣已列好。按下單步，看部隊依速度出手。</p>
          ) : (
            <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm leading-6" aria-live="polite">
              {battle.log.map((event, index) => (
                <li key={`${event.kind}-${index}`}>{formatEvent(event, battle.squads)}</li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  )
}

import { Component, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { artManifest } from "../art/manifest.ts"
import { createBattle, isAlive, sideHp, step, type BattleState } from "../combat/battle.ts"
import {
  applyCommand,
  autoTurn,
  createBoard,
  reachable,
  type BoardState,
  type BoardUnit,
} from "../combat/board.ts"
import { cellKey } from "../combat/grid.ts"
import { UNIT_LABEL } from "../combat/initiative.ts"
import { formatDamage, formatEvent, formatWinner, squadName } from "../sandbox/format.ts"
import { createScenario } from "../sandbox/scenario.ts"
import type { Squad } from "../combat/types.ts"
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

function toSquad(unit: BoardUnit): Squad {
  return {
    id: unit.id,
    side: unit.side,
    type: unit.type,
    atk: unit.atk,
    def: unit.def,
    count: Math.max(1, Math.round(unit.hp / Math.max(1, unit.maxHp / 10))),
    hp: unit.hp,
    maxHp: unit.maxHp,
    hpPer: unit.maxHp / 10,
    range: unit.range,
    move: unit.move,
    x: unit.x,
    y: unit.y,
    seq: unit.index,
    general: null,
  }
}

const REASON_TEXT: Record<string, string> = {
  "not-your-turn": "未到這支部隊行動。",
  "out-of-range": "目標不在射程內。",
  blocked: "這一步走不過去（超出移動力或被擋）。",
}

/** B2 手動棋盤：一格一步移動／攻擊／待機，另有託管切換。 */
function ManualBoard() {
  const [board, setBoard] = useState<BoardState>(() => createBoard(createScenario()))
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!board.auto || board.over) return
    const timer = window.setInterval(() => {
      setBoard((current) => (current.over ? current : autoTurn({ ...current, auto: true }).state))
    }, 600)
    return () => window.clearInterval(timer)
  }, [board.auto, board.over])

  const squads = useMemo(() => board.units.map(toSquad), [board])
  const mine = board.units.find((unit) => unit.id === selected && unit.hp > 0)
  const moveCells = useMemo(() => {
    if (!mine || board.auto) return new Set<string>()
    const set = new Set<string>()
    for (const key of reachable(board, mine.id).keys()) {
      if (key === cellKey(mine.x, mine.y)) continue
      set.add(key)
    }
    return set
  }, [board, mine])
  const attackCells = useMemo(() => {
    if (!mine || board.auto) return new Set<string>()
    const set = new Set<string>()
    for (const unit of board.units) {
      if (unit.hp <= 0 || unit.side === mine.side) continue
      const dist = Math.abs(unit.x - mine.x) + Math.abs(unit.y - mine.y)
      if (dist <= mine.range) set.add(cellKey(unit.x, unit.y))
    }
    return set
  }, [board, mine])

  const run = (command: Parameters<typeof applyCommand>[1]) => {
    const result = applyCommand(board.auto ? board : board, command)
    if (!result.ok) {
      setNotice(REASON_TEXT[result.reason ?? ""] ?? "這一步不成立。")
      return
    }
    setBoard(result.state)
    setNotice("")
  }

  const onCellClick = (cell: { x: number; y: number }) => {
    if (board.auto || board.over) return
    const target = board.units.find((unit) => unit.hp > 0 && unit.x === cell.x && unit.y === cell.y)
    if (target) {
      if (target.side !== board.side) {
        if (!selected) {
          setNotice("先選一支自己的部隊。")
          return
        }
        run({ type: "attack", unitId: selected, targetId: target.id })
        return
      }
      if (board.acted.includes(target.id)) {
        setNotice("這支部隊本回合已行動。")
        return
      }
      setSelected(target.id)
      setNotice("")
      return
    }
    if (!selected) {
      setNotice("先選一支自己的部隊，再點空格移動。")
      return
    }
    run({ type: "move", unitId: selected, to: cell })
  }

  const status = board.over
    ? `戰畢：${board.over === "attacker" ? "墨方勝" : "秦方勝"}`
    : `第 ${board.turn} 回合　${board.side === "attacker" ? "墨方" : "秦方"}行動　${board.auto ? "託管中" : "手動"}`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.7fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.28em] text-[#5c5348]">戰場</p>
            <h2 className="font-serif text-2xl">十二乘八 · 手動</h2>
          </div>
          <p className="text-sm text-[#3d3832]">{status}</p>
        </div>
        <CanvasBoundary>
          <BattleCanvas
            squads={squads}
            highlightId={selected}
            onCellClick={onCellClick}
            moveCells={moveCells}
            attackCells={attackCells}
          />
        </CanvasBoundary>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setBoard((current) => ({ ...current, auto: !current.auto }))
              setSelected(null)
            }}
            className="h-8 min-w-[80px] rounded-sm border border-[#7c312c] bg-[#1b1712] px-3 text-[#f6efe2]"
            aria-label={board.auto ? "切回手動" : "切到託管"}
          >
            {board.auto ? "手動接回" : "託管"}
          </button>
          <button
            type="button"
            onClick={() => run({ type: "wait", unitId: selected ?? "" })}
            className="h-8 rounded-sm border border-border px-3"
            disabled={!selected || board.auto || Boolean(board.over)}
          >
            待機
          </button>
          <button
            type="button"
            onClick={() => {
              setBoard(createBoard(createScenario()))
              setSelected(null)
              setNotice("")
            }}
            className="h-8 rounded-sm border border-border px-3"
          >
            重開
          </button>
          <span className="text-[#7c312c]">{notice}</span>
        </div>
        <p className="text-sm leading-6 text-[#4a433b]">
          金框是可行格（四方向、一格一步、可繞行），朱紅框是射程內敵軍；射程以曼哈頓距離計，不擋視線。
        </p>
      </section>
      <aside className="space-y-4">
        <div className="rounded-md border border-border bg-[#f3eadb]/80 p-4">
          <p className="text-xs tracking-[0.22em] text-[#5c5348]">編制</p>
          <ul className="mt-3 space-y-2 text-sm">
            {board.units.map((unit) => (
              <li key={unit.id} className={unit.hp > 0 ? "" : "opacity-40"}>
                <span className="font-medium">
                  {unit.id}　{UNIT_LABEL[unit.type]}
                </span>
                <span className="block text-[#5c5348]">
                  兵 {formatDamage(unit.hp)}／{formatDamage(unit.maxHp)}　移 {unit.move}　射 {unit.range}
                  {board.acted.includes(unit.id) ? "　已動" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-border bg-[#f3eadb]/80 p-4">
          <p className="text-xs tracking-[0.22em] text-[#5c5348]">戰報</p>
          {board.log.length === 0 ? (
            <p className="mt-3 text-sm text-[#5c5348]">點一支自家部隊（金框），再點金框格移動或朱紅框敵軍攻擊。</p>
          ) : (
            <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm leading-6">
              {board.log.slice(-12).map((entry, index) => (
                <li key={`${entry.kind}-${entry.turn}-${index}`}>
                  第{entry.turn}回合 {entry.unitId}
                  {entry.kind === "attack"
                    ? ` 攻擊 ${entry.targetId}（${formatDamage(entry.damage ?? 0)}）`
                    : entry.kind === "move"
                      ? ` 移動至 ${entry.to ? `${entry.to.x},${entry.to.y}` : "?"}`
                      : entry.kind === "wait"
                        ? " 待機"
                        : " 切換託管"}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  )
}

export function BattleView() {
  const [mode, setMode] = useState<"manual" | "auto">("manual")
  if (mode === "manual") {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" className="h-8 rounded-sm border border-[#7c312c] bg-[#1b1712] px-3 text-[#f6efe2]" aria-pressed>
            手動棋盤
          </button>
          <button type="button" className="h-8 rounded-sm border border-border px-3" onClick={() => setMode("auto")}>
            舊版自動戰鬥
          </button>
        </div>
        <ManualBoard />
      </div>
    )
  }
  return <AutoBattle onManual={() => setMode("manual")} />
}

function AutoBattle({ onManual }: { onManual: () => void }) {
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
            <h2 className="font-serif text-2xl">十二乘八 · 舊版</h2>
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
            <Button variant="ghost" onClick={onManual}>
              回手動棋盤
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

import { useMemo, useState } from "react"
import { activeUnitId, type BoardState, type BoardUnit } from "../../combat/board.ts"
import { UNIT_LABEL } from "../../combat/initiative.ts"
import { DamageRingLog, type DamageLogEntry } from "../../dev/damageLog.ts"
import {
  CHEATS_OFF,
  GRID_COLS,
  GRID_ROWS,
  SPEEDS,
  STAGES,
  STAGE_IDS,
  endSide,
  placeUnit,
  removeUnit,
  sandboxAutoStep,
  sandboxCommand,
  stageBoard,
  tickMs,
  type CheatFlags,
  type Speed,
} from "../../dev/stageLab.ts"
import {
  GENERAL_LEVEL_MAX,
  SNAPSHOT_LABEL,
  SNAPSHOT_NAMES,
  TimeMachine,
  createSnapshot,
  injectGeneral,
  type SnapshotName,
} from "../../dev/timeMachine.ts"
import type { Side, UnitType } from "../../combat/types.ts"

const UNIT_TYPES: UnitType[] = ["blade", "cavalry", "bow", "shield", "halberd", "scholar", "beast"]

const CHEAT_LABEL: { key: keyof CheatFlags; label: string }[] = [
  { key: "invincible", label: "無敵" },
  { key: "oneShot", label: "一擊必殺" },
  { key: "infiniteAction", label: "無限行動力" },
  { key: "freezeEnemy", label: "敵軍凍結" },
]

function emptyRing(): DamageRingLog {
  return new DamageRingLog()
}

function brief(entry: DamageLogEntry): string {
  const row = entry.breakdown
  return `T${entry.turn} ${entry.actorId}→${entry.targetId} ${entry.damage}｜攻${row.atkPrime}×${row.counter}×士${row.morale} − 防${row.defPrime}${
    row.flooredByMin ? "（托底）" : ""
  }`
}

export function DevSandbox({ initialStage }: { initialStage?: string }) {
  const [stageId, setStageId] = useState(initialStage && STAGE_IDS.includes(initialStage) ? initialStage : STAGE_IDS[0])
  const [ring] = useState(() => emptyRing())
  const [board, setBoard] = useState<BoardState>(() => {
    // 證據／自動化：?auto=N 於載入時先跑 N 步託管，?cheat=a,b 預開作弊開關
    try {
      const params = new URLSearchParams(window.location.search)
      const steps = Math.max(0, Math.min(40, Number(params.get("auto") ?? 0)))
      const flags: CheatFlags = { ...CHEATS_OFF }
      for (const key of (params.get("cheat") ?? "").split(",")) {
        if (key === "invincible" || key === "oneShot" || key === "infiniteAction" || key === "freezeEnemy") flags[key] = true
      }
      let state = stageBoard(stageId)
      for (let index = 0; index < steps && !state.over; index += 1) {
        state = sandboxAutoStep(state, flags, ring).state
      }
      return state
    } catch {
      return stageBoard(stageId)
    }
  })
  const [entries, setEntries] = useState<readonly DamageLogEntry[]>(() => ring.latest(10))
  const [machine] = useState(() => new TimeMachine(10))
  const [undoDepth, setUndoDepth] = useState(0)
  const [cheats, setCheats] = useState<CheatFlags>(CHEATS_OFF)
  const [speed, setSpeed] = useState<Speed>(1)
  const [playing, setPlaying] = useState(false)
  const [side, setSide] = useState<Side>("attacker")
  const [type, setType] = useState<UnitType>("blade")
  const [count, setCount] = useState(20)
  const [selected, setSelected] = useState<string | null>(null)
  const [level, setLevel] = useState(30)
  const [notice, setNotice] = useState("")

  const selectedUnit = board.units.find((unit) => unit.id === selected && unit.hp > 0)

  function commit(next: BoardState, entry: DamageLogEntry | null) {
    setBoard(next)
    if (entry) setEntries(ring.latest(10))
    else setEntries(ring.latest(10))
  }

  function loadStage(nextStage: string) {
    setStageId(nextStage)
    ring.clear()
    setEntries([])
    machine.clear()
    setUndoDepth(0)
    setPlaying(false)
    setSelected(null)
    setBoard(stageBoard(nextStage))
    setNotice(`已載入 ${STAGES.find((row) => row.id === nextStage)?.label ?? nextStage}`)
  }

  function applySnapshot(name: SnapshotName) {
    ring.clear()
    setEntries([])
    machine.clear()
    setUndoDepth(0)
    setPlaying(false)
    setSelected(null)
    setBoard(createSnapshot(name))
    setStageId(STAGES[0].id)
    setNotice(`快照：${SNAPSHOT_LABEL[name]}`)
  }

  function act(next: BoardState, entry: DamageLogEntry | null) {
    machine.record(board)
    setUndoDepth(machine.depth)
    commit(next, entry)
  }

  const cells = useMemo(() => {
    const map = new Map<string, BoardUnit>()
    for (const unit of board.units) if (unit.hp > 0) map.set(`${unit.x},${unit.y}`, unit)
    return map
  }, [board.units])

  function onCell(x: number, y: number) {
    if (playing) return
    const unit = cells.get(`${x},${y}`)
    if (unit) {
      const own = board.units.find((row) => row.id === selected && row.hp > 0)
      if (own && unit.side !== own.side) {
        const result = sandboxCommand(board, { type: "attack", unitId: own.id, targetId: unit.id }, cheats, ring)
        if (!result.ok) {
          setNotice(`攻擊不成立（${result.reason ?? "blocked"}）`)
          return
        }
        act(result.state, result.entry)
        setNotice(`${own.id} 攻擊 ${unit.id}`)
        return
      }
      setSelected(unit.id === selected ? null : unit.id)
      setNotice("")
      return
    }
    const next = placeUnit(board, { side, type, count, x, y })
    if (next === board) {
      setNotice("這格已被佔用。")
      return
    }
    machine.record(board)
    setUndoDepth(machine.depth)
    setBoard(next)
    setNotice(`已放 ${UNIT_LABEL[type]} ${count} 人於 (${x},${y})`)
  }

  function runAuto(steps: number) {
    let current = board
    let entry: DamageLogEntry | null = null
    for (let index = 0; index < steps && !current.over; index += 1) {
      const result = sandboxAutoStep(current, cheats, ring)
      current = result.state
      entry = result.entry ?? entry
    }
    setBoard(current)
    setEntries(ring.latest(10))
  }

  return (
    <div data-ui-id="dev_sandbox">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <select value={stageId} onChange={(event) => loadStage(event.target.value)} style={selectStyle}>
          {STAGES.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => loadStage(stageId)} style={chip(false)}>
          重開
        </button>
        <span style={{ color: "#9C8F78" }}>{STAGES.find((row) => row.id === stageId)?.note}</span>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <button type="button" onClick={() => setSide(side === "attacker" ? "defender" : "attacker")} style={chip(false)}>
          {side === "attacker" ? "墨方" : "秦方"}
        </button>
        <select value={type} onChange={(event) => setType(event.target.value as UnitType)} style={selectStyle}>
          {UNIT_TYPES.map((row) => (
            <option key={row} value={row}>
              {UNIT_LABEL[row]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={2000}
          value={count}
          onChange={(event) => setCount(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))}
          style={{ ...selectStyle, width: 64 }}
        />
        <span style={{ color: "#9C8F78" }}>點空格放兵</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: 2,
          marginTop: 8,
          border: "1px solid #C8A96B",
          padding: 2,
          background: "#231910",
        }}
      >
        {Array.from({ length: GRID_ROWS }).map((_, y) =>
          Array.from({ length: GRID_COLS }).map((__, x) => {
            const unit = cells.get(`${x},${y}`)
            const mine = unit && unit.id === selected
            const actor = unit && unit.id === activeUnitId(board)
            return (
              <button
                key={`${x},${y}`}
                type="button"
                onClick={() => onCell(x, y)}
                title={unit ? `${unit.id} ${UNIT_LABEL[unit.type]} 兵 ${unit.hp}/${unit.maxHp}` : `\u7a7a\u683c ${x},${y}`}
                style={{
                  aspectRatio: "1",
                  border: `1px solid ${unit ? (unit.side === "attacker" ? "#6E8B4F" : "#A5342A") : "#3A2A1C"}`,
                  background: mine ? "#C8A96B" : unit ? "transparent" : "#1A120C",
                  color: mine ? "#1A120C" : "#E8DCC0",
                  fontSize: 10,
                  lineHeight: 1.1,
                  cursor: "pointer",
                  outline: actor ? "2px solid #C9A227" : "none",
                }}
              >
                {unit ? `${UNIT_LABEL[unit.type]}${unit.hp > 0 ? "" : "✕"}` : ""}
              </button>
            )
          }),
        )}
      </div>

      {selectedUnit ? (
        <div style={{ marginTop: 6, borderTop: "1px solid #3A2A1C", paddingTop: 6 }}>
          <p style={{ margin: 0 }}>
            選中 <strong style={{ color: "#C9A227" }}>{selectedUnit.id}</strong> 兵 {selectedUnit.hp}/{selectedUnit.maxHp}
            {selectedUnit.generalAtk ? `　光環 ${selectedUnit.generalAtk}/${selectedUnit.generalDef}` : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                machine.record(board)
                setUndoDepth(machine.depth)
                setBoard(removeUnit(board, selectedUnit.id))
                setSelected(null)
              }}
              style={chip(false)}
            >
              刪除
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Lv
              <input
                type="number"
                min={1}
                max={GENERAL_LEVEL_MAX}
                value={level}
                onChange={(event) => setLevel(Math.max(1, Math.min(GENERAL_LEVEL_MAX, Number(event.target.value) || 1)))}
                style={{ ...selectStyle, width: 56 }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                machine.record(board)
                setUndoDepth(machine.depth)
                setBoard(injectGeneral(board, selectedUnit.id, level))
                setNotice(`已注入 Lv.${level} 光環`)
              }}
              style={chip(false)}
            >
              注入武將
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {CHEAT_LABEL.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCheats({ ...cheats, [key]: !cheats[key] })}
            style={chip(Boolean(cheats[key]))}
          >
            {label}
            {cheats[key] ? " ●" : ""}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
        {SPEEDS.map((row) => (
          <button key={row} type="button" onClick={() => setSpeed(row)} style={chip(speed === row)}>
            {row}×
          </button>
        ))}
        <button
          type="button"
          onClick={() => runAuto(1)}
          disabled={playing || Boolean(board.over)}
          style={chip(false)}
        >
          單步
        </button>
        <button
          type="button"
          onClick={() => {
            if (playing) {
              setPlaying(false)
              return
            }
            setPlaying(true)
            const stepMs = tickMs(speed)
            const timer = window.setInterval(() => {
              setBoard((current) => {
                if (current.over) {
                  window.clearInterval(timer)
                  setPlaying(false)
                  return current
                }
                const result = sandboxAutoStep(current, cheats, ring)
                setEntries(ring.latest(10))
                return result.state
              })
            }, stepMs)
          }}
          style={chip(playing)}
        >
          {playing ? `暫停 · ${speed}×` : "託管"}
        </button>
        <button
          type="button"
          onClick={() => {
            machine.record(board)
            setUndoDepth(machine.depth)
            setBoard(endSide(board))
          }}
          style={chip(false)}
        >
          結束本輪
        </button>
      </div>

      <p style={{ margin: "6px 0 0", color: "#9C8F78" }}>
        第 {board.turn} 回合 · {board.side === "attacker" ? "墨方" : "秦方"}行動
        {board.over ? ` · 戰畢（${board.over === "attacker" ? "墨勝" : "秦勝"}）` : ""}
        {notice ? ` · ${notice}` : ""}
      </p>

      <section style={{ marginTop: 10, borderTop: "1px solid #3A2A1C", paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#C9A227" }}>傷害環形日誌</strong>
          <span style={{ color: "#9C8F78" }}>{ring.size}/200</span>
        </div>
        {entries.length === 0 ? (
          <p style={{ margin: "4px 0 0", color: "#9C8F78" }}>未出手；託管或單步後逐條列出。</p>
        ) : (
          <ul style={{ margin: "4px 0 0", paddingLeft: 14 }}>
            {entries.slice(-6).map((entry) => (
              <li key={entry.seq} style={{ marginBottom: 2 }}>
                {brief(entry)}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => download("damage-log.json", JSON.stringify(ring.json(), null, 2))} style={{ ...chip(true), marginTop: 4 }}>
          匯出 damage-log
        </button>
      </section>

      <section style={{ marginTop: 10, borderTop: "1px solid #3A2A1C", paddingTop: 8 }}>
        <strong style={{ color: "#C9A227" }}>時間機器</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {SNAPSHOT_NAMES.map((name) => (
            <button key={name} type="button" onClick={() => applySnapshot(name)} style={chip(false)}>
              {SNAPSHOT_LABEL[name]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <button
            type="button"
            disabled={!machine.canUndo}
            onClick={() => {
              const previous = machine.undo()
              setUndoDepth(machine.depth)
              if (previous) {
                setSelected(null)
                setBoard(previous)
                setNotice("已回退一步")
              }
            }}
            style={chip(true)}
          >
            Undo（{undoDepth}/10）
          </button>
          <button type="button" onClick={() => { machine.clear(); setUndoDepth(0); setNotice("Undo 已清空") }} style={chip(false)}>
            清空
          </button>
        </div>
      </section>
    </div>
  )
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const selectStyle = {
  background: "#231910",
  color: "#E8DCC0",
  border: "1px solid #C8A96B",
  borderRadius: 3,
  padding: "2px 4px",
  fontSize: 12,
}

function chip(primary: boolean) {
  return {
    background: primary ? "#C8A96B" : "transparent",
    color: primary ? "#1A120C" : "#E8DCC0",
    border: "1px solid #C8A96B",
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer" as const,
  }
}

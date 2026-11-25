import { useState, type CSSProperties } from "react"
import { STYLE } from "./tokens.ts"
import type { GeneralConfig, RosterState } from "../../general/types.ts"
import { expPct, formationSummary, statsOf, troopRows } from "../../general/engine.ts"

type Tab = "roster" | "tavern" | "formation" | "equip"

const box: CSSProperties = {
  background: STYLE.panel,
  boxShadow: `inset 0 0 0 2px ${STYLE.border}, inset 0 0 0 3px ${STYLE.gold}`,
  padding: 10,
}

const btn: CSSProperties = {
  background: STYLE.panelRaise,
  color: STYLE.text,
  border: `1px solid ${STYLE.gold}`,
  fontFamily: STYLE.fontTitle,
  fontSize: 12,
  lineHeight: 1.2,
  padding: "6px 8px",
  cursor: "pointer",
}

/** B6 武將面板：名冊／酒館招募／校場編隊／裝備，全部讀寫同一份 RosterState。 */
export function GeneralPanel({
  roster,
  config,
  wallet,
  onClose,
  onActive,
  onRecruit,
  onEquip,
  onSlot,
}: {
  roster: RosterState
  config: GeneralConfig
  wallet: { coin: number; jade: number }
  onClose: () => void
  onActive: (id: string) => void
  onRecruit: (id: string) => void
  onEquip: (itemId: string) => void
  onSlot: (index: number, id: string | null, unit: string | null, count: number) => void
}) {
  const [tab, setTab] = useState<Tab>("roster")
  const active = roster.generals.find((item) => item.id === roster.activeId) ?? roster.generals[0]
  const rows = troopRows(roster, config)
  const stats = active ? statsOf(active, config) : null

  return (
    <div
      style={{
        position: "absolute",
        left: 300,
        top: 120,
        width: 620,
        height: 470,
        ...box,
        zIndex: 40,
        fontFamily: STYLE.fontTitle,
        color: STYLE.text,
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 16, color: STYLE.gold }}>武將 · 校場</strong>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            ["roster", "名冊"],
            ["tavern", "酒館"],
            ["formation", "編隊"],
            ["equip", "裝備"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} style={{ ...btn, background: tab === id ? STYLE.gold : STYLE.panelRaise, color: tab === id ? STYLE.border : STYLE.text }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={onClose} style={btn}>
            關
          </button>
        </div>
      </div>

      {tab === "roster" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={box}>
            <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>麾下 {roster.generals.length} 人</p>
            {roster.generals.map((item) => {
              const stat = statsOf(item, config)
              const chosen = item.id === active?.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onActive(item.id)}
                  style={{ ...btn, display: "block", width: "100%", textAlign: "left", marginBottom: 4, background: chosen ? STYLE.gold : STYLE.panelRaise, color: chosen ? STYLE.border : STYLE.text }}
                >
                  {item.name}　Lv.{item.level}　攻{stat.atk} 防{stat.def} 統{stat.lead}　帶兵 {stat.troopCap}
                </button>
              )
            })}
          </div>
          <div style={box}>
            <p style={{ margin: "0 0 6px", color: STYLE.textMuted }}>當前武將</p>
            {active && stats ? (
              <>
                <p style={{ margin: 0 }}>{active.name}　Lv.{active.level}　經驗 {expPct(active, config)}%</p>
                <p style={{ margin: "4px 0" }}>
                  攻 {stats.atk}　防 {stats.def}　統率 {stats.lead}　帶兵上限 {stats.troopCap}
                </p>
                <p style={{ margin: "4px 0", color: STYLE.textMuted }}>技能</p>
                {active.skills.map((skillId) => {
                  const skill = config.skills.find((item) => item.id === skillId)
                  if (!skill) return null
                  return (
                    <p key={skillId} style={{ margin: "2px 0" }}>
                      {skill.name}（{skill.kind === "active" ? "主動" : "被動"}）{skill.desc}
                    </p>
                  )
                })}
              </>
            ) : null}
            <p style={{ margin: "8px 0 4px", color: STYLE.textMuted }}>兵力七行</p>
            {rows.map((row) => (
              <span key={row.name} style={{ display: "inline-block", marginRight: 10 }}>
                {row.name} {row.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "tavern" ? (
        <div style={box}>
          <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>
            每日三名候選　花費 刀幣 {config.tavern.cost.coin} + 玉石 {config.tavern.cost.jade}　庫房 刀幣 {Math.floor(wallet.coin)} 玉石 {Math.floor(wallet.jade)}
          </p>
          {config.pool
            .filter((entry) => roster.tavern.offers.includes(entry.id))
            .map((entry) => (
              <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span>
                  {entry.name}　{entry.archetype}　{entry.leitmotif}
                </span>
                <button type="button" onClick={() => onRecruit(entry.id)} style={btn}>
                  招募
                </button>
              </div>
            ))}
          {roster.tavern.offers.length === 0 ? <p style={{ margin: 0, color: STYLE.textMuted }}>今日已無新面孔，明日再來。</p> : null}
        </div>
      ) : null}

      {tab === "formation" ? (
        <div style={box}>
          <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>校場三格：每格一將一兵種，兵數受帶兵上限與兵池限制</p>
          {formationSummary(roster, config).map((line, index) => {
            const slot = roster.formation[index]
            const nextGeneral = () => {
              const ids = [null, ...roster.generals.map((item) => item.id)]
              const at = ids.indexOf(slot?.generalId ?? null)
              return ids[(at + 1) % ids.length] ?? null
            }
            const nextUnit = () => {
              const ids = config.troops.map((row) => row.id)
              const at = ids.indexOf(slot?.unit ?? "")
              return ids[(at + 1) % ids.length] ?? ids[0] ?? null
            }
            return (
              <div key={index} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ width: 220 }}>{line}</span>
                <button type="button" style={btn} onClick={() => onSlot(index, nextGeneral(), slot?.unit ?? null, slot?.count || 100)}>
                  換將
                </button>
                <button type="button" style={btn} onClick={() => onSlot(index, slot?.generalId ?? null, nextUnit(), slot?.count || 100)}>
                  換兵種
                </button>
                <button type="button" style={btn} onClick={() => onSlot(index, slot?.generalId ?? null, slot?.unit ?? null, (slot?.count || 100) + 100)}>
                  +100
                </button>
                <button type="button" style={btn} onClick={() => onSlot(index, null, null, 0)}>
                  撤
                </button>
              </div>
            )
          })}
          <p style={{ margin: "6px 0 0", color: STYLE.textMuted }}>
            兵池：{rows.map((row) => `${row.name} ${row.count}`).join("　")}
          </p>
        </div>
      ) : null}

      {tab === "equip" ? (
        <div style={box}>
          <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>
            {active?.name ?? "武將"}：武器 {config.equipment.items.find((item) => item.id === active?.equip.weapon)?.name ?? "空"}　
            護甲 {config.equipment.items.find((item) => item.id === active?.equip.armor)?.name ?? "空"}　馬 {config.equipment.items.find((item) => item.id === active?.equip.horse)?.name ?? "空"}
          </p>
          {config.equipment.items.map((item) => (
            <button key={item.id} type="button" onClick={() => onEquip(item.id)} style={{ ...btn, display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}>
              {item.name}（{item.slot}）攻+{item.atk} 防+{item.def} 統+{item.lead}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

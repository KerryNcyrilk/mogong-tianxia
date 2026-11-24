import { place, textFace } from "./box.ts"
import { MOCK_GENERAL, MOCK_LORD, MOCK_RESOURCES, MOCK_TROOPS } from "./mock.ts"
import { FaceButton, Panel } from "./parts.tsx"
import { STYLE, controlNode, uiNode, type UiProfile } from "./tokens.ts"

function Glyph({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 18 21" width="100%" height="100%" aria-hidden>
      <rect x="0.5" y="0.5" width="17" height="20" fill={STYLE.panel} stroke={STYLE.gold} />
      <text x="9" y="14" textAnchor="middle" fontSize="10" fill={STYLE.text}>
        {name.slice(0, 1)}
      </text>
    </svg>
  )
}

export function LeftPanel({
  profile,
  tab,
  log,
  onTab,
  onAction,
}: {
  profile: UiProfile
  tab: "general" | "troops"
  log: string
  onTab: (next: "general" | "troops") => void
  onAction: (message: string) => void
}) {
  const panel = uiNode(profile, "area_left")
  const avatar = uiNode(profile, "avatar")
  const name = uiNode(profile, "monarch_name")
  const prestige = uiNode(profile, "prestige")
  const peerage = uiNode(profile, "peerage")
  const alliance = uiNode(profile, "alliance")
  const city = uiNode(profile, "city_name")
  const cityArrow = uiNode(profile, "city_name_arrow")
  const card = uiNode(profile, "general_card")
  const generalName = uiNode(profile, "general_name")
  const generalStat = uiNode(profile, "general_stat")
  const generalLevel = uiNode(profile, "general_level")
  const generalExp = uiNode(profile, "general_exp")
  const generalStatus = uiNode(profile, "general_status")
  const generalSkill = uiNode(profile, "general_skill")
  const generalEquip = uiNode(profile, "general_equip")
  const tabGeneral = uiNode(profile, "tab_general")
  const tabTroops = uiNode(profile, "tab_troops")

  return (
    <Panel node={panel} profile={profile}>
      <div style={{ ...place(avatar, panel), boxShadow: `inset 0 0 0 1px ${STYLE.gold}`, background: STYLE.panel }}>
        <span
          style={{
            ...textFace(name, "title"),
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: "100%",
            fontSize: Math.min(name.fontSize ?? 22, avatar.h * 0.4),
          }}
        >
          {MOCK_LORD.name.slice(0, 1)}
        </span>
      </div>
      <p style={{ ...place(name, panel), ...textFace(name, "title"), display: "flex", alignItems: "center" }}>{MOCK_LORD.name}</p>
      <p style={{ ...place(prestige, panel), ...textFace(prestige, "value"), display: "flex", alignItems: "center" }}>
        {MOCK_LORD.prestige}
      </p>
      <p style={{ ...place(peerage, panel), ...textFace(peerage, "title"), display: "flex", alignItems: "center" }}>{MOCK_LORD.peerage}</p>
      <p
        style={{
          ...place(alliance, panel),
          ...textFace(alliance, "title"),
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {MOCK_LORD.alliance}
      </p>
      <FaceButton
        origin={panel}
        face={uiNode(profile, "treasury")}
        hit={controlNode(profile, "treasury")}
        title="寶庫"
        onClick={() => onAction("MOCK_寶庫")}
      >
        寶庫
      </FaceButton>
      <FaceButton
        origin={panel}
        face={uiNode(profile, "mail")}
        hit={controlNode(profile, "mail")}
        title="信件"
        onClick={() => onAction("MOCK_信件")}
      >
        信
      </FaceButton>
      <FaceButton origin={panel} face={uiNode(profile, "salary")} title="領俸祿" onClick={() => onAction("MOCK_領俸祿")}>
        領俸祿
      </FaceButton>
      <FaceButton origin={panel} face={uiNode(profile, "ranking")} title="排行" onClick={() => onAction("MOCK_排行")}>
        排行
      </FaceButton>
      <div
        title={log}
        aria-label={`${MOCK_LORD.city} ${log}`}
        style={{
          ...place(city, panel),
          ...textFace(city, "title"),
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          background: STYLE.panel,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span>{MOCK_LORD.city}</span>
        <span style={{ ...place(cityArrow, city), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 12 20" width="100%" height="100%" aria-hidden>
            <polygon points="2,8 10,8 6,14" fill={STYLE.gold} />
          </svg>
        </span>
      </div>
      {MOCK_RESOURCES.map((resource, index) => {
        const row = uiNode(profile, resource.id)
        const icon = uiNode(profile, `${resource.id}_icon`)
        const value = uiNode(profile, `${resource.id}_value`)
        const yieldNode = uiNode(profile, `${resource.id}_yield`)
        return (
          <div key={resource.id}>
            <div
              data-ui-id={resource.id}
              title={resource.name}
              style={{ ...place(row, panel), background: index % 2 === 0 ? STYLE.panel : STYLE.panelRaise }}
            />
            <div style={place(icon, panel)}>
              <Glyph name={resource.name} />
            </div>
            <p style={{ ...place(value, panel), ...textFace(value, "value"), display: "flex", alignItems: "center" }}>
              {resource.value}
            </p>
            <p
              style={{
                ...place(yieldNode, panel),
                ...textFace(yieldNode, "title", STYLE.textMuted),
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {resource.yieldText}
            </p>
            <FaceButton
              origin={panel}
              face={uiNode(profile, `${resource.id}_plus`)}
              hit={controlNode(profile, `${resource.id}_plus`)}
              title={`${resource.name} 加`}
              onClick={() => onAction(`MOCK_加${resource.name}`)}
            >
              +
            </FaceButton>
          </div>
        )
      })}
      <FaceButton
        origin={panel}
        face={tabGeneral}
        hit={controlNode(profile, "tab_general")}
        background={tab === "general" ? STYLE.gold : STYLE.panelRaise}
        color={tab === "general" ? STYLE.border : STYLE.text}
        onClick={() => onTab("general")}
      >
        武將
      </FaceButton>
      <FaceButton
        origin={panel}
        face={tabTroops}
        hit={controlNode(profile, "tab_troops")}
        background={tab === "troops" ? STYLE.gold : STYLE.panelRaise}
        color={tab === "troops" ? STYLE.border : STYLE.text}
        onClick={() => onTab("troops")}
      >
        兵力
      </FaceButton>
      <div
        style={{
          ...place(card, panel),
          background: STYLE.panel,
          boxShadow: tab === "general" ? `inset 0 0 0 1px ${STYLE.gold}` : `inset 0 0 0 1px ${STYLE.border}`,
        }}
      >
        <p style={{ ...place(generalName, card), ...textFace(generalName, "title") }}>{MOCK_GENERAL.name}</p>
        <p style={{ ...place(generalLevel, card), ...textFace(generalLevel, "title") }}>Lv.{MOCK_GENERAL.level}</p>
        <p style={{ ...place(generalStat, card), ...textFace(generalStat, "value"), display: "flex", alignItems: "center" }}>
          {MOCK_GENERAL.stat}
        </p>
        <div style={{ ...place(generalExp, card), background: STYLE.border, boxShadow: `inset 0 0 0 1px ${STYLE.gold}` }}>
          <div style={{ width: `${MOCK_GENERAL.expPct}%`, height: "100%", background: STYLE.building }} />
        </div>
        <p style={{ ...place(generalStatus, card), ...textFace(generalStatus, "title"), display: "flex", alignItems: "center" }}>
          狀態：{MOCK_GENERAL.status}
        </p>
        <FaceButton
          origin={card}
          face={generalSkill}
          hit={controlNode(profile, "general_skill")}
          title="技能"
          onClick={() => onAction("MOCK_技能")}
        >
          技能
        </FaceButton>
        <FaceButton
          origin={card}
          face={generalEquip}
          hit={controlNode(profile, "general_equip")}
          title="裝備"
          onClick={() => onAction("MOCK_裝備")}
        >
          裝備
        </FaceButton>
      </div>
      {MOCK_TROOPS.map((troop, index) => {
        const row = uiNode(profile, `troop_${index}`)
        const icon = uiNode(profile, `troop_${index}_icon`)
        const count = uiNode(profile, `troop_${index}_count`)
        return (
          <div
            key={troop.name}
            data-ui-id={row.id}
            style={{
              ...place(row, panel),
              background: tab === "troops" ? STYLE.panelRaise : STYLE.panel,
              boxShadow: `inset 0 -1px 0 ${STYLE.border}`,
            }}
          >
            <span
              data-ui-id={icon.id}
              style={{
                ...place(icon, row),
                background: STYLE.panelRaise,
                boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
                ...textFace(icon, "title"),
                display: "grid",
                placeItems: "center",
              }}
            >
              {troop.name.slice(0, 1)}
            </span>
            <span style={{ ...textFace(row, "title"), display: "flex", alignItems: "center", height: "100%", paddingLeft: 36 }}>
              {troop.name}
            </span>
            <span
              style={{
                ...place(count, row),
                ...textFace(count, "value"),
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 8,
              }}
            >
              {troop.count}
            </span>
          </div>
        )
      })}
    </Panel>
  )
}

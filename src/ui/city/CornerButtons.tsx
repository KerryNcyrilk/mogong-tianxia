import { STYLE } from "./tokens.ts"

/** 右上三圓鈕：出城／探險／情報。位置由外殼以 flex 錨定，唔再寫死 1206 座標。 */
export function CornerButtons({
  scale,
  outside,
  exploreOn,
  intelOn,
  onToggleExit,
  onExplore,
  onIntel,
  onSave,
  muted,
  onToggleMute,
}: {
  scale: number
  outside: boolean
  exploreOn: boolean
  intelOn: boolean
  onToggleExit: () => void
  onExplore: () => void
  onIntel: () => void
  onSave: () => void
  muted: boolean
  onToggleMute: () => void
}) {
  const size = Math.round(40 * scale)
  const style = (active: boolean) => ({
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 999,
    background: active ? STYLE.gold : STYLE.panel,
    color: active ? STYLE.border : STYLE.text,
    border: 0,
    boxShadow: `inset 0 0 0 1px ${STYLE.gold}`,
    fontFamily: STYLE.fontTitle,
    fontSize: Math.round(12 * scale),
    lineHeight: 1,
    cursor: "pointer" as const,
  })

  return (
    <div style={{ position: "absolute", right: Math.round(10 * scale), top: Math.round(8 * scale), display: "flex", flexDirection: "column", gap: Math.round(4 * scale) }}>
      <button type="button" data-ui-id="ring_exit" title={outside ? "回城" : "出城"} onClick={onToggleExit} style={style(outside)}>
        {outside ? "回城" : "出城"}
      </button>
      <button type="button" data-ui-id="ring_explore" title="探險" onClick={onExplore} style={style(exploreOn)}>
        探險
      </button>
      <button type="button" data-ui-id="ring_intel" title="情報" onClick={onIntel} style={style(intelOn)}>
        情報
      </button>
      <button type="button" data-ui-id="ring_save" title="存檔管理" onClick={onSave} style={style(false)}>
        存檔
      </button>
      <button type="button" data-ui-id="ring_sound" title={muted ? "開啟音效" : "靜音"} onClick={onToggleMute} style={style(false)}>
        {muted ? "靜音" : "音效"}
      </button>
    </div>
  )
}

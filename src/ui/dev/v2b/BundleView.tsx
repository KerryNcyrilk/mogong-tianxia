import { useState } from "react"
import { overridesIdle, readOverrides } from "../../../dev/devOverrides.ts"
import { debugBundleJson } from "../../../dev/v2b/debugBundle.ts"
import { devEvents, pushDevEvent } from "../../../dev/v2b/eventRing.ts"
import { STYLE } from "../../city/tokens.ts"
import { chip, downloadJson } from "./chrome.tsx"

export function BundleView() {
  const [note, setNote] = useState("")
  const events = devEvents()
  const overrides = readOverrides()

  return (
    <div data-ui-id="dev_v2b_bundle">
      <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>
        單一 debug-bundle.json：當前存檔、devOverrides、這條記憶體環最後 30 筆。不是 syslog，也不寫 console。
      </p>
      <p style={{ margin: "0 0 8px" }}>
        事件 {events.length}/30　覆寫 {overridesIdle() ? "無" : "有"}
        {overrides?.phase3 ? "　含 Phase 3 預留" : ""}
      </p>
      {events.length === 0 ? <p style={{ margin: "0 0 8px", color: STYLE.textMuted }}>還沒有事件。</p> : null}
      {events.slice(-8).map((event) => (
        <p key={event.seq} style={{ margin: 0, color: STYLE.textMuted }}>
          {event.seq}　{event.kind}
        </p>
      ))}
      <button
        type="button"
        style={{ ...chip(true), marginTop: 8 }}
        onClick={() => {
          pushDevEvent("bundle.export", null)
          downloadJson("debug-bundle.json", debugBundleJson())
          setNote("已下載 debug-bundle.json")
        }}
      >
        匯出 debug-bundle.json
      </button>
      <p style={{ margin: "8px 0 0", color: STYLE.gold }}>{note}</p>
    </div>
  )
}

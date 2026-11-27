import { BundleView } from "./v2b/BundleView.tsx"
import { CalibratorView } from "./v2b/CalibratorView.tsx"
import { QaView } from "./v2b/QaView.tsx"
import { WorldView } from "./v2b/WorldView.tsx"

export type V2BTab = "calibrator" | "world" | "qa" | "bundle"

/** 只由 DevConsole 以 lazy() 載入。未開對應分頁時不掛進 DOM。 */
export default function DevV2B({ tab }: { tab: V2BTab }) {
  if (tab === "calibrator") return <CalibratorView />
  if (tab === "world") return <WorldView />
  if (tab === "qa") return <QaView />
  return <BundleView />
}

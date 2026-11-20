import { FaceButton } from "./parts.tsx"
import { STYLE, controlNode, uiNode, type UiProfile } from "./tokens.ts"

export function CornerButtons({
  profile,
  outside,
  exploreOn,
  intelOn,
  onToggleExit,
  onExplore,
  onIntel,
}: {
  profile: UiProfile
  outside: boolean
  exploreOn: boolean
  intelOn: boolean
  onToggleExit: () => void
  onExplore: () => void
  onIntel: () => void
}) {
  const origin = { x: 0, y: 0 }
  return (
    <>
      <FaceButton
        origin={origin}
        face={uiNode(profile, "ring_exit")}
        hit={controlNode(profile, "ring_exit")}
        radius={999}
        background={outside ? STYLE.gold : STYLE.panel}
        color={outside ? STYLE.border : STYLE.text}
        title={outside ? "回城" : "出城"}
        onClick={onToggleExit}
      >
        {outside ? "回城" : "出城"}
      </FaceButton>
      <FaceButton
        origin={origin}
        face={uiNode(profile, "ring_explore")}
        hit={controlNode(profile, "ring_explore")}
        radius={999}
        background={exploreOn ? STYLE.gold : STYLE.panel}
        color={exploreOn ? STYLE.border : STYLE.text}
        title="探險"
        onClick={onExplore}
      >
        探險
      </FaceButton>
      <FaceButton
        origin={origin}
        face={uiNode(profile, "ring_intel")}
        hit={controlNode(profile, "ring_intel")}
        radius={999}
        background={intelOn ? STYLE.gold : STYLE.panel}
        color={intelOn ? STYLE.border : STYLE.text}
        title="情報"
        onClick={onIntel}
      >
        情報
      </FaceButton>
    </>
  )
}

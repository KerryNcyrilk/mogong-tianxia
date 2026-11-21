import { memo } from "react"
import { citySvg } from "../../city/official.ts"

const CityArt = memo(function CityArt() {
  return <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: citySvg }} />
})

export function WorldLayer({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  return (
    <div style={{ position: "absolute", left, top, width, height, pointerEvents: "none" }}>
      <CityArt />
    </div>
  )
}

import { OVERVIEW_SRC } from "../../city/overview.ts"

/** One painted plate. It pans and zooms with the camera. Zones are not drawn on top. */
export function WorldLayer({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  return (
    <img
      src={OVERVIEW_SRC}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        pointerEvents: "none",
      }}
    />
  )
}

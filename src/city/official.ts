import raw from "../../data/cityLayout.json" with { type: "json" }
import { parseCityLayout } from "./layout.ts"
import { renderCitySvg } from "./scene.ts"

export const cityLayout = parseCityLayout(raw)
export const citySvg = renderCitySvg(cityLayout)

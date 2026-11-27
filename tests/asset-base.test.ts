import { describe, expect, it } from "vitest"
import { asset } from "../src/lib/asset.ts"

describe("靜態資源路徑", () => {
  it("GitHub Pages 子路徑要加 BASE_URL 前綴", () => {
    expect(asset("/art/v3/city.jpg", "/mogong-tianxia/")).toBe("/mogong-tianxia/art/v3/city.jpg")
    expect(asset("/art/units/bow.svg", "/mogong-tianxia")).toBe("/mogong-tianxia/art/units/bow.svg")
  })

  it("根路徑維持原樣", () => {
    expect(asset("/art/v3/city.jpg", "/")).toBe("/art/v3/city.jpg")
  })

  it("外部與 data URL 不動", () => {
    expect(asset("https://cdn.example/a.png", "/x/")).toBe("https://cdn.example/a.png")
    expect(asset("data:image/png;base64,AA", "/x/")).toBe("data:image/png;base64,AA")
    expect(asset("blob:abc", "/x/")).toBe("blob:abc")
  })

  it("相對路徑補斜線", () => {
    expect(asset("art/a.png", "/mogong-tianxia/")).toBe("/mogong-tianxia/art/a.png")
  })
})

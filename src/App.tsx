import { BattleView } from "./ui/BattleView.tsx"
import { CityScreen } from "./ui/city/CityScreen.tsx"

function cityRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "")
  return path === "/city"
}

export default function App() {
  if (cityRoute()) return <CityScreen />
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.35em] text-[#5c5348]">單人試作 · 戰鬥切片</p>
          <h1 className="mt-2 font-serif text-4xl tracking-wide">墨攻天下</h1>
          <a className="mt-3 inline-block text-sm text-[#243e66] underline" href="/city">
            進入主城
          </a>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#3d3832]">
          武將不佔編制、不佔格子，只把攻防光環掛在一支部隊上。此戰沒有士氣、陣型、地形，也沒有暴擊或閃避。
        </p>
      </header>
      <BattleView />
    </main>
  )
}

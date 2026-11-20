import type { BattleEvent } from "../combat/battle.ts"
import { UNIT_LABEL } from "../combat/initiative.ts"
import type { Squad } from "../combat/types.ts"

export function formatDamage(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}

export function squadName(squad: Squad): string {
  const side = squad.side === "attacker" ? "墨" : "秦"
  return `${side}·${UNIT_LABEL[squad.type]}`
}

export function formatEvent(event: BattleEvent, squads: readonly Squad[]): string {
  if (event.kind === "turn-limit") {
    return `第${event.turn}回合結束，攻方未分勝負，判攻方敗`
  }
  const actor = squads.find((squad) => squad.id === event.actorId)
  const target = squads.find((squad) => squad.id === event.targetId)
  const actorName = actor ? squadName(actor) : "部隊"
  const targetName = target ? squadName(target) : "敵軍"
  if (event.kind === "move") {
    return `第${event.turn}回合　${actorName} 進至 (${event.to.x},${event.to.y})`
  }
  if (event.kind === "attack") {
    return `第${event.turn}回合　${actorName} 攻擊 ${targetName}，造成 ${formatDamage(event.damage)} 傷害`
  }
  if (event.kind === "retaliation") {
    return `第${event.turn}回合　${actorName} 反擊 ${targetName}，造成 ${formatDamage(event.damage)} 傷害`
  }
  return `第${event.turn}回合　${actorName} 未能進入攻擊距離`
}

export function formatWinner(winner: "attacker" | "defender" | "draw" | null, reason: "wipe" | "turn-limit" | null): string {
  const side = winner === "attacker" ? "墨方勝" : winner === "defender" ? "秦方勝" : "平手"
  if (reason === "turn-limit") return `${side}　十五回合已盡，攻方未勝`
  if (reason === "wipe") return `${side}　敵軍兵力歸零`
  return "布陣完成，尚未交鋒"
}

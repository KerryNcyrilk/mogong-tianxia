/**
 * 靜態資源路徑：GitHub Pages 部署在子路徑（/mogong-tianxia/），
 * 絕對路徑 "/art/..." 會指去網域根而 404，所以一律用 BASE_URL 前綴。
 */
export function asset(path: string, base?: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path
  const envBase = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
  const prefix = base ?? envBase ?? "/"
  const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix
  return path.startsWith("/") ? `${trimmed}${path}` : `${trimmed}/${path}`
}

#!/usr/bin/env node
/**
 * GS6 gate: a prod bundle must not carry any syslog surface.
 * Scans dist/**\/*.js for the four forbidden tokens; any hit fails the build.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(process.argv[2] ?? "dist")
const FORBIDDEN = ["sysLog.", "SYSLOG_EXPORT", "exportText", "snapshot("]
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name.endsWith(".js")) files.push(path)
  }
}
walk(root)

const hits = []
for (const file of files) {
  const text = readFileSync(file, "utf8")
  for (const token of FORBIDDEN) {
    const count = text.split(token).length - 1
    if (count > 0) hits.push(`${file}: ${token} x${count}`)
  }
}
if (hits.length > 0) {
  console.error(hits.join("\n"))
  console.error(`check-no-syslog: FAIL (${hits.length} hits in ${files.length} js files)`)
  process.exit(1)
}
console.log(`check-no-syslog: PASS (${files.length} js files, 0 hits of ${FORBIDDEN.join(" / ")})`)

import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => {
  const devLog = mode !== "production" || process.env.SYSLOG_FORCE_INDEX === "1"
  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@syslog": path.resolve(
        process.cwd(),
        devLog ? "src/dev/syslog/index.ts" : "src/dev/syslog/stub.ts",
      ),
    },
  },
  define: { __SYSLOG__: JSON.stringify(devLog) },
  server: {
    host: "0.0.0.0",
    port: 43123,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  }
})

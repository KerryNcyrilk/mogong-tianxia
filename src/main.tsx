import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { captureErrors, sysLog } from "@syslog"
import App from "./App.tsx"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("找不到根節點")

if (__SYSLOG__) {
  captureErrors(() => ({ route: location.pathname }))
  sysLog.info("boot", "app.start", { width: window.innerWidth, height: window.innerHeight })
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

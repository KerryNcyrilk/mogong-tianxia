/// <reference types="vite/client" />

declare const __SYSLOG__: boolean

declare module "*?raw" {
  const content: string
  export default content
}

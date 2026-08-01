/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    // Rust 编译产物 src-tauri/target 里的 dll/exe 会被锁，vite 监听 EBUSY 崩溃，
    // 排除掉避免首次编译时 dev 服务器被杀。
    watch: {
      ignored: ["**/src-tauri/target/**", "**/.git/**"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
})

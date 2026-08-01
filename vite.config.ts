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
    // v1 (E:\ezdoc-main) 的 tauri dev 固定用 1420，v2 错开到 1421 避免端口冲突；
    // strictPort 保持 true——devUrl 写死，端口漂移会导致 tauri 加载不到页面。
    port: 1421,
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

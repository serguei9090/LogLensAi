import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/echarts") || id.includes("node_modules/zrender")) {
            return "echarts";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/@base-ui") ||
            id.includes("node_modules/@tanstack") ||
            id.includes("node_modules/cmdk")
          ) {
            return "ui-vendor";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "lucide";
          }
        },
      },
    },
  },
  server: {
    port: 4000,
    watch: {
      ignored: [
        "**/*.log",
        "**/*.duckdb*",
        "**/*.wal",
        "**/*.state",
        "**/*.index",
        "**/*.tmp*",
        "**/laya_rules*.json*",
        path.resolve(__dirname, "rag_model/**"),
        path.resolve(__dirname, "**/.rag_download_tmp*"),
        path.resolve(__dirname, "storage/**"),
        path.resolve(__dirname, "drain/**"),
        path.resolve(__dirname, "models/**"),
        path.resolve(__dirname, "data/**"),
        path.resolve(__dirname, "backend-go/**"),
        path.resolve(__dirname, "sidecar/**"),
        path.resolve(__dirname, "src-tauri/**"),
      ],
    },
  },
});

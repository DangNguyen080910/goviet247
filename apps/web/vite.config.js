// Path: goviet247/apps/web/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiBase = env.VITE_API_BASE || "http://localhost:5050";

  return {
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime"],
    },
    server: {
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
        },
        "/socket.io": {
          target: apiBase,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
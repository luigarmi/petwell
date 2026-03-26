import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    root: resolve(process.cwd(), "apps/web"),
    define: {
      __PETWELL_API_BASE__: JSON.stringify(env.PETWELL_API_BASE ?? "http://localhost:8080")
    },
    server: {
      host: "0.0.0.0",
      port: Number(env.WEB_PORT ?? 3000)
    },
    build: {
      outDir: resolve(process.cwd(), "dist/web"),
      emptyOutDir: true
    }
  };
});

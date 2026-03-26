import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredApiBase = env.PETWELL_API_BASE?.trim();
  const pointsToLocalhost = Boolean(
    configuredApiBase?.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i)
  );
  const apiBase =
    mode === "production"
      ? configuredApiBase && !pointsToLocalhost
        ? configuredApiBase
        : "/api"
      : configuredApiBase || "http://localhost:8080";

  return {
    plugins: [react()],
    root: resolve(process.cwd(), "apps/web"),
    define: {
      __PETWELL_API_BASE__: JSON.stringify(apiBase)
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

import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src"), "@db": path.resolve(__dirname, "./db") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Neon free tier autosuspends after 5min idle — cold start 2-5s from VN.
    // Bump test timeout to absorb the wake-up on first DB-gated test.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

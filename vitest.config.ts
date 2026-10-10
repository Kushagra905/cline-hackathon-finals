import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose root is src/web (client build only).
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "server/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
});

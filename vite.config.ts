import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Client is served from dist/client by the Express server; in dev, /api is proxied to it.
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: { outDir: "../../dist/client", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787", "/samples": "http://127.0.0.1:8787" } },
});

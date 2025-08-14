import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      util: "util",
    },
  },
  optimizeDeps: {
    include: ["buffer", "crypto-browserify", "stream-browserify", "util"],
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Les modules testés importent parfois "@/db/client" au niveau module
    // (ex. sentiment-timeline-peaks.ts) ; neon() lève une exception si
    // DATABASE_URL est absent, même quand la fonction testée ne s'en sert pas.
    env: {
      DATABASE_URL: "postgres://user:password@localhost:5432/test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

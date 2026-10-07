import { defineConfig } from "vitest/config";

// Server-function tests only. App unit tests run under Jest (see jest.config.js).
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});

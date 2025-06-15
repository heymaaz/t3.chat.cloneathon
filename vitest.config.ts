import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./convex/__tests__/setup.nobundle.ts"],
    testTimeout: 30000,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@backend": path.resolve(__dirname, "./convex"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});

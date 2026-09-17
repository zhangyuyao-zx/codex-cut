import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["workbench-local/*.test.ts"], environment: "node" },
});

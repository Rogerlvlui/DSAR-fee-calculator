import { defineConfig } from "vitest/config";

// Vitest 5's `test.projects` field, in a single root config — NOT a
// separate vitest.workspace.ts, which has been deprecated since Vitest 3.2.
// (Confirmed against the installed vitest@5.0.0 type declarations:
// `projects?: TestProjectConfiguration[]` on the root `test` config.)
export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      {
        test: {
          name: "schemas",
          environment: "node",
          include: ["packages/schemas/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "engine",
          environment: "node",
          include: ["packages/engine/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "routes",
          environment: "node",
          include: ["tests/routes/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "boundary",
          environment: "node",
          include: ["tests/boundary/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 120000,
        },
      },
      {
        test: {
          name: "toolchain",
          environment: "node",
          include: ["tests/toolchain/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/**/*.test.tsx"],
        },
      },
    ],
  },
});

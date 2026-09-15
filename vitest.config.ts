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
          // These gates instantiate a real ESLint and a real dependency-cruiser
          // rather than asserting against a stub, so the first test in each file
          // pays a cold start of roughly 750ms on its own. Vitest's 5s default
          // leaves under 7x headroom, which the full suite can exhaust when all
          // seven projects contend for CPU — observed twice as `lint-money-brand`
          // and `lint-engine-determinism` timing out together while every
          // assertion in them still held. A gate that reddens CI for load rather
          // than for a real violation trains people to re-run it, which is how a
          // gate stops being read at all.
          testTimeout: 30000,
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

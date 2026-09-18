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
          name: "rulepacks",
          environment: "node",
          include: ["packages/rulepacks/src/**/*.test.ts"],
        },
      },
      {
        // 03.1-05's tests/routes/honesty.test.ts renders the real root
        // layout (apps/web/app/layout.tsx, a .tsx file) directly, to prove
        // the permanent marker's position without tripping the jsdom
        // "web" project's server-only guard (see that test file's own
        // header note). apps/web/tsconfig.json's "preserve" JSX mode
        // (required by Next) leaves JSX untransformed for Vite — the same
        // fix 03.1-01 already applied to the "web" and "boundary" projects
        // once each first needed to import a real .tsx file.
        oxc: {
          jsx: {
            runtime: "automatic",
            importSource: "react",
          },
        },
        test: {
          name: "routes",
          environment: "node",
          include: ["tests/routes/**/*.test.ts"],
        },
      },
      {
        // tests/boundary/dom-denylist.test.ts dynamically imports every
        // page.tsx under apps/web/app/** (its "glob half"). Once 03.1-01's
        // Task 2 gave that glob real .tsx files to find, Vite needed a JSX
        // transform to import them at all — apps/web/tsconfig.json's
        // "preserve" JSX mode (required by Next) leaves JSX untransformed
        // for a plain test runner. Same fix as the "web" project below;
        // this is a regression this task's own page.tsx files introduced
        // into a previously-passing boundary test, not a new capability.
        oxc: {
          jsx: {
            runtime: "automatic",
            importSource: "react",
          },
        },
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
        // apps/web/tsconfig.json sets "jsx": "preserve" (Next's required
        // mode), which leaves JSX untransformed for a plain test runner.
        // This project-level `oxc` option (Vite 8 transforms through Oxc,
        // not esbuild) overrides that for test files only — it changes
        // nothing about how Next itself compiles the app.
        oxc: {
          jsx: {
            runtime: "automatic",
            importSource: "react",
          },
        },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/**/*.test.tsx"],
        },
      },
    ],
  },
});

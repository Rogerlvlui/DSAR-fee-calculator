/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-io-in-engine",
      severity: "error",
      comment:
        "packages/engine must be pure: no I/O, no network (PRD §8.1, non-negotiable #3).",
      from: { path: "^packages/engine" },
      to: {
        dependencyTypes: ["core"],
        path: "^(fs|net|http|https|dns|child_process|worker_threads)$",
      },
    },
    {
      name: "no-infra-in-engine",
      severity: "error",
      comment:
        "packages/engine must not reach Prisma, Next.js, or the agent/audit/documents packages.",
      from: { path: "^packages/engine" },
      to: {
        path: [
          "^@prisma/client$",
          "^@prisma/internals$",
          "^next$",
          "^packages/(agent|audit|documents)",
        ],
      },
    },
    {
      name: "no-fetch-in-engine",
      severity: "error",
      comment: "packages/engine must not perform network fetches.",
      from: { path: "^packages/engine" },
      to: { path: ["^undici$", "^node-fetch$"] },
    },
    {
      name: "no-money-formatting-in-engine",
      severity: "error",
      comment:
        "packages/schemas/src/money.ts performs the only division on the money path and the only Intl call in packages/schemas — packages/engine must reach neither (T-2-09).",
      from: { path: "^packages/engine" },
      // Both the package-exports specifier and the resolved source path are
      // covered: dependency-cruiser matches against the resolved module
      // path, and a relative import would otherwise slip past a
      // specifier-only pattern.
      to: { path: ["^@dsar/schemas/money$", "packages/schemas/src/money"] },
    },
    {
      name: "no-store-impl-in-repository-interface",
      severity: "error",
      comment:
        "The repository interface module must be swappable for a Prisma implementation later (Phase 3.2) without any screen or engine call site noticing — it must not itself depend on a concrete store (success criterion 4, Phase 03.1).",
      from: { path: "^apps/web/src/server/repositories/interface\\.ts$" },
      to: { path: "^apps/web/src/server/repositories/(memory|prisma)" },
    },
    {
      name: "no-server-imports-in-ui",
      severity: "error",
      comment:
        "The role checks, the repository and the pack loader are server-side; a presentational component under apps/web/src/ui must never import apps/web/src/server. This is the build-time half of the guarantee apps/web/src/server/server-only.ts gives at runtime (Phase 03.1).",
      from: { path: "^apps/web/src/ui" },
      to: { path: "^apps/web/src/server" },
    },
    {
      name: "no-io-in-workflow",
      severity: "error",
      comment:
        "packages/workflow must be pure: no I/O, no network — the same purity discipline packages/engine already carries (PRD §5, 04-02-PLAN.md).",
      from: { path: "^packages/workflow" },
      to: {
        dependencyTypes: ["core"],
        path: "^(fs|net|http|https|dns|child_process|worker_threads)$",
      },
    },
    {
      name: "no-infra-in-workflow",
      severity: "error",
      comment:
        "packages/workflow must not reach Prisma, Next.js, apps/, or the sibling agent/audit/documents/rulepacks packages — the guard decides, it never reaches for what it decides about. A dependency on packages/audit in particular would let a guard write an event, which is the anti-pattern 04-RESEARCH.md calls out by name.",
      from: { path: "^packages/workflow" },
      to: {
        // Both the package-exports specifier and the resolved source path
        // are covered: a workspace package's own subpath-export map
        // (`"./*": "./src/*.ts"`) frequently fails to resolve inside
        // dependency-cruiser's own module resolution, in which case it
        // matches against the raw specifier text instead of a resolved
        // path — the same double-coverage the no-money-formatting-in-engine
        // rule already relies on above.
        path: [
          "^@prisma/client$",
          "^@prisma/internals$",
          "^next$",
          "^@dsar/(agent|audit|documents|rulepacks)",
          "^packages/(agent|audit|documents|rulepacks)",
          "^apps/",
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
  },
};

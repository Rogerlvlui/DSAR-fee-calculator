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

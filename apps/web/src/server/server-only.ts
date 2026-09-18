// apps/web/src/server/server-only.ts
//
// Local replacement for the `server-only` npm package (03.1-RESEARCH.md's
// Standard Stack lists it; the plan SUMMARY records the substitution and
// why). Under pnpm's strict node_modules an undeclared specifier does not
// resolve, and the real package's default export deliberately throws
// outside Next's react-server condition — which would break every Vitest
// import of a data-access module unless a resolution alias were added. This
// module plus the `no-server-imports-in-ui` dependency-cruiser rule (Task 3)
// gives the same two guarantees with no new dependency and no test-
// resolution workaround: a runtime trip if this module is ever evaluated in
// a browser, and a build-time refusal if a presentational component imports
// anything under apps/web/src/server.
//
// Every module under apps/web/src/server/ imports this as its first
// statement.
if (typeof window !== "undefined") {
  throw new Error(
    "apps/web/src/server modules are server-only and must never be evaluated in a browser."
  );
}

export {};

import type { NextConfig } from "next";

// @dsar/schemas, @dsar/engine, @dsar/rulepacks and @dsar/documents publish
// TypeScript (and, for @dsar/documents, TSX) source through their
// package.json `exports` maps with no build step of their own, so Next must
// be told to compile them through its own toolchain rather than treating
// them as already-built external packages. `serverExternalPackages` is
// deliberately NOT set for any of the four: externalising and transpiling
// are mutually exclusive, and the rule-pack JSON is read through an
// explicitly resolved filesystem root (see src/server/rulepacks-root.ts),
// not through bundled module resolution.
const nextConfig: NextConfig = {
  transpilePackages: ["@dsar/schemas", "@dsar/engine", "@dsar/rulepacks", "@dsar/documents"],
};

export default nextConfig;

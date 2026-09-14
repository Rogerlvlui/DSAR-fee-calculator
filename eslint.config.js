// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".next/**"],
  },
  {
    files: ["packages/engine/**/*.ts", "packages/schemas/**/*.ts"],
    rules: {
      // AC-07a money-branding rule lands in a later commit of this same task
      // (RED phase: config exists and lints the fixture, but does not yet
      // report anything).
    },
  }
);

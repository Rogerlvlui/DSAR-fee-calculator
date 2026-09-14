// @ts-check
import tseslint from "typescript-eslint";

// AC-07a (SCHEMA-02): a money-named identifier (suffix amount/total/rate/fee/
// cap, case-insensitive, anchored at end-of-identifier) must never be typed
// as a bare `number` in packages/engine or packages/schemas — it must use
// the branded `Minor` type instead. Purely syntactic (no parserOptions.project):
// the branded type is spelled `Minor` in source, never `number`, so matching
// the literal `number` keyword is sufficient and avoids type-aware linting
// overhead plus pulling Prisma-generated output into the parse graph.
const MONEY_BRAND_MESSAGE =
  "Money-named identifiers must use the branded Minor type, not number.";
const MONEY_SUFFIX = "/(amount|total|rate|fee|cap)$/i";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".next/**"],
  },
  {
    files: ["packages/engine/**/*.ts", "packages/schemas/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      // Purely syntactic: no `project` set, so no type-aware linting and no
      // Prisma-generated output pulled into the parse graph.
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `TSPropertySignature[key.name=${MONEY_SUFFIX}] > TSTypeAnnotation > TSNumberKeyword`,
          message: MONEY_BRAND_MESSAGE,
        },
        {
          // A VariableDeclarator's type annotation lives on its `id`
          // Identifier node, not directly on the declarator itself —
          // confirmed against the installed typescript-eslint AST spec
          // (VariableDeclaratorBase.id: BindingName, an Identifier carrying
          // its own `typeAnnotation`), so the selector must traverse through
          // the Identifier rather than matching `VariableDeclarator >
          // TSTypeAnnotation` directly (research's Assumption A1 — this is
          // exactly the case it flagged as needing empirical confirmation).
          selector: `VariableDeclarator > Identifier[name=${MONEY_SUFFIX}] > TSTypeAnnotation > TSNumberKeyword`,
          message: MONEY_BRAND_MESSAGE,
        },
        {
          selector: `:matches(TSParameterProperty, FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) Identifier[name=${MONEY_SUFFIX}] > TSTypeAnnotation > TSNumberKeyword`,
          message: MONEY_BRAND_MESSAGE,
        },
      ],
    },
  }
);

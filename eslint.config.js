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

// Lifted out of the inline array so it can be spread into more than one
// flat-config entry (the cross-package entry below, and the packages/engine-
// scoped entry). ESLint flat config REPLACES a rule's options from the last
// matching config object rather than merging them — an engine-scoped
// `no-restricted-syntax` entry that didn't spread this array would silently
// disarm AC-07a's money-brand rule for the whole package (T-2-08).
const MONEY_BRAND_SELECTORS = [
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
];

// T-2-07 / ENGINE-01 / PRD §8.1 non-negotiable #1: packages/engine must be
// deterministic — same input, same output, on any host. Each ban below
// carries a distinct message so a test can assert which one fired (rather
// than merely that something did).
const DATE_BAN_MESSAGE =
  "packages/engine reads time only through the injected `now` (PRD §8.1) — `Date` is banned here.";
const INTL_BAN_MESSAGE =
  "Locale-dependent output would make the same input produce different results on a different host — `Intl` is banned in packages/engine.";
const CRYPTO_BAN_MESSAGE =
  "Identifiers must be derived from inputs, not randomness — `crypto` is banned in packages/engine.";
const MATH_RANDOM_BAN_MESSAGE =
  "packages/engine must be deterministic — `Math.random` is banned here (Math itself, e.g. Math.floor, remains allowed).";
const LOCALE_METHOD_BAN_MESSAGE =
  "Locale-dependent formatting would make the same input produce different results on a different host — `toLocale*` calls are banned in packages/engine.";

// T-04-11 / 04-02-PLAN.md Task 2: packages/workflow must be as deterministic
// as packages/engine — same input, same refusal, on any host. GuardInput's
// frozen eleven-member shape carries no clock at all (unlike the engine,
// which at least receives an injected `now`), so there is no exception to
// carve out here: any Date use in this package would be a guard reading
// state it was deliberately never given. Each ban below carries its own
// distinct message, mirroring the engine's determinism block.
const WORKFLOW_DATE_BAN_MESSAGE =
  "packages/workflow's GuardInput carries no clock at all — `Date` is banned here.";
const WORKFLOW_INTL_BAN_MESSAGE =
  "Locale-dependent output would make the same input produce different results on a different host — `Intl` is banned in packages/workflow.";
const WORKFLOW_CRYPTO_BAN_MESSAGE =
  "A guard's outcome must be derived from the frozen GuardInput, not randomness — `crypto` is banned in packages/workflow.";
const WORKFLOW_MATH_RANDOM_BAN_MESSAGE =
  "packages/workflow must be deterministic — `Math.random` is banned here (Math itself, e.g. Math.floor, remains allowed).";
const WORKFLOW_LOCALE_METHOD_BAN_MESSAGE =
  "Locale-dependent formatting would make the same input produce different results on a different host — `toLocale*` calls are banned in packages/workflow.";

// T-04-19 / 04-04-PLAN.md Task 3: no code path in apps/web's server or
// route code may write a literal MatterStatus value as an object
// property — every status a matter reaches must be the destination
// packages/workflow's evaluateTransition() returned. This is deliberately
// a bespoke ESLint rule, not a dependency-cruiser rule and not a
// narrowing of Matter.status's frozen type:
//   - dependency-cruiser inspects the import graph only; it has no way to
//     see an object-literal key like `{ status: "COMPUTING" }` at all —
//     the same reasoning this file's own money-branding rule (above) and
//     .dependency-cruiser.cjs's purity rules already document for why
//     each tool is scoped to the class of violation it can actually see.
//   - Matter is a frozen, additive-only schema (packages/schemas/FREEZE.md
//     D-09); narrowing `status`'s type to a branded non-literal type is a
//     freeze escalation this phase has no mandate to take.
// This is the third time this codebase has had to write down which tool
// polices which class of rule (04-RESEARCH.md Pattern 2, Assumptions Log
// A1) — recorded here again because both alternatives look plausible to a
// later reader.
//
// A literal is the thing banned, not the property: `status: outcome.to`
// (the executor's own returned destination) is an Identifier/
// MemberExpression node, never a Literal, so it never matches this
// selector and stays legal — that is the whole point.
//
// Known, accepted false-positive: MatterStatus's "DRAFT" and
// RulePackStatus's "DRAFT" are the identical string, and this is a purely
// syntactic rule with no type information to tell which schema a given
// `status` property belongs to. INITIAL_MATTER_STATUS (a named constant,
// never a literal) already routes around this for a matter's own birth
// status, so the residual risk is an unrelated `status: "DRAFT"` on some
// other object in this scope — a case this codebase does not currently
// have (verified by grep before authoring this rule).
const STATUS_WRITE_MESSAGE =
  "A matter's status must be written from the guarded executor's own returned destination, never a literal — route the write through packages/workflow's evaluateTransition().";
const MATTER_STATUS_LITERAL_PATTERN =
  "/^(DRAFT|COMPUTING|LEGAL_REVIEW|INFO_REQUEST|SIGNED_OFF|CLOSED|SUPERSEDED)$/";

export default tseslint.config(
  {
    // "**/.next/**" (not just root-level ".next/**"): 03.1-01 added
    // apps/web, the repo's first Next.js app, so its build cache now lives
    // nested at apps/web/.next/ — a root-anchored ".next/**" pattern never
    // matched that, and `next build`/`next dev` output would otherwise
    // reach eslint as raw Turbopack-bundled JS the moment either ever runs
    // locally.
    ignores: ["node_modules/**", "dist/**", "**/.next/**"],
  },
  {
    files: ["packages/engine/**/*.ts", "packages/schemas/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      // Purely syntactic: no `project` set, so no type-aware linting and no
      // Prisma-generated output pulled into the parse graph.
    },
    rules: {
      "no-restricted-syntax": ["error", ...MONEY_BRAND_SELECTORS],
    },
  },
  {
    // Engine-only determinism bans (T-2-07, ENGINE-01, ENGINE-15). Scoped
    // strictly to packages/engine because packages/schemas legitimately
    // calls Intl.NumberFormat in money.ts (currency display formatting) —
    // a module the engine must never reach (see .dependency-cruiser.cjs's
    // no-money-formatting-in-engine rule).
    files: ["packages/engine/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: DATE_BAN_MESSAGE },
        { name: "Intl", message: INTL_BAN_MESSAGE },
        { name: "crypto", message: CRYPTO_BAN_MESSAGE },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: MATH_RANDOM_BAN_MESSAGE },
      ],
      "no-restricted-syntax": [
        "error",
        ...MONEY_BRAND_SELECTORS,
        {
          selector: `MemberExpression[property.name=/^toLocale/]`,
          message: LOCALE_METHOD_BAN_MESSAGE,
        },
      ],
    },
  },
  {
    // packages/workflow-only determinism bans (T-04-11). Scoped separately
    // from the packages/engine block above: this package carries no money
    // fields at all, so the money-brand selectors do not apply here, and
    // each message below names packages/workflow specifically rather than
    // packages/engine.
    files: ["packages/workflow/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: WORKFLOW_DATE_BAN_MESSAGE },
        { name: "Intl", message: WORKFLOW_INTL_BAN_MESSAGE },
        { name: "crypto", message: WORKFLOW_CRYPTO_BAN_MESSAGE },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: WORKFLOW_MATH_RANDOM_BAN_MESSAGE },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `MemberExpression[property.name=/^toLocale/]`,
          message: WORKFLOW_LOCALE_METHOD_BAN_MESSAGE,
        },
      ],
    },
  },
  {
    // 04-04-PLAN.md Task 3 — the literal-status ban, scoped to the
    // application's server directory and its route directory only. The
    // guard package (packages/workflow) legitimately names every status by
    // value in its own declared TRANSITIONS table, and the user-interface
    // and test trees construct fixtures — both are out of scope by design.
    //
    // Widened (04-REVIEW.md WR-03) to also match `.tsx` under
    // apps/web/app/ — the original `files` glob was `.ts`-only, so a server
    // component (like a page under this same directory) constructing a
    // literal status value was never linted by this rule at all. `.tsx`
    // is not added under apps/web/src/server/, which carries no JSX.
    files: ["apps/web/src/server/**/*.ts", "apps/web/app/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Required for `.tsx` parsing without a `project` (this block, like
        // every other one in this file, is purely syntactic) — the parser
        // does not infer JSX support from the file extension alone here.
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Property[key.name='status'][value.type='Literal'][value.value=${MATTER_STATUS_LITERAL_PATTERN}]`,
          message: STATUS_WRITE_MESSAGE,
        },
        {
          // The original selector only matches an object-literal property
          // (`{ status: "DRAFT" }`); a direct member-expression assignment
          // (`matter.status = "DRAFT";`) is an AssignmentExpression over a
          // MemberExpression, not a Property node, and was a second,
          // complete bypass of this rule (04-REVIEW.md WR-03).
          selector: `AssignmentExpression[left.type='MemberExpression'][left.property.name='status'][right.type='Literal'][right.value=${MATTER_STATUS_LITERAL_PATTERN}]`,
          message: STATUS_WRITE_MESSAGE,
        },
      ],
    },
  }
);

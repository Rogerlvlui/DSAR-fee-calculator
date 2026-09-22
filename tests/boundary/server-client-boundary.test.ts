// tests/boundary/server-client-boundary.test.ts
//
// SERVER-CLIENT-BOUNDARY: one pure helper exported from a "use client"
// module produced two live crashes on two different screens on the same
// day — the HR submitted screen (reported: humanizePackDisplayStatus,
// apps/web/src/ui/intake/matter-details-fields.tsx) and the legal review
// screen (found while planning the fix: shouldRenderRecomputeBanner,
// apps/web/src/ui/review/recompute-confirm.tsx). Neither `pnpm typecheck`
// nor any existing test could see either bug, because the server/client
// boundary is enforced by the Next.js compiler at runtime, not by the type
// system. This gate scans the real source tree so the class can't recur
// silently.
//
// A file is treated as carrying the "use client" directive only when it is
// the file's first real statement (comments and whitespace may precede it)
// — the same rule React/Next.js itself enforces, and a more precise test
// than a substring search for "import" or "use client" anywhere in the
// file, both of which this codebase's own header comments would trip
// (several already reference "use client" in prose).
//
// For each server-side .ts/.tsx file under a given directory, every static
// relative import is resolved on disk; when the resolved target itself
// carries the client directive, every named/default/namespace binding in
// the importing clause must either be type-only or begin with an uppercase
// letter (a React component — the one thing a Server Component may
// legitimately pass across the boundary). Anything else is a violation.

import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const APP_ROOT = path.join(ROOT, "apps", "web", "app");

/** Strips leading whitespace and line/block comments, returning what's left
 * — the file's first real statement, if any. */
function stripLeadingCommentsAndWhitespace(source: string): string {
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] as string)) i++;
    if (source.startsWith("//", i)) {
      const newlineIndex = source.indexOf("\n", i);
      i = newlineIndex === -1 ? source.length : newlineIndex + 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const endIndex = source.indexOf("*/", i + 2);
      i = endIndex === -1 ? source.length : endIndex + 2;
      continue;
    }
    break;
  }
  return source.slice(i);
}

/** True when `"use client"` (or `'use client'`) is the file's first real
 * statement — the same rule React/Next.js itself enforces for the
 * directive to take effect. */
function hasClientDirective(source: string): boolean {
  const stripped = stripLeadingCommentsAndWhitespace(source);
  return /^["']use client["']\s*;?/.test(stripped);
}

interface ImportBinding {
  name: string;
  typeOnly: boolean;
}

interface ParsedImport {
  specifier: string;
  wholeClauseTypeOnly: boolean;
  bindings: ImportBinding[];
}

/** Parses the clause between `import` and `from` into its bindings: a
 * default import, a namespace import (`* as X`), and/or named imports
 * (`{ A, type B, C as D }`). */
function parseClauseBindings(clause: string): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  const trimmed = clause.trim();

  const braceMatch = /\{([\s\S]*)\}/.exec(trimmed);
  const beforeBrace = (braceMatch ? trimmed.slice(0, braceMatch.index) : trimmed).trim();

  const defaultMatch = /^([A-Za-z_$][\w$]*)\s*,?$/.exec(beforeBrace);
  if (defaultMatch) {
    bindings.push({ name: defaultMatch[1] as string, typeOnly: false });
  }

  const namespaceMatch = /^\*\s+as\s+([A-Za-z_$][\w$]*)\s*,?$/.exec(beforeBrace);
  if (namespaceMatch) {
    bindings.push({ name: namespaceMatch[1] as string, typeOnly: false });
  }

  if (braceMatch) {
    const items = (braceMatch[1] as string)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    for (const item of items) {
      const typeOnly = /^type\s+/.test(item);
      const withoutType = item.replace(/^type\s+/, "").trim();
      const asMatch = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(withoutType);
      const localName = asMatch ? (asMatch[1] as string) : withoutType;
      if (localName) bindings.push({ name: localName, typeOnly });
    }
  }

  return bindings;
}

/** Every static `import ... from "..."` statement in `source` whose
 * specifier is relative (packages and `next/*` are not in scope for this
 * gate). Side-effect-only imports (`import "./x.css"`, no clause) never
 * match this pattern and are correctly skipped. */
function extractRelativeImports(source: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const importRe = /import\s+(type\s+)?([\s\S]+?)\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    const [, typeKeyword, clause, specifier] = match as unknown as [string, string | undefined, string, string];
    if (!specifier.startsWith(".")) continue;
    results.push({
      specifier,
      wholeClauseTypeOnly: Boolean(typeKeyword),
      bindings: typeKeyword ? [] : parseClauseBindings(clause),
    });
  }
  return results;
}

function findSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => path.join(dir, entry));
}

/** Walks `appDir` for every server-side .ts/.tsx file (no client directive)
 * and reports every relative import of a non-type, non-component binding
 * from a module that DOES carry the client directive. */
export function findBoundaryViolations(appDir: string): string[] {
  const violations: string[] = [];

  for (const file of findSourceFiles(appDir)) {
    const source = readFileSync(file, "utf8");
    if (hasClientDirective(source)) continue; // not a Server Component — out of scope for this gate

    for (const imp of extractRelativeImports(source)) {
      if (imp.wholeClauseTypeOnly) continue; // whole-clause type-only import — always safe

      const targetPath = path.resolve(path.dirname(file), imp.specifier);
      if (!existsSync(targetPath)) continue;

      const targetSource = readFileSync(targetPath, "utf8");
      if (!hasClientDirective(targetSource)) continue;

      for (const binding of imp.bindings) {
        if (binding.typeOnly) continue;
        if (/^[A-Z]/.test(binding.name)) continue; // a React component — legitimate across the boundary
        violations.push(
          `${file}: imports '${binding.name}' from client module '${imp.specifier}' (resolved: ${targetPath})`
        );
      }
    }
  }

  return violations;
}

describe("SERVER-CLIENT-BOUNDARY: real source", () => {
  it("SERVER-CLIENT-BOUNDARY: no Server Component under apps/web/app imports a non-component value from a \"use client\" module", () => {
    expect(findBoundaryViolations(APP_ROOT)).toEqual([]);
  });
});

describe("SERVER-CLIENT-BOUNDARY: positive control", () => {
  it("SERVER-CLIENT-BOUNDARY: detects a synthetic violation, proving the detector actually detects", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "server-client-boundary-"));
    try {
      writeFileSync(
        path.join(dir, "client-module.ts"),
        [
          '"use client";',
          "",
          "export function helperFn(): string {",
          '  return "not a component";',
          "}",
          "",
        ].join("\n")
      );
      writeFileSync(
        path.join(dir, "server-page.tsx"),
        [
          "// A fake Server Component — no client directive.",
          "",
          'import { helperFn } from "./client-module.ts";',
          "",
          "export default function ServerPage() {",
          "  return helperFn();",
          "}",
          "",
        ].join("\n")
      );

      const violations = findBoundaryViolations(dir);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("helperFn");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// tests/toolchain/css-pipeline.test.ts (CSS-PIPELINE)
//
// apps/web/app/globals.css declares a complete Tailwind v4 theme, but until
// this gate existed no PostCSS plugin ever processed it — the committed
// build artifact was the source stylesheet passed through verbatim, theme
// at-rule un-expanded, zero utility classes generated. This gate proves the
// real pipeline end to end: the config exists and names the right plugin,
// the plugin/tailwindcss version pin stays in lockstep, a real compile
// resolves the theme and emits utilities, and the stylesheet never gains a
// network reference.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const POSTCSS_CONFIG_PATH = path.join(WEB_ROOT, "postcss.config.mjs");
const GLOBALS_CSS_PATH = path.join(WEB_ROOT, "app/globals.css");

function readRootPackageJson(): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const raw = readFileSync(path.join(ROOT, "package.json"), "utf-8");
  return JSON.parse(raw);
}

describe("CSS pipeline (CSS-PIPELINE)", () => {
  it("apps/web/postcss.config.mjs exists and names the Tailwind plugin", async () => {
    expect(existsSync(POSTCSS_CONFIG_PATH)).toBe(true);
    const mod = await import(pathToFileURL(POSTCSS_CONFIG_PATH).href);
    const config = mod.default;
    expect(config).toBeDefined();
    expect(config.plugins).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(config.plugins, "@tailwindcss/postcss")).toBe(
      true
    );
  });

  it("pins @tailwindcss/postcss and tailwindcss to the identical exact version", () => {
    const pkg = readRootPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pluginVersion = allDeps["@tailwindcss/postcss"];
    const tailwindVersion = allDeps["tailwindcss"];
    expect(pluginVersion).toBeDefined();
    expect(tailwindVersion).toBeDefined();
    expect(pluginVersion).toBe(tailwindVersion);
  });

  it("compiles globals.css through the real plugin and resolves the theme into utilities", async () => {
    const source = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const result = await postcss([tailwindPostcss()]).process(source, {
      from: GLOBALS_CSS_PATH,
    });
    const css = result.css;

    // (a) the theme block has actually been processed — the resolved
    // custom property carries its real value, not the un-expanded at-rule.
    expect(css).toMatch(/--color-seal:\s*#7c2334/i);

    // (b) at least one generated utility rule exists for each of the two
    // named tokens.
    expect(css).toMatch(/\.text-seal\b/);
    expect(css).toMatch(/\.bg-surface\b/);

    // (c) no un-expanded @theme at-rule survives — the exact signature of
    // the original breakage. Anchored on the at-sign so a mention inside a
    // CSS comment cannot satisfy or defeat the match.
    expect(css).not.toMatch(/@theme\s*\{/);
  });

  it("globals.css declares no webfont and no network reference (comments stripped)", () => {
    const raw = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/@font-face/);
    expect(stripped).not.toMatch(/url\(/);
  });
});

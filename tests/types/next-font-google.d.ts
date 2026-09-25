// tests/types/next-font-google.d.ts
//
// Ambient module shim for `next/font/google`, scoped to this "tests" tsc
// project only. tests/tsconfig.json inherits "nodenext" module resolution
// from tsconfig.base.json, and `next` ships no package.json "exports" map —
// the exact, already-documented gap tests/tsconfig.json's own header note
// records for "next/navigation"/"next/headers" (why intake-form.tsx and
// current-actor.ts are excluded from this project's program). Unlike those
// two, apps/web/app/layout.tsx cannot be excluded here: it is imported
// directly by tests/routes/honesty.test.ts (07.1-01 added a next/font/google
// import to layout.tsx for the Claude Design restyle's self-hosted
// typography). This shim lets nodenext resolution succeed for THIS project
// only — apps/web's own `tsc -p apps/web/tsconfig.json` run resolves the
// real, full next/font/google types under its own "bundler" resolution
// (proven directly; unaffected by this file).
declare module "next/font/google" {
  interface NextFontWithVariable {
    className: string;
    style: { fontFamily: string; fontWeight?: string };
    variable: string;
  }
  type FontLoaderOptions = Record<string, unknown>;
  export function IBM_Plex_Sans(options?: FontLoaderOptions): NextFontWithVariable;
  export function IBM_Plex_Mono(options?: FontLoaderOptions): NextFontWithVariable;
  export function Newsreader(options?: FontLoaderOptions): NextFontWithVariable;
}

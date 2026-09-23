// tests/fixtures/next-font-google-mock.ts
//
// A test-only stand-in for `next/font/google`. Next's real font loaders
// (IBM_Plex_Sans, IBM_Plex_Mono, Newsreader — apps/web/app/layout.tsx,
// 07.1-01 Task 1) are transformed at build time by Next's own webpack/SWC
// font-loader plugin, which fetches the real font files and rewrites the
// import into a plain object. Outside that pipeline — i.e. under Vitest,
// which has no such transform — importing `next/font/google` directly
// resolves every named export to `undefined` (verified: the real package's
// dist build has no runtime implementation to call outside the Next
// compiler), so any test that renders apps/web/app/layout.tsx directly
// (tests/routes/honesty.test.ts) needs this module aliased in over the real
// one. Every export is a callable that returns the same minimal
// `NextFontWithVariable`-shaped object real code only reads `.variable` off
// of (see layout.tsx's `FONT_VARIABLES` construction) — nothing in this
// codebase inspects `.className` or `.style` from these three loaders.
function mockFontLoader() {
  return {
    className: "mock-font-class",
    variable: "mock-font-variable",
    style: { fontFamily: "mock-font-family" },
  };
}

export const IBM_Plex_Sans = mockFontLoader;
export const IBM_Plex_Mono = mockFontLoader;
export const Newsreader = mockFontLoader;

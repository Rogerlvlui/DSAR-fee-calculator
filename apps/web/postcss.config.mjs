// apps/web/postcss.config.mjs
//
// Lives at apps/web (the Next.js project root, where `next dev` is spawned
// by apps/web/scripts/dev.mjs) rather than the repo root. Turbopack
// resolves a PostCSS config from the Next.js project root first by
// default — confirmed against the vendored docs at
// apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopackLocalPostcssConfig.md,
// which states the default resolution order is "Project root -> CSS file's
// directory". experimental.turbopackLocalPostcssConfig is deliberately NOT
// set in next.config.ts, since that flag reverses the resolution order this
// placement relies on.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

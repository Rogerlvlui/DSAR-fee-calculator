// apps/web/src/domain/recompute-banner.ts
//
// Relocated from apps/web/src/ui/review/recompute-confirm.tsx (a
// "use client" module) — the identical defect class fixed in
// pack-display-status.ts, found live on the legal review screen.
// This function's only production caller is
// apps/web/app/legal/assessments/[id]/page.tsx, a Server Component, so it
// cannot live in a module that carries the client directive.
// recompute-confirm.tsx never called this function itself (its own header
// said so), so removing the export from that file changes nothing about
// the component. No "use client" directive here, and no imports at all.

/** The gate this component's caller uses to decide whether to render
 * anything at all — a genuine version mismatch shows the banner; identical
 * versions (today's real case for every committed pack, since each has
 * exactly one version file — 06-RESEARCH.md Pitfall 5) show nothing. */
export function shouldRenderRecomputeBanner(pinnedVersion: string, newVersion: string): boolean {
  return pinnedVersion !== newVersion;
}

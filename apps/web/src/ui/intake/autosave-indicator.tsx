// apps/web/src/ui/intake/autosave-indicator.tsx
//
// A small presentational component rendering INTAKE-09's three save-state
// copy strings, verbatim (05-UI-SPEC.md Copywriting Contract). "idle" and
// "saving" render identically — a first-time viewer gains nothing from
// distinguishing "has never saved" from "is saving right now"; both
// correctly read as "not yet confirmed saved."

import type { AutosaveStatus } from "./use-draft-autosave.ts";

const SIXTY_SECONDS_MS = 60_000;

/** "just now" under 60 seconds, otherwise "{n} minute(s) ago". `now`
 * defaults to the real clock but is overridable so a test can supply a
 * fixed instant rather than depending on real wall-clock timing. */
export function formatRelativeAutosaveTime(savedAt: number | null, now: number = Date.now()): string {
  if (savedAt === null) return "";
  const elapsedMs = now - savedAt;
  if (elapsedMs < SIXTY_SECONDS_MS) return "just now";
  const minutes = Math.floor(elapsedMs / SIXTY_SECONDS_MS);
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export const AUTOSAVE_FAILED_SENTENCE =
  "Save failed — your entries are still on this page; try again or copy them out.";

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  savedAt: number | null;
  /** Overridable so a test can supply a fixed instant. */
  now?: number;
}

export function AutosaveIndicator({ status, savedAt, now }: AutosaveIndicatorProps) {
  if (status === "error") {
    return <p data-testid="autosave-indicator">{AUTOSAVE_FAILED_SENTENCE}</p>;
  }
  if (status === "saved") {
    return <p data-testid="autosave-indicator">Saved {formatRelativeAutosaveTime(savedAt, now)}</p>;
  }
  // "idle" and "saving" render identically.
  return <p data-testid="autosave-indicator">Saving…</p>;
}

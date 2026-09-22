// apps/web/src/ui/intake/use-draft-autosave.ts
//
// INTAKE-09 — the one piece of this phase's requirement list with no
// precedent anywhere in this codebase: a 10-second client-local autosave
// with a visible, testable save-state cadence. `writeDraftToStorage` is the
// pure, directly-testable storage mechanism (the same extraction technique
// apps/web/src/ui/capability/capability-statement.tsx already established
// with `isConfirmationPhraseConfirmed`); `useDraftAutosave` is the hook that
// calls it on an interval.
//
// This module writes to browser storage only — it never reaches the
// network and never reaches this codebase's audit log, matching
// PROJECT.md's "no server-persisted drafts" boundary.

"use client";

import { useEffect, useRef, useState } from "react";

export function writeDraftToStorage(
  key: string,
  value: unknown,
  storage: Pick<Storage, "setItem"> = window.localStorage
): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveState {
  status: AutosaveStatus;
  savedAt: number | null;
}

/**
 * Autosaves `value` to `localStorage` under `key` every `intervalMs`
 * (default 10 seconds). `value` is held in a ref updated on every render so
 * the interval callback always reads the LATEST value, never one captured
 * once at mount. The `"saving"` status is separated from the immediately-
 * following `"saved"`/`"error"` update by a microtask boundary
 * (`Promise.resolve()`) — otherwise React's automatic batching would
 * collapse the two into a single render, making "saving" untestable and
 * invisible, even though the UI-SPEC's own cadence requirement calls for it
 * to exist as a real, observable state.
 */
export function useDraftAutosave(key: string, value: unknown, intervalMs = 10_000): AutosaveState {
  const [state, setState] = useState<AutosaveState>({ status: "idle", savedAt: null });
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const interval = setInterval(() => {
      setState({ status: "saving", savedAt: null });
      void Promise.resolve().then(() => {
        const succeeded = writeDraftToStorage(key, valueRef.current);
        setState((previous) =>
          succeeded ? { status: "saved", savedAt: Date.now() } : { status: "error", savedAt: previous.savedAt }
        );
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [key, intervalMs]);

  return state;
}

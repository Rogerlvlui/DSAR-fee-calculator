// apps/web/src/ui/review/review-keyboard-scope.tsx
//
// REVIEW-08: wires j/k/a/r/s/? onto the legal review screen — a single
// window-scoped keydown listener that drives disposition-controls.tsx's
// EXISTING data-action DOM hooks from outside. Zero changes to
// disposition-controls.tsx's own internals: this scope only ever calls
// .click()/.focus() on the SAME real DOM elements a mouse interaction would
// reach, so hasSufficientReason and every other server-authoritative gate
// stays exactly as it is (T-06-15's own accepted-risk reasoning).
//
// The single most important correctness property this component has: a
// keydown while focus is inside an <input>/<textarea>/<select> (the reason
// field, an amount field) is ignored entirely — a lawyer typing the letter
// "j" into their reason text must never trigger navigation. Proven by its
// own dedicated test, not merely assumed.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { mapReviewKey } from "../../domain/keyboard-shortcuts.ts";
import { ShortcutHelpOverlay, ShortcutHelpTrigger, type ShortcutBinding } from "../chrome/shortcut-help-overlay.tsx";

const REVIEW_BINDINGS: ShortcutBinding[] = [
  { keys: ["j", "k"], description: "move between lines" },
  { keys: ["a"], description: "accept / allow (this line's default action)" },
  { keys: ["r"], description: "reduce (allowed lines only)" },
  { keys: ["s"], description: "strike (allowed lines only)" },
  { keys: ["?"], description: "show this help" },
  { keys: ["Esc"], description: "close this help" },
];

const REVIEW_NO_OP_NOTE =
  "Reduce and strike are only offered on lines already supported by a rule. Pressing that key on any other line does nothing.";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

function focusLine(lineId: string): void {
  const card = document.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`);
  card?.focus();
  // jsdom (this codebase's test environment) does not implement
  // scrollIntoView — guarded so tests can exercise real focus movement
  // without polyfilling a browser-only API this component only calls for
  // UX polish, never for correctness.
  card?.scrollIntoView?.({ block: "nearest" });
}

function clickCardAction(lineId: string, action: string): void {
  const card = document.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`);
  const button = card?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  button?.click();
}

function focusReduceAmountInput(lineId: string): void {
  const card = document.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`);
  const reduceButton = card?.querySelector<HTMLButtonElement>('[data-action="reduce"]');
  const amountInput = reduceButton?.parentElement?.querySelector<HTMLInputElement>('input[type="number"]');
  amountInput?.focus();
}

export interface ReviewKeyboardScopeProps {
  lineIds: readonly string[];
  // Optional in the type only because React.createElement's overloads
  // check props separately from later variadic children arguments — every
  // real caller (assessment-view.tsx) supplies children via JSX, where this
  // is effectively required.
  children?: ReactNode;
}

export function ReviewKeyboardScope({ lineIds, children }: ReviewKeyboardScopeProps) {
  // null means "no card has been keyboard-focused yet" — the first j OR k
  // press lands on the first card (index 0); every press after that moves
  // relative to the current index, clamped at both ends.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || hasModifier(event)) return;

      const intent = mapReviewKey(event.key);
      if (intent === null) return;

      switch (intent) {
        case "MOVE_NEXT": {
          setFocusedIndex((current) => {
            const next = current === null ? 0 : Math.min(current + 1, Math.max(lineIds.length - 1, 0));
            const lineId = lineIds[next];
            if (lineId) focusLine(lineId);
            return next;
          });
          break;
        }
        case "MOVE_PREV": {
          setFocusedIndex((current) => {
            const prev = current === null ? 0 : Math.max(current - 1, 0);
            const lineId = lineIds[prev];
            if (lineId) focusLine(lineId);
            return prev;
          });
          break;
        }
        case "ACCEPT": {
          const lineId = focusedIndex === null ? undefined : lineIds[focusedIndex];
          if (lineId) clickCardAction(lineId, "accept");
          break;
        }
        case "STRIKE": {
          const lineId = focusedIndex === null ? undefined : lineIds[focusedIndex];
          if (lineId) clickCardAction(lineId, "strike");
          break;
        }
        case "REDUCE": {
          const lineId = focusedIndex === null ? undefined : lineIds[focusedIndex];
          if (lineId) focusReduceAmountInput(lineId);
          break;
        }
        case "HELP":
          setHelpOpen(true);
          break;
        case "CLOSE_HELP":
          setHelpOpen(false);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineIds, focusedIndex]);

  return (
    <div data-testid="review-keyboard-scope">
      {children}
      <ShortcutHelpTrigger onOpen={() => setHelpOpen(true)} />
      <ShortcutHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        heading="Keyboard shortcuts"
        bindings={REVIEW_BINDINGS}
        note={REVIEW_NO_OP_NOTE}
      />
    </div>
  );
}

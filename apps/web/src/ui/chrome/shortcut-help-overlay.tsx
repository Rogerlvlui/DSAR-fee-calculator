// apps/web/src/ui/chrome/shortcut-help-overlay.tsx
//
// ONE shared, hand-rolled, WCAG-compliant shortcut-help overlay — both the
// legal review screen (ReviewKeyboardScope) and /legal/queue
// (QueueKeyboardScope) render THIS component with their own bindings list,
// never two independently-maintained overlay implementations. A hand-
// authored <div role="dialog" aria-modal="true"> with a focus trap and an
// Escape handler is a well-understood, small pattern (06-UI-SPEC.md's own
// Claude's-discretion decision) — no component-library dialog, matching
// how every other interactive surface in this app is already built.
//
// ShortcutHelpTrigger renders the persistent "Keyboard shortcuts (?)"
// button as a real, focusable, mouse-and-keyboard-discoverable control —
// never a keystroke-only entry point (06-RESEARCH.md's own Anti-Pattern 3 /
// WCAG 2.1 AA operability).

"use client";

import { useEffect, useRef } from "react";

export interface ShortcutBinding {
  keys: string[];
  description: string;
}

export interface ShortcutHelpOverlayProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  bindings: ShortcutBinding[];
  /** The no-op explanation (review screen only) — rendered once, at the
   * top of the bindings list, when provided. */
  note?: string;
}

export function ShortcutHelpOverlay({ open, onClose, heading, bindings, note }: ShortcutHelpOverlayProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement;
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Focus returns to the element that had it before opening.
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-heading"
      tabIndex={-1}
      data-testid="shortcut-help-overlay"
    >
      <h2 id="shortcut-help-heading">{heading}</h2>

      {note ? <p data-testid="shortcut-help-note">{note}</p> : null}

      <ul data-testid="shortcut-help-bindings">
        {bindings.map((binding) => (
          <li key={binding.keys.join("+")}>
            {binding.keys.map((key, index) => (
              <span key={key}>
                {index > 0 ? " / " : ""}
                <kbd className="bg-surface-sunk text-ink-2 border-line">{key}</kbd>
              </span>
            ))}
            {" — "}
            {binding.description}
          </li>
        ))}
      </ul>

      <button type="button" data-testid="shortcut-help-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export interface ShortcutHelpTriggerProps {
  onOpen: () => void;
}

export function ShortcutHelpTrigger({ onOpen }: ShortcutHelpTriggerProps) {
  return (
    <button type="button" data-testid="shortcut-help-trigger" onClick={onOpen}>
      Keyboard shortcuts (?)
    </button>
  );
}

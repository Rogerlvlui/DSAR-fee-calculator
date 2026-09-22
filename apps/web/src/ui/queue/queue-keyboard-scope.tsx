// apps/web/src/ui/queue/queue-keyboard-scope.tsx
//
// NAV-03: wires j/k/? onto /legal/queue's row list, mirroring
// review-keyboard-scope.tsx's own structure closely. Row anchors are
// natively focusable and already navigate on native Enter — this scope's
// own job is j/k row-to-row movement plus the shared ? overlay; OPEN is
// never custom-dispatched (no .click()/router.push() call for it anywhere
// in this file) — native anchor-Enter behavior is relied on, never
// duplicated.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { mapQueueKey } from "../../domain/keyboard-shortcuts.ts";
import { ShortcutHelpOverlay, ShortcutHelpTrigger, type ShortcutBinding } from "../chrome/shortcut-help-overlay.tsx";

const QUEUE_BINDINGS: ShortcutBinding[] = [
  { keys: ["j", "k"], description: "move between claims" },
  { keys: ["Enter"], description: "open the focused claim" },
  { keys: ["?"], description: "show this help" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

function focusRow(rowId: string): void {
  const row = document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`);
  row?.focus();
  row?.scrollIntoView?.({ block: "nearest" });
}

export interface QueueKeyboardScopeProps {
  rowIds: readonly string[];
  children?: ReactNode;
}

export function QueueKeyboardScope({ rowIds, children }: QueueKeyboardScopeProps) {
  // null means "no row has been keyboard-focused yet" — mirrors
  // ReviewKeyboardScope's own model exactly: the first j OR k press lands
  // on the first row.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || hasModifier(event)) return;

      const intent = mapQueueKey(event.key);
      if (intent === null) return;

      switch (intent) {
        case "MOVE_NEXT": {
          setFocusedIndex((current) => {
            const next = current === null ? 0 : Math.min(current + 1, Math.max(rowIds.length - 1, 0));
            const rowId = rowIds[next];
            if (rowId) focusRow(rowId);
            return next;
          });
          break;
        }
        case "MOVE_PREV": {
          setFocusedIndex((current) => {
            const prev = current === null ? 0 : Math.max(current - 1, 0);
            const rowId = rowIds[prev];
            if (rowId) focusRow(rowId);
            return prev;
          });
          break;
        }
        case "OPEN":
          // Deliberately no custom handling — native anchor-Enter behavior
          // already navigates. See module note.
          break;
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
  }, [rowIds]);

  return (
    <div data-testid="queue-keyboard-scope">
      {children}
      <ShortcutHelpTrigger onOpen={() => setHelpOpen(true)} />
      <ShortcutHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        heading="Keyboard shortcuts"
        bindings={QUEUE_BINDINGS}
      />
    </div>
  );
}

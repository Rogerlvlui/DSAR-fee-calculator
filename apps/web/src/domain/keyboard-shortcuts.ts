// apps/web/src/domain/keyboard-shortcuts.ts
//
// The pure key->intent map for both keyboard-first surfaces (REVIEW-08's
// review screen, NAV-03's /legal/queue). Zero imports from react or any DOM
// type — a pure, framework-free module, fully unit-testable in isolation,
// per 06-RESEARCH.md's own Project Structure table. No third-party
// keybinding library dependency was added for this — six bindings on one
// screen plus three on another, sharing one overlay, stays inside "don't
// hand-roll" territory reversed (06-RESEARCH.md's own Alternatives
// Considered row).
//
// Case-sensitive on the letter keys, deliberately: `Shift+j` producing "J"
// does not map, so a colliding Shift-modified keystroke is never a
// surprising trap for a real keyboard user. This module only maps a `key`
// string — callers (ReviewKeyboardScope/QueueKeyboardScope) are responsible
// for ignoring the event when a modifier key (ctrl/meta/alt) is held, so
// browser/OS shortcuts are never intercepted, and for ignoring keydowns
// while focus is inside a text input, so typing "j" into a reason field
// never triggers navigation.

export type ReviewKeyboardIntent = "MOVE_NEXT" | "MOVE_PREV" | "ACCEPT" | "REDUCE" | "STRIKE" | "HELP" | "CLOSE_HELP";

export function mapReviewKey(key: string): ReviewKeyboardIntent | null {
  switch (key) {
    case "j":
      return "MOVE_NEXT";
    case "k":
      return "MOVE_PREV";
    case "a":
      return "ACCEPT";
    case "r":
      return "REDUCE";
    case "s":
      return "STRIKE";
    case "?":
      return "HELP";
    case "Escape":
      return "CLOSE_HELP";
    default:
      return null;
  }
}

export type QueueKeyboardIntent = "MOVE_NEXT" | "MOVE_PREV" | "OPEN" | "HELP" | "CLOSE_HELP";

export function mapQueueKey(key: string): QueueKeyboardIntent | null {
  switch (key) {
    case "j":
      return "MOVE_NEXT";
    case "k":
      return "MOVE_PREV";
    case "Enter":
      return "OPEN";
    case "?":
      return "HELP";
    case "Escape":
      return "CLOSE_HELP";
    default:
      return null;
  }
}

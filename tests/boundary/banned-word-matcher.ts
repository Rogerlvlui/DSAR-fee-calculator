// tests/boundary/banned-word-matcher.ts
//
// AC-32(a)'s single word-boundary matcher, shared by
// packages/engine/src/engine-language.test.ts (engine-authored language)
// and tests/boundary/ui-banned-words.test.ts (apps/web's rendered UI text)
// — both checks are against the SAME closed word list
// (LEGAL_CONCLUSION_BANNED_WORDS, @dsar/schemas/constants), so they share
// one matcher rather than each independently re-deriving the same regex.
//
// Matching is case-SENSITIVE and on word boundaries: messages.ts and this
// codebase's UI both legitimately refer to the Legal DEPARTMENT by name
// ("referred to Legal", "Ask Legal") — a case-insensitive match would
// false-positive on every one of those. The banned adjective is the
// lower-case "legal" (as in "this fee is legal"); each caller's own control
// case proves the matcher still catches that lower-case form.

export function findBannedWord(text: string, words: readonly string[]): string | null {
  for (const word of words) {
    const pattern = new RegExp(`\\b${word}\\b`); // case-sensitive by default, word-boundary anchored
    if (pattern.test(text)) return word;
  }
  return null;
}

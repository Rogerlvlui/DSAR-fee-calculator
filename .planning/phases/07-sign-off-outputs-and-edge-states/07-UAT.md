---
status: testing
phase: 07-sign-off-outputs-and-edge-states
source: [07-VERIFICATION.md]
started: "2026-09-22T09:20:00.000Z"
updated: "2026-09-22T09:20:00.000Z"
---

## Current Test

number: 1
name: PDF page-2+ header/footer visual check
expected: |
  Page 2+ carries the same repeating ten-column header row and the same disclosure
  footer text (pack id, pack version, engine version, lawyer name, qualification,
  date) as page 1 — no page carries a different, truncated, or missing provenance
  claim.
awaiting: user response

## Tests

### 1. PDF page-2+ header/footer visual check
expected: Sign off a matter through the real UI/route so its internal record spans
  2+ pages (e.g. a 20+ line assessment against a real pack), download the PDF, and
  open it in a real PDF viewer. Check that the ten-column header row repeats
  correctly on page 2 (and later) and that the disclosure footer's text is
  identical and correct on every page, not only page 1.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

None — this is the phase's own honestly-disclosed automated-coverage limit (07-04-SUMMARY.md's coverage entry D4: `human_judgment: true`), not a discovered defect. The mechanism is proven wired (pagination occurs, buffer size scales, `fixed`/`pageNumber > 1` gating confirmed by direct code read) — only the rendered *text* on page 2+ is unverified by automation, since this project deliberately carries no PDF-text-extraction dependency.

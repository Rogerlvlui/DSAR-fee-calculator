---
phase: "06"
slug: "convergence-and-legal-review"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-20"
---

# Phase 6 — UI Design Contract

> Scope note, read this before the rest of the document: 06-RESEARCH.md establishes that 8 of the
> 12 REVIEW-\* requirements — the review card, the per-verdict disposition controls, the mandatory
> reason field's length check, "Ask HR", the FLAG reasons-in-words block, and the
> `NEEDS_VERIFICATION`/`restingOnUnverifiedRules` DOM structure — already shipped in Phases 3.1/4
> and are **not** re-specified here. This contract covers only the net-new or visually-incomplete
> surfaces: (1) `/legal/queue`, (2) the keyboard-first review/queue flow and its shortcut-help
> overlay, (3) the verdict badge's accessible name, (4) the mandatory-reason stop-list's rejection
> UI, (5) the flat-fee-vs-itemised choice, (6) the visual (not just DOM) distinctness of FLAG
> reasons and `NEEDS_VERIFICATION` markers, and (7) the recompute-against-a-newer-pack confirmation
> banner (REVIEW-10 — genuinely new per research, included briefly for phase-scope completeness
> even though the request that produced this document did not number it separately). Every design
> token below is **inherited unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md` /
> `apps/web/app/globals.css`** — this phase adds no new spacing, typography or colour token; it
> reuses the existing four-colour verdict/status system and the existing accent/destructive
> reservations, extended by name where a new UI state needs one of them. Reproduced here in full so
> this document is a complete, standalone contract, not a diff the checker/executor must
> cross-reference.
>
> **A structural note the UI, not just the backend, depends on:** 06-RESEARCH.md's Open Question 2
> recommends restructuring routes now so `/legal/queue` is a real path (renaming the existing
> `/assessments` worklist rather than adding a second, parallel list). This document assumes that
> recommendation is accepted — the queue design below is an extension of `/assessments`'s existing
> markup (`AssessmentsListPage` in `apps/web/app/(legal)/assessments/page.tsx`), not a new visual
> system. If the planner instead scopes `/legal/queue` as an isolated addition alongside an
> unchanged `/assessments`, the design contract below still applies verbatim to whichever route
> NAV-01 ends up naming — nothing here depends on the URL segment itself, only on the page's
> existing list/row/empty-state shape.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — hand-authored React components in `apps/web`, styled with Tailwind v4 CSS-first tokens (`@theme`) already declared in `apps/web/app/globals.css` |
| Icon library | none — no icon is used anywhere in the existing UI (verdict/state is conveyed by badge text + colour, never a glyph); this phase's keyboard shortcut overlay renders key names as text inside `<kbd>` elements, not icons, and does not introduce one |
| Font | System stack only, no webfonts, no network fetch — unchanged from Phase 3.1/5 |

**Decision (Claude's discretion, per the auto-mode framing — not a legal question):** no shadcn.
`components.json` still does not exist. The shortcut help overlay is the one surface in this phase
that could tempt a "just grab a dialog component" reflex — it does not need one: a hand-rolled
`<div role="dialog" aria-modal="true">` with a focus trap and an Escape handler is a well-understood,
small pattern, and every other interactive surface in this app (reason textareas, disposition
buttons, the sign-off panel) is already hand-authored semantic markup with no component library
underneath it. Introducing shadcn for one dialog would create two visual systems inside one app at
exactly the phase where the app is supposed to be converging, not diverging. `Component Inventory`
and `Registry Safety` sections are omitted per the template's own instruction for `Tool: none`.

---

## Spacing Scale

Unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md` / `apps/web/app/globals.css`. Every spacing
value used by this phase's new/changed surfaces must be one of these ten tokens — no new value, no
non-4-multiple pixel value:

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Icon-free inline gaps (badge-to-text, keycap-to-keycap in the shortcut overlay) |
| xs | 8px | Compact element spacing |
| sm | 12px | Dense internal padding (form field to hint text, queue row internal padding) |
| md | 16px | Default element spacing, page-section gaps, the `NEEDS_VERIFICATION` indent |
| lg | 20px | Card/panel internal padding |
| xl | 24px | Section padding |
| 2xl | 28px | Wide card padding |
| 3xl | 32px | Layout gaps between major panels |
| 4xl | 48px | Major section breaks |
| 5xl | 64px | Page-level top/bottom spacing |

**New-surface mapping:**
- `/legal/queue` rows: `sm` (12px) vertical padding per row — same as `/hr/matters`'s row rhythm
  (`05-UI-SPEC.md`), since this is the lawyer-side equivalent of the same list shape.
- Sort control (two toggle links above the list): `xs` (8px) gap between the two options, `md`
  (16px) below the page `h1`.
- Keyboard focus ring on a queue row or a review card: no new spacing token — this is the existing
  `focus-visible` outline (see Color), offset by the browser default; no custom padding is added
  around it.
- Shortcut help overlay: `xl` (24px) internal padding (panel content), `sm` (12px) row gap between
  each key→action pair, `2xs` (4px) gap between adjacent `<kbd>` elements when a binding is
  described with more than one key.
- Reason stop-list rejection text: same slot as the existing length-failure text
  (`disposition-reason-counter` / `bulk-accept-reason-counter`) — no new spacing, this is a text
  substitution in an existing container.
- `FlatFeeChoice`: `lg` (20px) internal padding, matching every other rail card (`MatterRail`,
  `PackRail`); `sm` (12px) gap between the two radio rows; `xs` (8px) top margin for the
  blocked/unverified note under a radio.
- Recompute banner: `lg` (20px) internal padding, `md` (16px) top margin above the cards region —
  same rhythm as the existing `litflag`/matter-flag treatment in `MatterRail`.

---

## Typography

Unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md` — exactly two weights (400, 600), four sizes:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 11px | 600 | 1.3 |
| Body | 14px | 400 | 1.5 |
| Heading | 16px | 600 | 1.3 |
| Display | 24px | 600 | 1.2 |

**New-surface mapping:**
- `/legal/queue` page title ("Legal queue") uses **Display** (`--serif`, 24px/600) — the same
  `h1.screen` class every other screen-level title uses (`AssessmentsListPage`'s existing
  precedent), not a new title treatment.
- Queue row reference renders in `--mono` at **Body** (14px/400), matching `StatusStrip`'s
  `rulePackId` cell and `/hr/matters`'s own reference rendering — a reference code is data, not
  prose, in every list this app has.
- Queue row status label and the sort-control links use **Label** (11px/600, uppercase) — the same
  weight class as a verdict badge, since a worklist status is a categorical signal, not running
  text.
- Advisory-deadline text on a queue row: **Label** for the word "Advisory" itself (in its own
  container, per DISC-05/AC-15a — unchanged rule), **Body** for the surrounding sentence — same
  split as `/hr/matters`'s row and `MatterRail`'s existing block.
- Shortcut help overlay heading ("Keyboard shortcuts") uses **Heading** (16px/600); each key→action
  row's action description uses **Body** (14px/400); the `<kbd>` key glyphs themselves use
  **Label** size (11px/600) in `--mono`, not `--sans` — a key name is a literal token, like a rule
  ID, not prose.
- The persistent "Keyboard shortcuts (?)" trigger button uses **Label** (11px/600, uppercase) — the
  same visual weight as every other small persistent control in this app (autosave indicator,
  badges), not a new button style.
- Reason stop-list rejection text uses **Body** (14px/400) — identical treatment to the existing
  length-failure text it replaces in the same slot (`REASON_COUNTER_FAILURE_TEXT`'s existing
  styling), never a new "error" text size.
- `FlatFeeChoice` section heading ("How should this fee be charged?") uses **Heading** (16px/600),
  matching `MatterRail`'s "Matter" / `PackRail`'s "Rule pack" section headers; the two amount
  figures use **Body** at 14px/400 with the `--mono` family override for the currency figure
  itself (matches every other money rendering in this app — `formatMinor`'s output is always
  `--mono`).
- Recompute banner heading/body follow the existing matter-flag treatment in `MatterRail`
  (`.litflag`-equivalent): **Heading** for the one-line summary, **Body** for the explanatory
  sentence — no new role.

---

## Color

Unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md`:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` (`--surface`) | Card/panel backgrounds, form fields, list rows |
| Secondary (30%) | `#eef0f2` (`--ground`) page backdrop + `#f5f6f8` (`--surface-sunk`) recessed zones | Outer page background; sunk rows; **new this phase:** the `<kbd>` keycap pill background |
| Accent (10%) | `#7c2334` (`--seal`), hover/active `#5e1a27` (`--seal-ink`), wash `#f7ecee` (`--seal-wash`) | Reserved for exactly: primary CTA buttons, the focus-visible outline ring on every interactive element — **extended this phase, not newly reserved, to cover the queue row's keyboard-focus ring and the review card's keyboard-focus ring**, since both are the same "focus-visible ring on an interactive element" case the reservation already covers — the wordmark's accent mark, the shortcut-overlay trigger button when focused |
| Destructive | `#a32020` (`--stop`), wash `#fbecec` (`--stop-wash`) | Reserved for exactly: the Strike action, required-field asterisks, the reason-field validation error state (border + counter text) when the ≥10-char **or stop-list** check fails — **this phase's stop-list rejection text uses this existing reservation, it does not add a new one** — and, new this phase, the flat-fee radio's blocked note when `flatFeeExceedsItemisedCost` is true |

**Verdict & status semantic colours** (unchanged four-colour system, every value carries a
**required text label**, never colour alone, WCAG 2.1 AA — this phase's job is applying the colour
half of a treatment `03.1-UI-SPEC.md` already specified but `line-card.tsx`/`totals-rail.tsx`
never carried through, per 06-RESEARCH.md Pitfall 3 / REVIEW-03's "text-only, no colour
differentiation" finding):

| Verdict/state | Colour | Wash | Required accompanying text (verbatim, unchanged) |
|---|---|---|---|
| `FLAG` | `--warn` `#8a5a06` | `--warn-wash` `#fbf1de` | "Needs your decision" |
| `ALLOW` | `--ok` `#1c6146` | `--ok-wash` `#e8f2ed` | "Supported by rule" |
| `ALLOW_CAPPED` | `--ok` `#1c6146` | `--ok-wash` `#e8f2ed` | "Supported — reduced to cap" |
| `DISALLOW` | `--deny` `#565f6c` | `--deny-wash` `#eceef1` | "Not supported" |
| Unverified rule marker | `--warn` `#8a5a06`, dashed border, no fill | transparent | "unverified rule" |
| `↳ resting on unverified rules` / `↳ excluded from every total` rows (`TotalsRail`) | `--ink-3` `#6b7480` text, `md` (16px) left indent | none | unchanged row labels — the indent plus muted colour is what makes the containment relationship legible per PRD §10.3's own warning that a lawyer who reads these as top-level figures "will think the totals don't add up" |

**New states this phase, all built from the existing four-colour system — no new hex value
anywhere:**

| New state | Colour | Wash | Required accompanying text (verbatim, never colour-only) |
|---|---|---|---|
| Flat-fee radio blocked (`flatFeeExceedsItemisedCost`) | `--stop` `#a32020` | none (inline text under the disabled radio, not a boxed callout) | "Blocked — this flat fee exceeds itemised direct cost, which the guidance does not permit." |
| Flat-fee rule needs verification | `--warn` `#8a5a06`, dashed border, no fill (same treatment as the per-line unverified marker) | transparent | "unverified rule" (identical marker, reused, not a new phrase) |
| Reason stop-list rejection | `--stop` `#a32020` (same reservation as the length-failure text) | none | see Copywriting Contract |
| Recompute banner | `--warn` `#8a5a06` text, `--warn-wash` `#fbf1de` fill, `--warn-edge` `#e0b869` border | `--warn-wash` | see Copywriting Contract |
| Keyboard focus ring (queue row / review card) | `--seal` `#7c2334` outline | none | not a colour-only signal — the focused element also gains a visible outline ring (a shape change, not just a hue change), satisfying WCAG 2.1 AA's non-colour-alone rule for focus indication the same way it already does for verdict badges |
| `<kbd>` keycap pill | `--ink-2` `#3c4450` text on `--surface-sunk` `#f5f6f8` fill, `--line` `#d8dce1` border | — | the key glyph itself (e.g. "J", "?") |

**Why no new hex value:** every one of these six new states maps onto one of the four colours
already in `globals.css` (`--ok`/`--warn`/`--stop`/`--deny`) plus the existing neutral surface
roles (`--surface-sunk`/`--ink-2`/`--line`), reusing the pattern the existing verdict badges and
`PACK_STATUS_DISCLOSURE` cell already establish. This keeps the 60/30/10 split and the
accent/destructive reservation lists exactly as declared, with only the two explicit extensions
noted above (keyboard focus rings under the existing accent reservation; the flat-fee blocked note
under the existing destructive reservation).

**Mode:** light only, unchanged.

**Visual focal point per new/changed screen:**
- **`/legal/queue`:** the list itself, sorted by advisory deadline by default — the row nearest its
  deadline is the primary scan target, mirroring `/hr/matters`'s "list is the focal point" rule but
  with the sort itself carrying the urgency signal this list needs that HR's worklist doesn't.
- **Legal review screen (unchanged focal point, reaffirmed):** the totals rail remains the single
  place a running number appears; this phase adds the flat-fee choice as a secondary anchor
  *within* that rail, directly above the headline block, since the choice determines which figure
  the headline will eventually resolve to.
- **Shortcut help overlay:** the key→action list itself; the overlay never competes with the
  underlying screen's own focal point because it is a modal — everything behind it is inert while
  it is open.

---

## Copywriting Contract

All strings below are **new to this phase** or are **existing locked strings reproduced for
completeness**. None may use any AC-32 banned word ("compliant", "non-compliant", "legal",
"illegal", "lawful", "unlawful", "approved", "safe").

| Element | Copy | Status |
|---------|------|--------|
| `/legal/queue` page title | "Legal queue" | New |
| `/legal/queue` empty state | "No claims are waiting on Legal right now. HR submits a claim, and it appears here." | Existing — reused verbatim from `/assessments`'s current empty state |
| `/legal/queue` row status labels | "Awaiting review" (`LEGAL_REVIEW`) · "Awaiting HR reply" (`INFO_REQUEST`) · "Signed off" (`SIGNED_OFF`, `CLOSED`) | "Awaiting review"/"Signed off" existing; "Awaiting HR reply" new — this list is lawyer-facing, so (unlike `/hr/matters`'s collapsed label) the real state may be shown; no ACCESS-02/03 leak-channel constraint applies to a `LEGAL_REVIEWER`'s own worklist |
| `/legal/queue` sort control | "Sort: Deadline soonest" / "Oldest first" — two toggle links, the active one marked with `aria-current="true"` and bold (Label weight is already 600; the active option additionally underlines so the distinction is not colour-only) | New |
| `/legal/queue` row advisory line | "Fee notification due {date} — {n} days. **Advisory only.**" (verbatim `ADVISORY_QUALIFIER` construction, reused from `MatterRail`/`05-UI-SPEC.md`, not re-worded) | Existing wiring, new surface |
| Keyboard shortcut overlay heading | "Keyboard shortcuts" | New |
| Keyboard shortcut overlay — review screen bindings | "`j` / `k` — move between lines" · "`a` — accept / allow (this line's default action)" · "`r` — reduce (allowed lines only)" · "`s` — strike (allowed lines only)" · "`?` — show this help" · "`Esc` — close this help" | New |
| Keyboard shortcut overlay — queue bindings | "`j` / `k` — move between claims" · "`Enter` — open the focused claim" · "`?` — show this help" | New |
| Keyboard shortcut overlay — no-op key note (shown once, at the top of the review-screen list) | "Reduce and strike are only offered on lines already supported by a rule. Pressing that key on any other line does nothing." | New — explains why `r`/`s` are inert on FLAG/DISALLOW lines without popping an error on every keystroke |
| Persistent shortcut-overlay trigger (mouse/keyboard-discoverable) | "Keyboard shortcuts (?)" | New — a real, focusable button, not a keystroke-only entry point (WCAG 2.1 AA operability; 06-RESEARCH.md anti-pattern 3) |
| Reason stop-list rejection | "That's a stock phrase, not a reason — say what you found or decided instead of '{phrase}'." (`{phrase}` is the matched stop-list entry, e.g. "noted") | New — replaces, in the same slot, `REASON_COUNTER_FAILURE_TEXT`'s existing "A reason of at least 10 characters is required — 'ok' will not do." whenever the stop-list check (not just the length check) is what failed |
| `FlatFeeChoice` heading | "How should this fee be charged?" | New |
| `FlatFeeChoice` option — itemised | "Itemised — sum of every allowed line: {amount}" | New |
| `FlatFeeChoice` option — flat | "Flat fee: {amount}" | New |
| `FlatFeeChoice` helper text | "Permitted for administrative convenience where it stays below itemised direct cost." | New |
| `FlatFeeChoice` blocked note | "Blocked — this flat fee exceeds itemised direct cost, which the guidance does not permit." | New |
| `FlatFeeChoice` submit failure | "Your choice wasn't saved — {typed error detail}. It still shows the previous choice." | New — matches the existing inline-error, revert-not-navigate pattern every other control in this screen uses |
| Recompute banner heading | "A newer rule pack ({newVersion}) is now active." | New — PRD §10.7 construction |
| Recompute banner body | "This assessment uses {pinnedVersion}. Recompute against {newVersion}?" | New — PRD §10.7 construction |
| Recompute banner — expand-to-confirm (inline, non-modal) | "This will clear every disposition recorded so far, including any you've already made. Recompute against {newVersion}?" + "Yes, recompute and clear dispositions" / "Cancel" | New — this is an in-place expansion inside the banner, never a `<dialog>`/overlay, matching this app's "no modal, ever" discipline for anything that discards a lawyer's work |
| Recompute submit failure | "Recompute failed — {typed error detail}. Your dispositions have not been changed." | New |

**Primary CTA for this phase's net-new surfaces:** none new — the review screen's existing primary
CTA ("Sign off and release to HR") is unchanged and remains gated on `PENDING === 0`; `/legal/queue`
is a read-only worklist with no primary action of its own, exactly like `/hr/matters`.

**Destructive actions in this phase's scope:** the recompute-and-clear-dispositions action is the
one genuinely destructive action this phase adds (it discards every recorded disposition). It is
confirmed via the in-place banner expansion above — never a modal, never a single-click action.
The Strike action itself is unchanged (already built, already confirmed via its mandatory reason
field, not re-specified here).

---

## UI Considerations

Applicable state considerations resolved for this phase's new/changed surfaces: 12 covered, 4
backstop, 0 unresolved. (Considerations for the review card/disposition controls/sign-off panel
already resolved in `03.1-UI-SPEC.md` are not re-litigated here.)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | `/legal/queue` | ✅ covered | Renders the existing empty-state string; no dead-end (same "create a claim" cross-link pattern as `/hr/matters`) |
| zero-one-many | `/legal/queue` sort control | ✅ covered | Exactly one of the two sort options is ever active (`aria-current="true"`); no third state |
| long-text | `/legal/queue` row reference | ✅ covered | Wraps, never truncates — same rule as `/hr/matters`'s row and `StatusStrip`'s cells |
| populated | Realistic mixed review (some ALLOW/DISALLOW/ALLOW_CAPPED, many FLAG) | ✅ covered | This is the **normal** case per the product-owner PACK-09 deferral decision, not an edge case — every visual treatment in this document (badge colours, unverified marker, FLAG reasons list, keyboard no-op note) is designed against a review with more FLAG lines than resolved ones, not the six-line reference fixture's more balanced mix |
| partial | Keyboard action key pressed on a line that doesn't offer it (e.g. `r` on a FLAG line) | ✅ covered | Silent no-op, documented once via the overlay's no-op note (Copywriting Contract) — never an error toast, never a console-only failure a keyboard user can't perceive |
| loading | Flat-fee choice submit | ✅ covered | Both radios render disabled for the duration of the request — same pattern as every other disposition control in this screen |
| error | Flat-fee choice submit failure | ✅ covered | Inline error beneath the fieldset, selection reverts to the previously persisted choice (or to "none chosen" if this was the first attempt) — never a silent failure that looks like success |
| error | Recompute submit failure | ✅ covered | Inline error inside the banner; the banner stays expanded, dispositions remain exactly as they were (recompute is all-or-nothing) |
| zero-one-many | `FlatFeeChoice` rendering | ✅ covered | Renders only when `assessment.totals.flatFeeComparison` is non-null (today: HK only) — zero UI for SG-jurisdiction assessments, not a disabled/greyed placeholder, since "no flat fee exists for this pack" is a different fact than "a flat fee exists but is blocked" |
| long-text | Flat-fee blocked note / stop-list rejection text | ✅ covered | Both wrap like every other hint/error paragraph in this app — never truncated |
| overflow | Shortcut help overlay on narrow viewport | 🧪 backstop | Overlay content scrolls internally rather than overflowing the viewport; verify with a UI-state test at a narrow viewport height with all bindings listed |
| overflow | `/legal/queue` with many rows | ✅ covered (dismissed as N/A) | Ordinary page scroll, no virtualization — consistent with this prototype's scale and with `/hr/matters`'s/`/assessments`'s existing unbounded lists |
| loading | `/legal/queue` | ✅ covered (dismissed as N/A) | Server component, data resolved before render — no client loading state exists or is needed, same as `/hr/matters` |
| error | Queue has no pack-derivable sort key for a matter (defensive case — a matter with no resolvable advisory deadline) | 🧪 backstop | Falls back to the "Oldest first" ordering for that row rather than throwing or sorting it to an undefined position — verify with a test stubbing a matter whose advisory-deadline computation returns null |
| overflow | Recompute banner's expand-to-confirm on narrow viewport | 🧪 backstop | The two buttons ("Yes, recompute…" / "Cancel") stack vertically rather than overlapping or clipping below a defined breakpoint — verify with a UI-state test |
| partial | A pack whose flat fee is itself `NEEDS_VERIFICATION` (today's real HK state) | 🧪 backstop | The flat-fee option still renders selectable (not disabled) with the unverified marker beside it — being unverified is not the same fact as being blocked (`flatFeeExceedsItemisedCost`), and the two must never collapse into one visual state; verify with a test asserting both states can coexist and render distinctly |

**Explicitly dismissed (reason given, not silently dropped):** dark mode — still no success
criterion asks for it. The `AI-drafted wording` badge — Phase 8's `packages/agent` does not exist
yet; nothing on this screen is LLM-generated this phase, so no badge is rendered (unchanged from
`03.1-UI-SPEC.md`'s own dismissal). A visually distinct "second pack version" recompute demo (the
actual differing figures before/after) — 06-RESEARCH.md Pitfall 5 flags this as a data-availability
question (whether a second real pack version file exists to recompute against), not a UI design
gap; the banner/confirm/failure states specified above render identically whether the underlying
recompute changes any figure or not.

---

## Registry Safety

Not applicable — `Tool: none` (no shadcn, no component registry of any kind is used this phase).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending

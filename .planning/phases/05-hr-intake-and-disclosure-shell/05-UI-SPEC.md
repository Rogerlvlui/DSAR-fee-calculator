---
phase: "05"
slug: "hr-intake-and-disclosure-shell"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-19"
---

# Phase 5 — UI Design Contract

> Scope note, read this before the rest of the document: 05-RESEARCH.md establishes that most of
> the HR intake screen (`MatterDetailsFields`, `AttestationsPanel`, `ExpenseLineRepeater`,
> `ClaimFooter`) already shipped in Phase 3.1 and is **not** re-specified here — this contract
> covers only the five net-new/modified surfaces the research identified: (1) wiring
> `CapabilityStatement`+`StatusStrip` onto every `/hr/*` route and reconciling `StatusStrip`'s
> fields against AC-31, (2) the new `/hr/matters` list screen (NAV-02), (3) the autosave
> save-state indicator (INTAKE-09), (4) the personal-data pattern detector's warning UI
> (BOUND-04), and (5) the per-jurisdiction pack-status display once the loader is wired to all
> nine real stub packs (INTAKE-02/03). Every design token below (spacing, typography, color) is
> **inherited unchanged from `03.1-UI-SPEC.md` and `apps/web/app/globals.css`** — this phase adds
> no new token and changes no existing one; it is reproduced here in full so this document is a
> complete, standalone contract for the checker and executor, not a diff they must cross-reference.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — hand-authored React components in `apps/web`, styled with Tailwind v4 CSS-first tokens (`@theme`) already declared in `apps/web/app/globals.css` |
| Icon library | none — no icon is used anywhere in the existing UI; do not introduce one for the five new surfaces either (a save-state indicator and a warning banner are both text, matching every other state signal in this codebase) |
| Font | System stack only, no webfonts, no network fetch — unchanged from Phase 3.1 |

**Decision (Claude's discretion, per the auto-mode framing — not a legal question):** no shadcn.
`components.json` still does not exist; nothing in this phase's five surfaces (a layout wrapper, a
list page, a small indicator, a warning paragraph, an extended status-strip cell) needs a
component library, and introducing one now would create two visual systems inside one app for a
demo-stage prototype. `Component Inventory` and `Registry Safety` sections are omitted per the
template's own instruction for `Tool: none`.

---

## Spacing Scale

Unchanged from `03.1-UI-SPEC.md` / `apps/web/app/globals.css`. Every spacing value used by this
phase's five new surfaces must be one of these ten tokens — no new value, no non-4-multiple pixel
value:

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Icon-free inline gaps (save-state dot-to-text, badge-to-text) |
| xs | 8px | Compact element spacing |
| sm | 12px | Dense internal padding (form field to hint text) |
| md | 16px | Default element spacing, page-section gaps |
| lg | 20px | Card/panel internal padding |
| xl | 24px | Section padding |
| 2xl | 28px | Wide card padding |
| 3xl | 32px | Layout gaps between major panels |
| 4xl | 48px | Major section breaks |
| 5xl | 64px | Page-level top/bottom spacing |

**New-surface mapping:**
- `/hr/matters` list rows: `sm` (12px) vertical padding per row, `md` (16px) gap between the
  reference/status/deadline cluster and the row's clickable link — mirrors `/assessments`'s own
  `<li><a>` structure, just with an added third data point (the advisory deadline).
- Autosave indicator: `2xs` (4px) gap between its status dot and its label text; sits inline at the
  top of the intake form, `sm` (12px) below the page's `h1`.
- Pattern-detector warning: `xs` (8px) top margin under the field it warns on — same vertical
  rhythm as the existing `identityVerifiedNote` warning paragraph in `attestations-panel.tsx`.
- Jurisdiction pack-status inline readout: same `sm`/`md` rhythm already used inside
  `matter-details-fields.tsx`'s heads-up block.

---

## Typography

Unchanged from `03.1-UI-SPEC.md` / `apps/web/app/globals.css` — exactly two weights (400, 600),
four sizes:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 11px | 600 | 1.3 |
| Body | 14px | 400 | 1.5 |
| Heading | 16px | 600 | 1.3 |
| Display | 24px | 600 | 1.2 |

**New-surface mapping:**
- `/hr/matters` page title ("Your matters") uses **Display** (`--serif`, 24px/600), matching every
  other screen-level `h1.screen` in this codebase (see `AssessmentsListPage`'s `h1.screen`
  precedent — this phase's `h1` gets the identical class, no new title treatment invented).
- List row reference + status use **Body** (14px/400); the matter reference specifically renders
  in the `--mono` family at the same 14px/400, matching how `StatusStrip`'s `rulePackId`/`version`
  cell already renders (`font-mono` class) — a reference code is data, not prose.
- Advisory deadline text on the list row uses **Label** (11px/600, uppercase) for the word
  "Advisory" itself (see Color/Copywriting below — it must be visually distinct, in its own
  container, exactly as `MatterRail`'s existing advisory-deadline block already renders it) and
  **Body** (14px/400) for the date/day-count sentence around it.
- Autosave indicator label ("Saving…" / "Saved" / "Save failed") uses **Label** (11px/600,
  uppercase, same treatment as a badge) — it is a status signal, not running text, and should read
  at the same visual weight as the verdict badges elsewhere in the app.
- Pattern-detector warning text uses **Body** (14px/400) — identical treatment to the existing
  `IDENTITY_NOTE_WARNING` paragraph it sits alongside (`.hint.stern` class), not a new smaller
  "fine print" size.
- Pack-status-per-jurisdiction inline readout (in `MatterDetailsFields`) uses **Label** (11px/600,
  uppercase) for the status word itself (`DRAFT`/`STALE`/`NO_USABLE_PACK`) — matching how
  `StatusStrip`'s existing "Pack status" cell already renders its value — and **Body** for the
  explanatory sentence beneath it.
- `StatusStrip`'s two new cells (reviewed date, review-due state) use the existing cell structure
  verbatim: `dt` at **Label** size, `dd` at **Body** size — no new typographic role is introduced
  anywhere in this phase.

---

## Color

Unchanged from `03.1-UI-SPEC.md` / `apps/web/app/globals.css`:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` (`--surface`) | Card/panel backgrounds, form fields, list rows |
| Secondary (30%) | `#eef0f2` (`--ground`) page backdrop + `#f5f6f8` (`--surface-sunk`) recessed zones | Outer page background; sunk rows |
| Accent (10%) | `#7c2334` (`--seal`), hover/active `#5e1a27` (`--seal-ink`), wash `#f7ecee` (`--seal-wash`) | Reserved for exactly: primary CTA buttons, the focus-visible outline ring on every interactive element (including every new link/button this phase adds — the `/hr/matters` row links, the autosave retry affordance if one exists), the wordmark's accent mark |
| Destructive | `#a32020` (`--stop`), wash `#fbecec` (`--stop-wash`) | Reserved for exactly: the Strike action, required-field asterisks, validation error states, the litigation-flag box — **and, new this phase, the autosave "Save failed" state** (see below) |

**Verdict & status semantic colours** (a fourth category, distinct from accent/destructive — every
value below carries a **required text label**, never colour alone, WCAG 2.1 AA):

| Verdict/state | Colour | Wash | Required accompanying text (verbatim) |
|---|---|---|---|
| `FLAG` / `--warn` | `#8a5a06` | `#fbf1de` (edge `#e0b869`) | "Needs your decision" |
| `ALLOW` / `--ok` | `#1c6146` | `#e8f2ed` | "Supported by rule" |
| `DISALLOW` / `--deny` | `#565f6c` | `#eceef1` | "Not supported" |
| Pack status = DRAFT | `--warn` | `--warn-wash` | "DRAFT" + disclosure microcopy (unchanged, `PACK_STATUS_DISCLOSURE`) |

**New status uses this phase, all built from the existing four-colour system — no new hex value
anywhere:**

| New state | Colour | Wash | Required accompanying text (verbatim, never colour-only) |
|---|---|---|---|
| Autosave — saving | `--ink-3` `#6b7480` (neutral, not semantic) | none | "Saving…" |
| Autosave — saved | `--ok` `#1c6146` | none (text only, no wash — this is a small inline indicator, not a card) | "Saved {relative time, e.g. 'just now'}" |
| Autosave — failed | `--stop` `#a32020` | none | "Save failed — your entries are still on this page; try again or copy them out." |
| Pattern-detector warning | `--warn` `#8a5a06` | none (inline text, matching the existing `IDENTITY_NOTE_WARNING` treatment — no wash box, this is advisory not blocking) | The detector's `reason` string, prefixed "This looks like it might contain personal data — {reason}. Personal data does not belong in this field." |
| Jurisdiction pack status — usable, current | `--ok` `#1c6146` | none | "Active" (only ever shown if a real ACTIVE, non-stale pack resolves — SG today) |
| Jurisdiction pack status — usable, review due soon | `--warn` `#8a5a06` | `--warn-wash` | "Active — review due in {n} days" |
| Jurisdiction pack status — stale | `--stop` `#a32020` | `--stop-wash` | "Stale — past its review date. New matters in this jurisdiction cannot be submitted." |
| Jurisdiction pack status — draft/stub (7 of 9 jurisdictions) | `--warn` `#8a5a06` | `--warn-wash` | "Draft — not yet authored for this jurisdiction" |
| Jurisdiction pack status — no usable pack at all | `--deny` `#565f6c` | `--deny-wash` | "No usable rule pack — contact Legal" (PRD §10.2's literal phrase) |

**Why no new hex value:** every one of these six new states maps onto one of the four colours
already in `globals.css` (`--ok`/`--warn`/`--stop`/`--deny`), reusing the pattern the existing
verdict badges already establish (semantic colour + mandatory text, never colour alone). This
keeps the 60/30/10 split and the accent-reservation list exactly as declared in 03.1-UI-SPEC.md —
this phase reserves nothing new from the accent colour, and every destructive-red use remains
inside the existing reserved-for list plus the one addition (autosave failure) noted above.

**Mode:** light only, unchanged.

**Visual focal point per new/changed screen:**
- **Every `/hr/*` screen (via the new layout wiring):** the capability statement (when
  unacknowledged) or the status strip (once acknowledged) is the first thing rendered, above
  `children` — this is chrome, not a focal point competing with the page's own primary anchor
  (the intake form's expense-line repeater remains the intake page's focal point, unchanged from
  Phase 3.1).
- **`/hr/matters`:** the list itself — each row's matter reference is the primary scan target,
  with status as the immediate secondary signal beside it (mirrors `/assessments`'s existing
  layout exactly).
- **Jurisdiction selection (within `MatterDetailsFields`):** the pack-status readout must appear
  in the same visual beat as the jurisdiction `<select>` itself (directly beneath it, not lower on
  the page) — PRD §10.2's requirement that the status shows "the moment it is chosen" is a layout
  requirement, not just a data one.

---

## Copywriting Contract

All strings below are **new to this phase** or are **existing locked strings from
03.1-UI-SPEC.md reproduced for completeness** (marked accordingly). None may use any AC-32 banned
word ("compliant", "non-compliant", "legal", "illegal", "lawful", "unlawful", "approved", "safe").

| Element | Copy | Status |
|---------|------|--------|
| `/hr/matters` page title | "Your matters" | New |
| `/hr/matters` empty state | "No matters yet. Create a fee claim to get started." | New — mirrors `/assessments`'s existing empty-state pattern ("No claims are waiting on Legal right now...") |
| `/hr/matters` row status labels | "Draft" (`DRAFT`) · "Sent to Legal" (`COMPUTING`, `LEGAL_REVIEW`, `INFO_REQUEST` — HR has no visibility into which of these three the matter is in, per AC-02/AC-04's leak-channel boundary; collapsing them to one label is the correct behaviour, not a gap) · "Assessed" (`SIGNED_OFF`, `CLOSED`) | New |
| `/hr/matters` advisory deadline per row | "Fee notification due {date} — {n} days. **Advisory only.**" (same construction as `MatterRail`'s existing `ADVISORY_QUALIFIER`, reused verbatim, not re-worded) | New wiring of an existing string |
| Autosave — idle/saving | "Saving…" | New |
| Autosave — saved | "Saved {relative time}" (e.g. "Saved just now", "Saved 2 minutes ago") | New |
| Autosave — failed | "Save failed — your entries are still on this page; try again or copy them out." | New |
| Personal-data pattern warning (generic wrapper, `reason` substituted from `detectLikelyPersonalData`) | "This looks like it might contain personal data — {reason}. Personal data does not belong in this field." | New |
| Jurisdiction pack status — Active | "Active" | New |
| Jurisdiction pack status — Active, review due soon | "Active — review due in {n} days" | New |
| Jurisdiction pack status — Stale | "Stale — past its review date. New matters in this jurisdiction cannot be submitted." | New (matches PRD §9.3's "new matters ... cannot be submitted" framing) |
| Jurisdiction pack status — Draft/stub | "Draft — not yet authored for this jurisdiction" | New |
| Jurisdiction pack status — no usable pack | "No usable rule pack — contact Legal" | New — PRD §10.2 verbatim phrase |
| Heads-up notice (unchanged, reused for every jurisdiction whose posture is `NO_EXPRESS_AUTHORITY`/`PROHIBITED`, now driven by the real per-jurisdiction posture rather than a hardcoded fallback) | "Heads up — {Jurisdiction}. Our rule pack records no clear legal basis for charging a fee for a data access request in this jurisdiction. You can still record the costs, but the likely outcome is that Legal advises charging nothing. Talk to Legal before spending time on this." | Existing — `headsUpMessage()`, unchanged text, now correctly sourced per-jurisdiction |
| Capability statement (Layer 1) | Unchanged — all six bullets, kicker, heading, lede, type-to-confirm label, why-layered paragraph, verbatim from `capability-statement.tsx` | Existing — reproduced by wiring, not re-authored |
| Status strip disclosure microcopy | "Real status. The engine computes against an in-memory copy coerced to Active for this demo only." (`PACK_STATUS_DISCLOSURE`) | Existing — unchanged, still load-bearing |
| Status strip — new "Reviewed" cell | Label "Reviewed", value: the pack's `reviewedOn` date, or "Not yet reviewed" if null | New cell, AC-31 |
| Status strip — new "Review due" cell | Label "Review due", value: "{date} — current" / "{date} — due in {n} days" / "{date} — stale" per the three-state colour above | New cell, AC-31 |
| Free-text limit warning (reconciled, all four fields) | Existing per-field pattern: a counter or hint reading "{n} / {limit} characters" once the field is populated, drawn from `FREE_TEXT_LIMITS` — no new copy invented, this phase's job is sourcing the number from the constant everywhere (fixing the `expense-line-repeater.tsx:363` hardcoded-300 defect) rather than a literal | Existing pattern, reconciled |

**Primary CTA for this phase's net-new surfaces:** none — `/hr/matters` is a read-only worklist
(its "primary action" is the existing "Create a fee claim" link already on the landing page /
implicitly reachable via `/matters/new`; do not add a duplicate "New matter" button unless a plan
decides `/hr/matters` should also host that entry point, in which case reuse the existing
`Submit to Legal`-style primary-button treatment, not a new one).

**Destructive actions in this phase's scope:** none new. The pattern-detector is explicitly
warn-never-block (BOUND-04) — it has no confirmation step of any kind, and must never gain one.

---

## UI Considerations

Applicable state considerations resolved for this phase's five new/modified surfaces: 9 covered, 2
backstop, 0 unresolved. (Considerations for the *existing* intake form fields — already resolved
in `03.1-UI-SPEC.md` — are not re-litigated here; see that document.)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | `/hr/matters` list | ✅ covered | Renders "No matters yet. Create a fee claim to get started." at zero rows — same shape as `/assessments`'s own empty state, no dead-end (a link back to `/matters/new` sits directly beneath it) |
| zero-one-many | `/hr/matters` list | ✅ covered | No special singular/plural copy needed (the list has no "{n} matters" count header, per `/assessments`'s own precedent — an `<h1>` plus rows, no locknote) |
| long-text | `/hr/matters` row (matter reference) | ✅ covered | Reference wraps, never truncates — same rule as `StatusStrip`'s cells and `MatterRail`'s reference cell |
| loading | `/hr/matters` list | ✅ covered (dismissed as N/A) | Server component, data resolved before render — no client loading state exists or is needed |
| error | Autosave write failure | ✅ covered | Non-blocking inline state change only (indicator flips to "Save failed…", copy above) — never a toast, never a modal, never data loss; the form's own state is unaffected, only the `localStorage` write failed |
| loading | Autosave in-flight | ✅ covered | "Saving…" state shown for the duration of the (synchronous, `localStorage`) write — even though this is fast enough to be nearly instantaneous, the state must still exist and be testable, since the 10s-interval design implies a visible cadence, not just a final "Saved" |
| overflow | Autosave indicator on narrow viewport | 🧪 backstop | Must not wrap awkwardly mid-word or overlap the page title; verify with a UI-state test at a narrow viewport width, matching the `flex-wrap` precedent `StatusStrip` already uses |
| partial | Pattern-detector warning shown mid-typing | ✅ covered | Fires on blur/change per 05-RESEARCH.md Pattern 4 (not only on submit) — the warning must appear and disappear live as the field's content changes past/below the pattern threshold, never "stick" after the offending text is removed |
| long-text | Pattern-detector warning text itself | ✅ covered | Wraps like every other hint/warning paragraph in the intake form (`identityVerifiedNote`'s existing warning is the precedent) — never truncated |
| zero-one-many | Jurisdiction pack-status readout across nine jurisdictions | ✅ covered | Exactly one of the five states (Active / Active-review-due-soon / Stale / Draft-stub / No-usable-pack) renders per jurisdiction, driven by the real per-jurisdiction resolution (INTAKE-02) — not a single hardcoded fallback string for eight of nine jurisdictions as today |
| error | Jurisdiction has no pack file resolvable at all (defensive case, e.g. a future jurisdiction removed from the repo) | 🧪 backstop | Falls back to the "No usable rule pack — contact Legal" state (`--deny` treatment) rather than throwing or rendering blank — verify with a test that stubs a jurisdiction with no loadable pack |

**Explicitly dismissed (reason given, not silently dropped):** dark mode — no success criterion in
this phase asks for it, token names already carried forward per 03.1-UI-SPEC.md. Keyboard
shortcuts (`j`/`k`/`a`/`r`/`s`/`?`, PRD §10.1) — that is Phase 6's legal-review screen, not this
phase's HR-side surfaces. Server-side mirroring of the pattern detector — 05-RESEARCH.md Open
Question 2 scopes this phase to client-only; no UI state is needed for a server-side echo that
does not exist yet.

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

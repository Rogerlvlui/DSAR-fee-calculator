---
phase: "07"
slug: "sign-off-outputs-and-edge-states"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-20"
---

# Phase 7 — UI Design Contract

> Scope note, read before the rest of this document. Direct reads of `apps/web/src/ui/review/signoff-panel.tsx`,
> `apps/web/src/ui/hr/result-view.tsx`, `apps/web/src/ui/hr/notice-block.tsx`, `apps/web/src/domain/notice-draft.ts`
> and `apps/web/app/hr/matters/[id]/page.tsx` confirm the sign-off confirmation panel, the HR result headline +
> itemisation, the copy-to-clipboard notice block (DRAFT watermark, boundary note, "Mark notice sent"), and the
> notice-generation mechanism (including its zero-fee itemisation and its UNAUTHORED-template fallback) were **already
> built in Phase 3.1/4** and carry forward unchanged. REQUIREMENTS.md still marks SIGNOFF-05/06 and DOC-02/03/04
> Pending only because Phase 3.1's own scope note says a demo does not discharge a requirement its home phase still
> owns — the mechanism exists, but this phase's job is proving it against real preconditions (ACCESS-04, PACK-08,
> SIGNOFF-01/02) and real pack content, not rebuilding the screens. **This contract therefore covers only the
> genuinely net-new or missing surfaces**: (1) the internal fee-assessment-record PDF (DOC-01/DOC-05 — no PDF
> generation exists anywhere in the repo today), (2) the full-width "rule pack past review date" notice on the legal
> review screen (AC-39's in-flight-review half — `packIsStale` is already computed for the attestation text but never
> rendered as a banner), (3) the PACK-08/AC-41b activation-then-signoff block (an entirely new guard with an entirely
> new blocking-reason message), and (4) SIGNOFF-01/AC-16's named-pending-lines refusal text (today's `signOff()`
> throws a generic message with no line list). Every design token below is **inherited unchanged from
> `03.1-UI-SPEC.md` / `05-UI-SPEC.md` / `06-UI-SPEC.md` / `apps/web/app/globals.css`** for every screen surface; this
> phase adds no new screen-side spacing, typography or colour token, only new PDF-specific tokens (a separate visual
> system, justified below) and two new copy/state additions inside the existing sign-off panel. Reproduced here in
> full so this document is a complete, standalone contract.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (screens) / `@react-pdf/renderer` (internal record only) |
| Preset | not applicable |
| Component library | none — hand-authored React components in `apps/web`, styled with Tailwind v4 CSS-first tokens (`@theme`) already declared in `apps/web/app/globals.css`. The PDF is authored with `@react-pdf/renderer`'s own primitives (`<Document>`, `<Page>`, `<View>`, `<Text>`) — the stack decision `.claude/CLAUDE.md` Q5 already locked; this phase is the first to use it |
| Icon library | none anywhere in this phase's surfaces — the PDF carries zero icons/images (a plain data document); the screen additions (STALE banner, PACK-08 block) are text-only, matching this app's existing zero-icon discipline |
| Font | Screens: system stack only, unchanged. PDF: `Helvetica` — `@react-pdf/renderer`'s built-in standard PDF font, requiring no `Font.register()` call and no embedded font file. Chosen specifically to extend this project's "no webfonts, no network fetch, no vendored binary asset" discipline (03.1-UI-SPEC.md's own font decision) into the one new surface that could otherwise quietly break it |

**Decision (Claude's discretion, per D-04's own delegated PDF-layout gray area): no shadcn, no PDF component
library beyond `@react-pdf/renderer`'s own primitives.** A dense data table over `<View>`/`<Text>` is a well-scoped,
small pattern (§14's own precedent: react-pdf's community table plugin is optional, not required, and D-04 already
settles "dense table, not a card mirror" — a hand-built grid of fixed-width `<View>` columns is the simplest thing
that satisfies that). `Component Inventory` and `Registry Safety` sections are omitted per the template's own
instruction for `Tool: none`.

---

## Spacing Scale

**Screens — unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md` / `06-UI-SPEC.md` / `apps/web/app/globals.css`.**
Every spacing value used by this phase's new/changed screen surfaces must be one of these ten tokens:

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Icon-free inline gaps |
| xs | 8px | Compact element spacing |
| sm | 12px | Dense internal padding |
| md | 16px | Default element spacing, page-section gaps |
| lg | 20px | Card/panel internal padding |
| xl | 24px | Section padding |
| 2xl | 28px | Wide card padding |
| 3xl | 32px | Layout gaps between major panels |
| 4xl | 48px | Major section breaks |
| 5xl | 64px | Page-level top/bottom spacing |

**New-surface mapping (screens):**
- **Stale-pack review notice** (new, AC-39): `lg` (20px) internal padding, `md` (16px) bottom margin above the
  review-card column — same rhythm as `06-UI-SPEC.md`'s recompute banner, since both are full-width, non-dismissible
  notices sitting above the same centre column.
- **PACK-08 sign-off block** (new, AC-41b): no new spacing token — renders inside the sign-off panel's existing
  blocking-reason slot (`data-testid="signoff-blocking-reason"`), same container, same padding as the existing
  acknowledgement-required reason text.
- **SIGNOFF-01 pending-lines refusal text** (new, AC-16): no new spacing — renders inside the sign-off panel's
  existing error slot (`data-testid="signoff-error"`), same container as every other sign-off failure message.

**PDF — a parallel, point-based scale, not a reuse of the px tokens above (paper vs. screen).** Every margin/padding
value in the PDF must be one of these six values, chosen to keep the same nearest-multiple-of-4 discipline the
screen scale already enforces, dropping the three largest screen-only tokens (`2xl`/`4xl`/`5xl`) that a dense report
never needs:

| Token | Value | Usage |
|-------|-------|-------|
| pdf-2xs | 4pt | Cell-internal gap (label to value within one table cell) |
| pdf-xs | 8pt | Table cell horizontal padding, gap between adjacent sign-off fields |
| pdf-sm | 12pt | Gap between a section heading and its content |
| pdf-md | 16pt | Gap between major sections (Matter details → Rule pack → Line items → Flags → Sign-off) |
| pdf-lg | 24pt | Page margins (top/bottom/left/right) |
| pdf-xl | 32pt | Reserved footer band height (keeps every page's footer at a fixed vertical position regardless of how the table breaks) |

---

## Typography

**Screens — unchanged, exactly two weights (400, 600), four sizes:**

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 11px | 600 | 1.3 |
| Body | 14px | 400 | 1.5 |
| Heading | 16px | 600 | 1.3 |
| Display | 24px | 600 | 1.2 |

**New-surface mapping (screens):**
- Stale-pack review notice heading ("Rule pack past review date") uses **Heading** (16px/600) — same role as the
  existing `06-UI-SPEC.md` recompute-banner heading, since both are single-line banner headings above body text.
- Stale-pack review notice body uses **Body** (14px/400).
- PACK-08 block text and SIGNOFF-01 pending-lines text both use **Body** (14px/400) — identical treatment to the
  existing `SIGN_OFF_BLOCKING_REASON` text and the existing `signoff-error` text they sit beside/replace; no new
  text role is introduced for either.

**PDF — its own scale, in points, since the PDF is a print document rather than a rendering of this app's own CSS
type tokens.** Exactly two weights here too (`normal`, `bold` — Helvetica ships both without embedding), five sizes:

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| PDF Title | 14pt | bold | Document title ("Internal fee assessment record — {matterReference}") |
| PDF Section heading | 10pt | bold | "Matter details" / "Rule pack" / "Line items" / "Matter flags and acknowledgements" / "Sign-off" |
| PDF Table header | 8pt | bold | Column headings, uppercase, matching the screen's Label role's "categorical signal" intent |
| PDF Body | 8pt | normal | Table cell content, matter-detail key/value pairs |
| PDF Attestation | 9pt | normal | The verbatim §9.5 attestation paragraph in the sign-off block — one point larger than table body, since this is the one paragraph of running prose in an otherwise tabular document and needs to read as quoted text, not a data cell |
| PDF Footer | 7pt | normal | DOC-05's verbatim footer template, on every page |

---

## Color

**Screens — unchanged from `03.1-UI-SPEC.md` / `05-UI-SPEC.md` / `06-UI-SPEC.md`:**

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` (`--surface`) | Card/panel backgrounds, form fields, list rows |
| Secondary (30%) | `#eef0f2` (`--ground`) + `#f5f6f8` (`--surface-sunk`) | Outer page background; sunk rows |
| Accent (10%) | `#7c2334` (`--seal`), hover/active `#5e1a27` (`--seal-ink`), wash `#f7ecee` (`--seal-wash`) | Reserved for exactly: primary CTA buttons (unchanged — "Sign off and release to HR" remains the only primary CTA this phase's scope touches), the focus-visible outline ring on every interactive element, the wordmark's accent mark |
| Destructive | `#a32020` (`--stop`), wash `#fbecec` (`--stop-wash`) | Reserved for exactly: the Strike action (unchanged, not re-specified), required-field asterisks, the reason-field validation error state — **extended this phase, not newly reserved**, to the PACK-08 sign-off block text (a hard, non-self-resolvable block naming another reviewer, the same severity class as an unrecoverable validation failure) and to the new stale-pack review notice's border/heading treatment (see below) |

**New this phase, both built from the existing four-colour system — no new hex value on any screen:**

| New state | Colour | Wash | Required accompanying text (never colour-only) |
|---|---|---|---|
| Stale-pack review notice (AC-39, full-width, non-dismissible) | `--stop` `#a32020` text/border | `--stop-wash` `#fbecec` fill | "Rule pack past review date" heading plus the body sentence (Copywriting Contract) — this is deliberately the **red** treatment, distinct from `06-UI-SPEC.md`'s amber recompute banner and from `PackRail`'s existing amber "Pack status" cell, because PRD §9.3/§10.7 name this specific state "a full-width red notice," not a warning |
| PACK-08 sign-off block (AC-41b) | `--stop` `#a32020` text | none (inline text in the existing blocking-reason slot, not a boxed callout — matches how `SIGN_OFF_BLOCKING_REASON` already renders as plain inline text, not a card) | see Copywriting Contract — the block names the reason and points to another reviewer, per AC-41b's own literal requirement |
| SIGNOFF-01 pending-lines refusal (AC-16) | unchanged — reuses the existing `signoff-error` slot's treatment (plain text, `role="alert"`, no colour styling beyond default text colour — the existing slot carries no colour token of its own today) | — | see Copywriting Contract |

**Why no new hex value on screen:** both new states map onto `--stop`/`--stop-wash`, already reserved for
destructive/hard-block treatments; this phase widens that reservation's *scope* (two more elements) rather than
adding a fifth colour role.

**Mode:** light only, unchanged.

**PDF — a deliberately separate, greyscale-only palette. Not a reuse of `--seal`/`--ok`/`--warn`/`--stop`.**

| Role | Value | Usage |
|------|-------|-------|
| PDF text | `#171b22` (reused literal hex of `--ink`) | All title/heading/body/attestation text |
| PDF muted text | `#6b7480` (reused literal hex of `--ink-3`) | Footer text, column sub-labels |
| PDF rule/border | `#d8dce1` (reused literal hex of `--line`) | Table cell borders, section dividers |
| PDF zebra row | `#f5f6f8` (reused literal hex of `--surface-sunk`) | Alternating table row background, for legibility across a 50-line table |

**Why greyscale-only, and why this is a deliberate design decision, not an oversight:** DOC-01/AC-32b's verdict/
disposition columns already carry their state in words (a Verdict column cell literally reads "FLAG" / "ALLOW" /
etc., a Disposition column cell literally reads "Accepted" / "Struck" / etc.) — the screen's four-colour verdict
system exists to give a *scanning* signal color adds on top of that text, which matters on an interactive review
screen a lawyer works through line by line, and does not matter on an archival PDF a DPO or auditor reads
top-to-bottom, where colour printing/screen-rendering fidelity cannot be assumed. Introducing `--seal`/`--ok`/
`--warn`/`--stop` into the PDF would also risk being read as this tool "colour-coding a legal conclusion" onto a
document whose entire purpose (per CLAUDE.md's core value) is to attribute every figure to a named rule and a named
lawyer, not to a visual verdict. Greyscale keeps the PDF legible on any printer and keeps its visual register
distinct from — and subordinate to — the words on the page.

**Visual focal point per new/changed surface:**
- **Legal review screen (unchanged overall focal point, reaffirmed):** the totals rail remains the single place a
  running number appears; the stale-pack notice, when it renders, sits above the review-card column as the first
  thing a lawyer reads, mirroring `06-UI-SPEC.md`'s recompute banner placement — a second, non-competing anchor that
  exists only when its trigger condition is true.
- **Internal record PDF:** the line-items table is the focal point of the document (it is the majority of its page
  count and the majority of its evidentiary content); the sign-off block is the terminal anchor, always the last
  section before the footer, so a reader's eye lands on the accountable name last, closing the document the same
  way the on-screen sign-off panel closes the review.

---

## Copywriting Contract

All strings below are **new to this phase**, unless marked "Existing — reused verbatim." None may use any AC-32
banned word ("compliant", "non-compliant", "legal", "illegal", "lawful", "unlawful", "approved", "safe"). Every new
message follows `packages/engine/src/messages.ts`'s established convention: name the specific value/reason, never a
bare "invalid" or "blocked" with no detail.

| Element | Copy | Status |
|---------|------|--------|
| Stale-pack review notice heading | "Rule pack past review date" | New — PRD §9.3/§10.7 construction |
| Stale-pack review notice body | "{packId} {version} was due for review on {reviewDueOn}. You may still review and sign off this assessment. Your sign-off attestation below will include an extra line confirming you have checked the current position yourself." | New — foreshadows, does not duplicate, the §9.5 STALE-extension wording the attestation itself already carries verbatim (unchanged, existing) |
| PACK-08 sign-off block (AC-41b) | "Blocked — you activated rule pack {packId} {version} in this session. Sign-off by the same person who activated the pack is not permitted; ask another reviewer with the Legal Reviewer role to sign off this assessment instead." | New — names the pack version (the reason) and points to another reviewer (the resolution), per AC-41b's own literal requirement |
| SIGNOFF-01 pending-lines refusal (AC-16) | "Sign-off refused — {n} line(s) still need a decision: {list of line sequence numbers, e.g. 'lines 3, 7, 12'}." Rendered through the existing `signoff-error` slot, wrapped by the existing `Sign-off failed — {detail}. No changes were made; the assessment is still in Legal Review.` prefix/suffix (unchanged) | New detail text inside an existing, unchanged wrapper |
| Internal record PDF — title | "Internal fee assessment record — {matterReference}" | New |
| Internal record PDF — section headings | "Matter details" · "Rule pack" · "Line items" · "Matter flags and acknowledgements" · "Sign-off" | New |
| Internal record PDF — line-item table columns | "Seq" · "Category" · "Verdict" · "Rule ID" · "Basis" · "Citation" · "Disposition" · "Claimed" · "Lawyer amount" · "Lawyer's reason" | New — DOC-01's own field list, transcribed as column headers |
| Internal record PDF — flags section, zero flags | "No matter-level flags were raised on this matter." | New — never renders an empty heading with nothing beneath it |
| Internal record PDF — flags section, no acknowledgement-required flags | "No matter-level flags on this assessment required acknowledgement." | New — distinct from the zero-flags case above; a matter can carry informational flags (e.g. pack disclosure notes) that never require this line |
| Internal record PDF — a line with no lawyer's reason recorded (only possible for a plain `ACCEPTED` non-`FLAG` line, where PRD §10.3/AC-23 does not mandate one) | "—" (em dash, in the Lawyer's reason cell) | New — never a blank cell that could be misread as a missing/dropped value |
| Internal record PDF — footer, every page, verbatim | "Prepared with the DSAR Fee Assessment tool. Rule pack {packId} {version}. Figures computed by rule engine {engineVersion}; paragraphs marked *AI-drafted* were generated by a language model from those figures. Reviewed and signed off by {lawyer name}, {qualification}, on {date}. Not legal advice to any third party." | Existing — PRD §10.5(a), transcribed verbatim, unchanged |
| "Download internal record (PDF)" trigger — label | "Download internal record (PDF)" | New — a real, focusable button/link, never a bare filename link with no label |
| "Download internal record (PDF)" trigger — placement | Renders on `/legal/assessments/{id}` once `matter.status` is `SIGNED_OFF` or `CLOSED`, replacing the sign-off panel in the same right-rail slot — **never on any `/hr/*` route**, since the record carries `lawyerReason` and the internal rationale, which ACCESS-05 forbids reaching an HR user through any channel including a document | New placement rule |
| "Download internal record (PDF)" — generation failure | "Could not generate the internal record — {typed error detail}. Try again; nothing was saved or sent." | New — matches this app's existing inline-error, no-silent-failure convention (`signoff-panel.tsx`'s own failure copy is the direct precedent) |
| "Download internal record (PDF)" — loading state | Button disabled with its own label unchanged, no spinner — same "disabled for the duration of the request" pattern every other submit control in this app already uses (`signoff-submit`, `notice-mark-sent`) | New, following existing pattern |

**Primary CTA for this phase:** unchanged — "Sign off and release to HR" remains the review screen's terminal
primary action, gated on `PENDING === 0` (existing) and now also gated on the PACK-08 guard (new precondition, same
button, no new button). "Download internal record (PDF)" is a **secondary** action that only ever appears after
sign-off, when the primary CTA has already fired and disappeared.

**Empty state:** the internal record PDF's two "no flags" rows above are this phase's only genuinely new empty
states; every other empty/loading/error state this phase touches (notice block, result view, sign-off panel) is
inherited unchanged from Phase 3.1/4/5.

**Destructive actions in this phase's scope:** none new. Sign-off itself is the terminal, high-stakes action this
phase gates further (PACK-08, SIGNOFF-01/02) but its own confirmation mechanism — the attestation text plus the
acknowledgement checkboxes — is unchanged, already built, and not re-specified here. "Mark notice sent" remains
non-destructive (records a date only, reversible by nothing but also undoes nothing).

---

## UI Considerations

Applicable state considerations resolved for this phase's new/changed surfaces: 10 covered, 4 backstop, 0
unresolved. (Considerations for the sign-off panel's acknowledgement flow, the notice block, and the result view
were already resolved in `03.1-UI-SPEC.md` and are not re-litigated here.)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | Stale-pack review notice | ✅ covered | Renders only when `deriveEffectiveStatus(pack, now) === "STALE"` — never a "not stale" placeholder, never rendered alongside the unrelated 30-day amber warning at the same time as a second, redundant notice (the amber warning is the pre-STALE state; STALE supersedes it) |
| zero-one-many | PACK-08 sign-off block | ✅ covered | Renders only when the current actor is the pack version's recorded last activator — the common case (a different lawyer signs off) shows the ordinary, unchanged sign-off panel with no trace of this block |
| error | PACK-08 block vs. the existing "acknowledge every flag" blocking reason, both true at once | ✅ covered | The PACK-08 block is a structural, non-self-resolvable refusal (no checkbox can fix it) and takes precedence in the same slot — the acknowledgement checkboxes still render and remain checkable, but the CTA stays disabled with the PACK-08 message shown, never both messages stacked ambiguously |
| error | SIGNOFF-01 pending-lines refusal reached in practice | 🧪 backstop | Since the panel only renders client-side once `pendingCount === 0`, this is a race-condition path (a second tab/session dispositions a line between page load and submit) — verify with a test that submits sign-off against a server-side assessment holding a PENDING line despite a stale client view |
| long-text | Internal record PDF — Basis / Citation / Lawyer's reason cells | ✅ covered | Wrap within their column, never truncate or ellipsis — same rule PRD §10.3 already applies to the on-screen review card, carried into the PDF for the same evidentiary reason |
| overflow | Internal record PDF — 50-line assessment | 🧪 backstop | Multi-page pagination with the table header row and page footer repeating on every page; verify with a UI-state test asserting the header/footer text is present and correct on page 2+, not only page 1 |
| empty | Internal record PDF — matter flags section, zero flags at all | ✅ covered | Renders the "No matter-level flags were raised on this matter." line (Copywriting Contract), never a bare heading with nothing under it |
| partial | Internal record PDF — a line missing its lawyer's reason (only the non-`FLAG` `ACCEPTED` case, per AC-23) | ✅ covered | Renders "—" in that cell, never a blank that could be misread as data loss |
| populated | Internal record PDF — realistic mixed review (some ALLOW/DISALLOW/ALLOW_CAPPED, many FLAG, per `06-UI-SPEC.md`'s own "populated" ruling) | ✅ covered | The table's row density and column widths are sized against this normal case (more FLAG rows with a "Why this needs you" style basis than short ALLOW rows), not the six-line reference fixture alone |
| loading | "Download internal record (PDF)" | ✅ covered | Button disabled for the duration of generation — same pattern as `signoff-submit`/`notice-mark-sent` |
| error | "Download internal record (PDF)" generation failure | ✅ covered | Inline error beside the trigger, nothing downloaded, no partial/corrupt file offered — matches this app's existing inline-error-never-silent-failure convention |
| zero-one-many | Zero-allowable outcome (finalAmount = 0) appearing in the internal record PDF | ✅ covered (dismissed as N/A) | The line-item table and sign-off block render identically to any other outcome — a zero final amount is a normal value in the "Final fee" field, never a special empty/error rendering (same DISC-06 rule `03.1-UI-SPEC.md` already applies to the on-screen result) |
| overflow | PDF generated for a matter with zero matter-level flags AND zero lines requiring acknowledgement, on a single-page-fitting assessment | ✅ covered (dismissed as N/A) | Ordinary single-page render; no special-case layout needed since the "no flags" copy rows above already handle the content, and the page simply ends shorter |

**Explicitly dismissed (reason given, not silently dropped):** a landscape-vs-portrait toggle or a user-facing page-
size choice for the PDF — D-04 delegates the exact page geometry to this document's own discretion (landscape A4,
declared above); no success criterion asks for a user-facing choice. Colour in the PDF — deliberately rejected, see
Color section above, not an oversight. An "AI-drafted" badge inside the PDF — Phase 8's `packages/agent` does not
exist yet; nothing in this phase's data is LLM-generated, so DOC-01's own field list ("paragraphs marked
*AI-drafted*") has nothing to mark this phase and the footer's AI-drafted clause renders as boilerplate that
currently matches zero paragraphs — unchanged from every prior phase's identical dismissal.

---

## Registry Safety

Not applicable — `Tool: none` for screens, and `@react-pdf/renderer` is a rendering library, not a component
registry (no shadcn, no third-party block source of any kind is used this phase).

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

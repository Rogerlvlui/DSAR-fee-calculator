---
quick_id: "260930-w8p"
status: complete
---

# Summary: counsel-authored Singapore notice wording; "Mark notice sent" removed

**Done.**
1. SG-PDPA `requestorNoticeTemplate` now holds counsel's letter, word for word. The pack is
   still DRAFT. HK-PDPO and the stubs still read "Counsel has not yet authored…".
2. `buildNoticeDraft` fills `[amount]` (the assessed fee) and `[date]` (request-received
   date, new `formatIsoCalendarDate`, "1 Sep 2026", no time-zone shift). `[Name]` is never
   filled (NS-4). New required input `requestReceivedOn`; all callers updated.
3. `notice-block.tsx` has no button, fetch or client state any more; `NoticeBlockView` folded
   into `NoticeBlock`. The route, the transition, the watermark and the boundary note are unchanged.
4. PRD §10.4 records both decisions (counsel: SG final-fee framing; product owner: no
   mark-sent button). DEMO-WALKTHROUGH.md step 11 and the HR-result row updated.

**Verified:** `pnpm test` 1116/1116; `typecheck` and `depcruise` clean; `next build --webpack`
green. The rendered SG notice was checked end to end through the real routes: the letter,
the filled date and amount, and "Dear [Name]," left as is. AC-17 is still clean for both SG and HK.

**Found, not fixed:** `pnpm lint` crashes because the untracked `lq-residency-september-2026/`
clone sits inside the project and eslint loads another resident's config. With that folder
excluded, lint is clean. Fix: move the clone out of the project folder, or add it to eslint's ignores.

Commit: (recorded by the quick-task closing commit)

// apps/web/src/ui/hr/notice-block.tsx
//
// The requestor-facing notice draft (PRD §10.4/§10.5(b)) in a
// copy-to-clipboard block: the draft watermark renders as a full-width
// banner directly above the draft text, in the warn treatment, for as long
// as the notice is still a draft (noticeSentAt === null) — DOC-02's
// "watermarked DRAFT until HR marks it sent". It lives inside the same
// container as the draft text rather than being drawn as a decorative
// diagonal stamp, so it is part of the copied and selectable content, not
// something a selection would miss. The boundary note renders verbatim
// beneath it, in both states — the note that this tool emails nobody must
// not vanish exactly when a reader is most likely to assume otherwise.
//
// No "Mark notice sent" button (product-owner decision, 2026-09-30, PRD
// §10.4). The /api/matters/[id]/notice-sent route and its transition are
// unchanged, so a notice recorded as sent still shows its date here.

export const NOTICE_DRAFT_WATERMARK = "DRAFT — for HR to send";
export const NOTICE_BOUNDARY_NOTE = "Send this yourself from your own mailbox. This tool does not email anyone.";

// DOC-02/SIGNOFF-06 — markNoticeSent (apps/web/src/server/data/matters.ts)
// records a full ISO instant, kept as-is for the audit record; the
// preparer-facing confirmation reads a calendar date only (a timestamp
// would read like a transmission time for something this tool never
// transmitted). Pure string slicing — the characters before the "T"
// separator — no Date parsing, so it never re-interprets the instant in a
// different timezone than it was recorded in.
export function noticeSentDate(instant: string): string {
  const separatorIndex = instant.indexOf("T");
  return separatorIndex === -1 ? instant : instant.slice(0, separatorIndex);
}

export interface NoticeBlockProps {
  draft: string;
  noticeSentAt: string | null;
}

export function NoticeBlock({ draft, noticeSentAt }: NoticeBlockProps) {
  return (
    <div data-testid="notice-block" className="notice-document">
      {noticeSentAt === null ? (
        <div data-testid="notice-watermark" className="text-warn">
          {NOTICE_DRAFT_WATERMARK}
        </div>
      ) : null}
      <pre data-testid="notice-draft-text">{draft}</pre>
      <p data-testid="notice-boundary-note">{NOTICE_BOUNDARY_NOTE}</p>
      {noticeSentAt ? (
        <p data-testid="notice-sent-confirmation">Notice marked sent on {noticeSentDate(noticeSentAt)}.</p>
      ) : null}
    </div>
  );
}

// apps/web/src/ui/review/internal-record-download.tsx
//
// The visible half of 07-01/07-04's GET /api/assessments/{id}/internal-record
// endpoint. Split the same way recompute-confirm.tsx/signoff-panel.tsx are:
// a pure, props-driven *View component (what internal-record-download.test.tsx
// renders directly) and a stateful wrapper owning pending/error state and
// fetch — useRouter() is not needed here (this trigger never navigates), but
// fetch is still unavailable in a way that matters for a pure render, so the
// wrapper is never rendered directly in a test either, matching this
// directory's own convention.
//
// The button is a real, focusable, labelled control — never a bare filename
// link with no label (07-UI-SPEC.md's own Copywriting Contract entry). While
// the request is in flight the button is disabled and its label is
// unchanged — no spinner, matching signoff-submit/notice-mark-sent. On
// failure nothing is downloaded: no partial file, no corrupt file, no empty
// file is offered — the wrapper only ever triggers a save once the response
// is confirmed ok.

"use client";

import { useState } from "react";

export const INTERNAL_RECORD_DOWNLOAD_LABEL = "Download internal record (PDF)";

// 07-UI-SPEC.md's Copywriting Contract, verbatim.
export function internalRecordDownloadFailure(detail: string): string {
  return `Could not generate the internal record — ${detail}. Try again; nothing was saved or sent.`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

// Extracts the filename from the content-disposition header the
// internal-record route itself sends
// (`attachment; filename="${matter.reference}-internal-record.pdf"`,
// apps/web/app/api/assessments/[id]/internal-record/route.ts). Falls back
// to a generic name rather than throwing on a missing/malformed header —
// a filename fallback is never a reason to fail a download whose bytes
// already arrived successfully.
export function filenameFromContentDisposition(header: string | null): string {
  if (!header) return "internal-record.pdf";
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? "internal-record.pdf";
}

export interface InternalRecordDownloadViewProps {
  pending: boolean;
  error: string | null;
  onDownload: () => void;
}

/** Pure, props-driven — this is what internal-record-download.test.tsx
 * renders directly, never the stateful wrapper below. */
export function InternalRecordDownloadView({ pending, error, onDownload }: InternalRecordDownloadViewProps) {
  return (
    <div data-testid="internal-record-download">
      <button
        type="button"
        data-testid="internal-record-download-button"
        disabled={pending}
        onClick={onDownload}
      >
        {INTERNAL_RECORD_DOWNLOAD_LABEL}
      </button>
      {error ? (
        <p role="alert" data-testid="internal-record-download-error">
          {internalRecordDownloadFailure(error)}
        </p>
      ) : null}
    </div>
  );
}

export interface InternalRecordDownloadProps {
  assessmentId: string;
}

export function InternalRecordDownload({ assessmentId }: InternalRecordDownloadProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/internal-record`);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const blob = await response.blob();
      const filename = filenameFromContentDisposition(response.headers.get("content-disposition"));
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      // On failure nothing is downloaded — the blob/object-URL/anchor
      // sequence above is only ever reached after `response.ok`, so a
      // thrown error here guarantees no partial or corrupt file was ever
      // offered to the browser.
      setError(downloadError instanceof Error ? downloadError.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return <InternalRecordDownloadView pending={pending} error={error} onDownload={handleDownload} />;
}

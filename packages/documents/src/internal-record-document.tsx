// packages/documents/src/internal-record-document.tsx
//
// The ONLY module in this repository importing @react-pdf/renderer — every
// other consumer (the Route Handler, this package's own tests for content)
// goes through internal-record-view.ts's plain InternalRecordView object,
// never through this JSX tree directly. This is also why
// packages/documents/package.json's exports map carries two explicit
// subpath keys ("./internal-record-view", "./internal-record-document")
// rather than a single "./*" wildcard like every other package in this
// monorepo (e.g. packages/workflow/package.json) — a package with both a
// .ts and a .tsx source file cannot resolve both through one wildcard
// entry, so each source file gets its own named export instead.
//
// Landscape A4, 24pt page margins, Helvetica (the renderer's built-in
// standard PDF font — no Font.register() call, no embedded font file, no
// network fetch), per 07-UI-SPEC.md's Typography/Spacing scale and D-04's
// delegated PDF-layout discretion. The footer sits inside a `fixed` View so
// the renderer repeats it on every page without this component counting
// pages itself (DOC-05: the footer must never be omitted merely because the
// document did not paginate).

import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { renderInternalRecordFooter, type InternalRecordView } from "./internal-record-view.ts";

const PAGE_MARGIN = 24;

export function InternalRecordDocument({ view }: { view: InternalRecordView }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={{ padding: PAGE_MARGIN, fontSize: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "bold" }}>{view.title}</Text>
        <View
          fixed
          style={{
            position: "absolute",
            bottom: PAGE_MARGIN,
            left: PAGE_MARGIN,
            right: PAGE_MARGIN,
          }}
        >
          <Text style={{ fontSize: 7, color: "#6b7480" }}>{renderInternalRecordFooter(view.footer)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// Async wrapper around the renderer's buffer API, so the Route Handler
// never imports @react-pdf/renderer directly — matching this codebase's
// established "pure module + thin renderer" convention (07-RESEARCH.md
// Pattern 1).
export async function renderInternalRecordPdf(view: InternalRecordView): Promise<Buffer> {
  return renderToBuffer(<InternalRecordDocument view={view} />);
}

#!/usr/bin/env node
// scripts/smoke-internal-record.mjs
//
// De-risks 07-RESEARCH.md Common Pitfall 4 / Open Question 3
// (diegomura/react-pdf#3285 — an open, unresolved upstream bug affecting
// @react-pdf/renderer imported through an external workspace package and
// rendered from a Next.js App Router Route Handler):
// tests/routes/internal-record.test.ts drives the GET handler function
// directly through Vitest's test runner, which bypasses Next's bundler
// entirely — a green route test is genuine evidence the CODE is correct,
// but is NOT evidence the upstream monorepo crash does not bite under
// Next's own bundler. This script closes that gap the automated way: it
// starts the web app's own dev server as a real child process (the same
// portable technique apps/web/scripts/dev.mjs already uses — resolving
// Next's binary through createRequire and spawning it with
// process.execPath, telemetry and tracking disabled), then drives the full
// create-matter-to-signed-off-PDF path over real HTTP against it.
//
// If this ever starts failing with "Cannot read properties of undefined"
// (the crash's own reported signature), do NOT delete this script as
// "redundant with the route test" — it is proving something the route test
// structurally cannot: that the code survives Next's real bundler, not
// only a direct function call.

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const WEB_APP_DIR = path.join(REPO_ROOT, "apps", "web");

const DEMO_ROLE_COOKIE = "dsar_demo_role";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const PDF_MAGIC_HEADER = "%PDF-";
const SERVER_READY_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;
const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

const LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH", // -> ALLOW
    description: "Staff time locating and retrieving the requested records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 60,
    unit: "HOUR",
    unitRate: 1000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "PHOTOCOPY_PRINT", // -> ALLOW_CAPPED
    description: "Photocopying the paginated response for physical delivery",
    quantity: 220,
    unit: "PAGE",
    unitRate: 15,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "OTHER_UNCLASSIFIED", // -> FLAG
    description: "Meeting room and refreshments for the internal review session",
    quantity: 1,
    unit: "FIXED",
    unitRate: 4500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

class SmokeFailure extends Error {}

function fail(message) {
  throw new SmokeFailure(message);
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

// Cross-platform: a plain child.kill() reliably stops the immediate `next`
// process, but Next's dev server on Windows can leave the Turbopack worker
// process it spawns as a grandchild running — `taskkill /T` kills the whole
// process tree, matching this repo's own established "Windows build
// machine needs portable, tree-aware process handling" precedent
// (apps/web/scripts/dev.mjs's own module comment).
function killServerTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Not listening yet — keep polling rather than treating this as fatal.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  fail(`Server never answered at ${baseUrl} within ${timeoutMs}ms — failing loudly rather than hanging`);
}

async function jsonFetch(url, method, body, cookie) {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body ?? {}),
  });
}

function nextReference() {
  return `DSAR-SMOKE-${Date.now()}`;
}

function findLine(assessment, verdict) {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) fail(`fixture has no ${verdict} line — cannot continue the smoke sequence`);
  return line;
}

// The exact sequence tests/routes/signoff.test.ts already performs
// in-process: create a matter as HR, add expense lines, submit for
// assessment, switch to the legal reviewer role, disposition every
// assessment line with a valid reason, sign off. Every step asserts its own
// status before continuing, so a failure here names precisely which step of
// the real path broke, not just "something failed".
async function driveToSignedOff(baseUrl) {
  const matterInput = {
    reference: nextReference(),
    jurisdictionCode: "SG",
    legalEntity: "Acme Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-09-01",
    requestorClass: "FORMER_EMPLOYEE",
    currency: "SGD",
    identityVerified: true,
    identityVerifiedNote: null,
    scopeClarified: true,
    isRepeatRequestWithin12Months: false,
    isKnownDisputeOrLitigation: false,
  };

  const matterResponse = await jsonFetch(`${baseUrl}/api/matters`, "POST", matterInput, HR_COOKIE);
  if (matterResponse.status !== 201) {
    fail(`create matter: expected 201, got ${matterResponse.status} — ${await matterResponse.text()}`);
  }
  const matter = await matterResponse.json();

  for (const input of LINE_INPUTS) {
    const response = await jsonFetch(`${baseUrl}/api/matters/${matter.id}/lines`, "POST", input, HR_COOKIE);
    if (response.status !== 201) {
      fail(`add expense line: expected 201, got ${response.status} — ${await response.text()}`);
    }
  }

  const submitResponse = await jsonFetch(`${baseUrl}/api/matters/${matter.id}/submit`, "POST", {}, HR_COOKIE);
  if (submitResponse.status !== 200) {
    fail(`submit for assessment: expected 200, got ${submitResponse.status} — ${await submitResponse.text()}`);
  }
  const assessment = await submitResponse.json();

  const dispositions = [
    [findLine(assessment, "ALLOW"), { action: "ACCEPT", reason: GOOD_REASON }],
    [findLine(assessment, "DISALLOW"), { action: "ACCEPT", reason: GOOD_REASON }],
    [findLine(assessment, "ALLOW_CAPPED"), { action: "ACCEPT", reason: GOOD_REASON }],
    [findLine(assessment, "FLAG"), { action: "STRIKE", reason: GOOD_REASON }],
  ];
  for (const [line, body] of dispositions) {
    const response = await jsonFetch(`${baseUrl}/api/assessment-lines/${line.id}/disposition`, "POST", body, LEGAL_COOKIE);
    if (response.status !== 200) {
      fail(`disposition line ${line.id}: expected 200, got ${response.status} — ${await response.text()}`);
    }
  }

  const signOffResponse = await jsonFetch(
    `${baseUrl}/api/assessments/${assessment.id}/signoff`,
    "POST",
    { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
    LEGAL_COOKIE
  );
  if (signOffResponse.status !== 200) {
    fail(`sign off: expected 200, got ${signOffResponse.status} — ${await signOffResponse.text()}`);
  }

  return assessment.id;
}

// The check this whole script exists for. If this returns a 500, the
// crash this is guarding against surfaces as an opaque minified
// property-access error — printing only a status code would leave the
// reader no better off than before, so the response body is printed
// verbatim before failing.
async function assertInternalRecord(baseUrl, assessmentId) {
  const response = await fetch(`${baseUrl}/api/assessments/${assessmentId}/internal-record`, {
    headers: { cookie: LEGAL_COOKIE },
  });

  if (response.status === 500) {
    const text = await response.text();
    console.error("INTERNAL RECORD RETURNED 500 — response body follows verbatim:");
    console.error(text);
  }

  if (response.status !== 200) {
    fail(`internal record: expected status 200, got ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType !== "application/pdf") {
    fail(`internal record: expected content-type "application/pdf", got ${JSON.stringify(contentType)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const header = buffer.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii");
  if (header !== PDF_MAGIC_HEADER) {
    fail(
      `internal record: expected leading bytes ${JSON.stringify(PDF_MAGIC_HEADER)}, got ${JSON.stringify(header)} (body length ${buffer.length})`
    );
  }

  console.log(
    `SMOKE OK — status ${response.status}, content-type ${contentType}, leading bytes ${JSON.stringify(header)}, body length ${buffer.length}`
  );
}

async function main() {
  const port = await pickFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  // Resolved through apps/web's OWN node_modules (createRequire anchored at
  // apps/web/package.json), exactly the way apps/web/scripts/dev.mjs
  // resolves it — not the repo root's copy, even though the root also
  // depends on `next` directly.
  const requireFromWebApp = createRequire(path.join(WEB_APP_DIR, "package.json"));
  const nextBin = requireFromWebApp.resolve("next/dist/bin/next");

  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd: WEB_APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  let serverOutput = "";
  child.stdout?.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(baseUrl, SERVER_READY_TIMEOUT_MS);
    const assessmentId = await driveToSignedOff(baseUrl);
    await assertInternalRecord(baseUrl, assessmentId);
  } catch (error) {
    const tail = serverOutput.split("\n").slice(-60).join("\n");
    if (tail.trim().length > 0) {
      console.error("--- dev server output (last 60 lines) ---");
      console.error(tail);
      console.error("------------------------------------------");
    }
    throw error;
  } finally {
    killServerTree(child);
  }
}

main().catch((error) => {
  console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

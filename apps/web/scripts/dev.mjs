// apps/web/scripts/dev.mjs
//
// Wraps Next's dev binary as a child process rather than an inline
// `NEXT_TELEMETRY_DISABLED=1 next dev` npm script: a leading
// environment-variable assignment is not portable on the Windows build
// machine this repo runs on. Setting the env vars here and forwarding the
// child's exit code gives the same effect cross-platform.
//
// The telemetry/do-not-track vars are set unconditionally: success
// criterion 1 claims "no network" for this demo, and Next's anonymous
// telemetry ping — while it never blocks startup — would make that claim
// false in letter even though it never blocks anything.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

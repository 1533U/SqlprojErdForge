/**
 * P4-2 — DACPAC build verification on fixture `.sqlproj` (ADR-0002 CI backstop).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { VerifyHarness } from "./harness.ts";
import { SAMPLE_PROJECT } from "./paths.ts";

function dotnetAvailable(): boolean {
  try {
    execSync("dotnet --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function runVerifyDacpac(): void {
  const h = new VerifyHarness();
  console.log("SqlprojErdForge — DACPAC build verification (P4-2)\n");

  h.check("fixture sqlproj exists", existsSync(SAMPLE_PROJECT));

  if (!dotnetAvailable()) {
    console.log("\n  dotnet SDK not installed — skipping DACPAC build (CI runs this step).\n");
    h.exitWithSummary("ALL DACPAC CHECKS PASSED (skipped locally)", "{n} DACPAC CHECK(S) FAILED");
  }

  try {
    const out = execSync(`dotnet build "${SAMPLE_PROJECT}" -v minimal`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    h.check("fixture sqlproj builds to DACPAC", true);
    if (/Build succeeded/i.test(out)) {
      console.log("  dotnet build: succeeded");
    }
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const detail = (e.stderr ?? e.stdout ?? e.message ?? "dotnet build failed").trim();
    h.check("fixture sqlproj builds to DACPAC", false, detail.split("\n").slice(-3).join(" "));
    console.log(detail);
  }

  h.exitWithSummary("ALL DACPAC CHECKS PASSED", "{n} DACPAC CHECK(S) FAILED");
}

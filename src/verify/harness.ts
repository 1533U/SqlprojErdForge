/**
 * Shared assertion helpers for headless verification runners.
 */

import type { EditValidationResult, FileEditCandidate } from "../edits/types.ts";

export class VerifyHarness {
  failures = 0;

  check(label: string, ok: boolean, detail?: string): void {
    const mark = ok ? "PASS" : "FAIL";
    if (!ok) this.failures++;
    console.log(`  [${mark}] ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  }

  checkPrepareOk(
    label: string,
    result: EditValidationResult,
  ): result is Extract<EditValidationResult, { ok: true }> {
    const ok = result.ok === true && result.candidates.length > 0;
    this.check(label, ok);
    return ok;
  }

  primaryCandidate(result: Extract<EditValidationResult, { ok: true }>): FileEditCandidate {
    return result.candidates[0]!;
  }

  checkPrepareRejected(label: string, result: EditValidationResult): void {
    this.check(label, result.ok === false, result.ok ? undefined : result.message);
  }

  exitWithSummary(passedLabel: string, failedLabel: string): never {
    console.log(
      `\n${this.failures === 0 ? passedLabel : failedLabel.replace("{n}", String(this.failures))}`,
    );
    process.exit(this.failures === 0 ? 0 : 1);
  }
}

export function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => (l ? `    ${l}` : l))
    .join("\n");
}

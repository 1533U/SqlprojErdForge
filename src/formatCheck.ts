/**
 * Canonical format conformance (P4-1 / ADR-0013).
 *
 * A table file is canonical when on-disk content equals emit(parse(src)) byte-for-byte.
 * The emitter is the reference implementation; no separate formatting rules.
 */

import { readFileSync } from "node:fs";
import { emitTable } from "./emitter.ts";
import { parseTable } from "./parser.ts";

export type FormatCheckStatus = "ok" | "skipped" | "non_canonical" | "parse_error";

export interface FormatCheckResult {
  file: string;
  status: FormatCheckStatus;
  /** Human-readable detail for failures and skips. */
  detail?: string;
  /** Canonical content when status is `non_canonical`. */
  expected?: string;
}

/** True when the file should fail a format-check gate. */
export function formatCheckFailed(result: FormatCheckResult): boolean {
  return result.status === "non_canonical" || result.status === "parse_error";
}

/**
 * Check whether `src` is canonical for a single table file.
 * Skips files with no live CREATE TABLE (C9 commented-out tables).
 */
export function checkTableSqlConformance(src: string, file: string): FormatCheckResult {
  const hasLiveCreate = /\bCREATE\s+TABLE\b/i.test(src.replace(/--[^\n]*/g, ""));
  const parsed = parseTable(src, file);

  if (!parsed.table) {
    if (hasLiveCreate) {
      const firstError = parsed.diagnostics.find((d) => d.severity === "error");
      return {
        file,
        status: "parse_error",
        detail: firstError?.message ?? "CREATE TABLE present but parse yielded no table",
      };
    }
    return { file, status: "skipped", detail: "no live CREATE TABLE" };
  }

  const expected = emitTable(parsed.table);
  if (src === expected) {
    return { file, status: "ok" };
  }

  return {
    file,
    status: "non_canonical",
    expected,
    detail: summarizeConformanceDiff(src, expected),
  };
}

/** Read `filePath` from disk and check canonical conformance. */
export function checkTableFile(filePath: string): FormatCheckResult {
  const src = readFileSync(filePath, "utf8");
  return checkTableSqlConformance(src, filePath);
}

function summarizeConformanceDiff(actual: string, expected: string): string {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const max = Math.max(actualLines.length, expectedLines.length);
  const snippets: string[] = [];

  for (let i = 0; i < max && snippets.length < 3; i++) {
    const a = actualLines[i] ?? "";
    const e = expectedLines[i] ?? "";
    if (a !== e) {
      snippets.push(`line ${i + 1}: on-disk ≠ emitter`);
    }
  }

  const suffix =
    snippets.length > 0 ? snippets.join("; ") : `${actual.length} vs ${expected.length} bytes`;
  return `not canonical (${suffix})`;
}

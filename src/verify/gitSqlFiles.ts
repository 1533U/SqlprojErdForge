/**
 * Git helpers for scoped format checks (ADR-0010 — changed .sql files only).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: REPO, encoding: "utf8" }).trim();
}

function gitOk(args: string): boolean {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the merge base for format checks (explicit arg → env → origin/main → HEAD~1). */
export function resolveFormatCheckBase(explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = process.env.FORMAT_CHECK_BASE?.trim();
  if (fromEnv) return fromEnv;
  if (gitOk("rev-parse --verify origin/main")) return "origin/main";
  if (gitOk("rev-parse --verify HEAD~1")) return "HEAD~1";
  return "HEAD";
}

/**
 * List `.sql` paths changed between `base` and `head` (three-dot diff).
 * Paths are repo-relative; only files that still exist on disk are returned.
 */
export function listChangedSqlFiles(base: string, head = "HEAD"): string[] {
  if (!gitOk("rev-parse --git-dir")) {
    return [];
  }

  let out = "";
  try {
    out = git(`diff --name-only --diff-filter=ACMR ${base}...${head} -- "*.sql"`);
  } catch {
    return [];
  }

  if (!out) return [];

  return out
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((rel) => existsSync(join(REPO, rel)));
}

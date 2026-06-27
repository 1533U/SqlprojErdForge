/**
 * SQL build-item role detection (P0-14 / C2).
 *
 * Table files start with a top-level CREATE TABLE. Procs, views, and functions may contain
 * nested CREATE TABLE (e.g. #temp) — we must not feed those through the table parser.
 */

import { tokenize, type Token } from "./tokenizer.ts";

export type SqlFileRole = "table" | "non_table";

const isComment = (t: Token | undefined): boolean =>
  !!t && (t.kind === "lineComment" || t.kind === "blockComment");

const isIdent = (t: Token | undefined, word: string): boolean =>
  !!t && t.kind === "ident" && t.value.toUpperCase() === word;

function skipComments(tokens: Token[], i: number): number {
  while (i < tokens.length && isComment(tokens[i])) i++;
  return i;
}

/** First live DDL object in the file; defaults to non_table when none or not CREATE TABLE. */
export function classifySqlFileRole(src: string): SqlFileRole {
  const tokens = tokenize(src);
  for (let i = 0; i < tokens.length; i++) {
    if (!isIdent(tokens[i], "CREATE")) continue;

    let j = skipComments(tokens, i + 1);
    if (isIdent(tokens[j], "OR")) {
      j = skipComments(tokens, j + 1);
      if (isIdent(tokens[j], "ALTER")) j = skipComments(tokens, j + 1);
    }

    const objectKind = tokens[j]?.value.toUpperCase();
    if (!objectKind) return "non_table";

    switch (objectKind) {
      case "TABLE":
        return "table";
      case "PROCEDURE":
      case "PROC":
      case "VIEW":
      case "FUNCTION":
      case "TRIGGER":
      case "TYPE":
      case "RULE":
      case "DEFAULT":
      case "SYNONYM":
      case "SEQUENCE":
      case "SERVICE":
      case "QUEUE":
      case "CONTRACT":
      case "MESSAGE":
      case "AGGREGATE":
      case "ASSEMBLY":
      case "CERTIFICATE":
      case "ASYMMETRIC":
      case "SYMMETRIC":
      case "MASTER":
      case "EVENT":
      case "FULLTEXT":
      case "XML":
      case "SPATIAL":
      case "SELECTIVE":
      case "SECURITY":
      case "ROLE":
      case "APPLICATION":
      case "SCHEMA":
      case "USER":
      case "LOGIN":
        return "non_table";
      case "UNIQUE":
      case "CLUSTERED":
      case "NONCLUSTERED":
        // CREATE UNIQUE INDEX / CREATE CLUSTERED INDEX …
        return "non_table";
      default:
        return "non_table";
    }
  }
  return "non_table";
}

/** True when the build item should be parsed as a declarative table file (C2). */
export function isTableSqlFile(src: string): boolean {
  return classifySqlFileRole(src) === "table";
}

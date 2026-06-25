/**
 * Recursive-descent parser (ADR-0009) for the opinionated CREATE TABLE subset
 * (docs/03-sql-conventions.md), producing the model in docs/05-data-model.md.
 *
 * Responsibilities:
 *  - Skip fully commented-out tables with no diagnostic (C9).
 *  - Attach comments to the four slots (ADR-0006 / docs/04-comment-model.md).
 *  - Emit loud diagnostics for unsupported constructs (C6 / ADR-0002).
 *  - Model temporal columns + PERIOD; flag post-`GO` content non-fatally (ADR-0012).
 */

import type { Token } from "./tokenizer.ts";
import { tokenize, commentText } from "./tokenizer.ts";
import type {
  Table,
  Member,
  Column,
  Constraint,
  PeriodForSystemTime,
  Diagnostic,
  ReferentialAction,
} from "./model.ts";

export interface ParseResult {
  table?: Table;
  diagnostics: Diagnostic[];
}

const isKw = (t: Token | undefined, kw: string): boolean =>
  !!t && t.kind === "ident" && t.value.toUpperCase() === kw;
const isPunct = (t: Token | undefined, p: string): boolean =>
  !!t && t.kind === "punct" && t.value === p;
const isComment = (t: Token | undefined): boolean =>
  !!t && (t.kind === "lineComment" || t.kind === "blockComment");
const isName = (t: Token | undefined): boolean =>
  !!t && (t.kind === "ident" || t.kind === "bracketIdent");

export function parseTable(src: string, file: string): ParseResult {
  const tokens = tokenize(src);
  const diagnostics: Diagnostic[] = [];

  // Locate the first *live* CREATE TABLE. Commented-out CREATE statements are comment
  // tokens, so they are invisible here (C9).
  let createIdx = -1;
  for (let k = 0; k < tokens.length; k++) {
    if (isKw(tokens[k], "CREATE") && isKw(tokens[k + 1], "TABLE")) {
      createIdx = k;
      break;
    }
  }
  if (createIdx === -1) {
    // No live table in this file: yield nothing, no diagnostic (C9).
    return { diagnostics };
  }

  // Header comments: standalone comments before CREATE TABLE.
  const headerComments: string[] = [];
  for (let k = 0; k < createIdx; k++) {
    const t = tokens[k];
    if (isComment(t)) headerComments.push(commentText(t as Token));
  }

  let i = createIdx + 2;

  // Table name: [schema].[name] | schema.name | name
  if (!isName(tokens[i])) {
    diagnostics.push(diag(file, tokens[i], "Expected table name after CREATE TABLE"));
    return { diagnostics };
  }
  let schema = "dbo";
  let name = (tokens[i] as Token).value;
  i++;
  if (isPunct(tokens[i], ".")) {
    i++;
    if (!isName(tokens[i])) {
      diagnostics.push(diag(file, tokens[i], "Expected table name after schema."));
      return { diagnostics };
    }
    schema = name;
    name = (tokens[i] as Token).value;
    i++;
  }

  if (!isPunct(tokens[i], "(")) {
    diagnostics.push(diag(file, tokens[i], "Expected '(' to open the table body"));
    return { diagnostics };
  }
  const bodyOpen = i;

  // Matching close paren for the body.
  let depth = 0;
  let bodyClose = -1;
  for (let k = bodyOpen; k < tokens.length; k++) {
    if (isPunct(tokens[k], "(")) depth++;
    else if (isPunct(tokens[k], ")")) {
      depth--;
      if (depth === 0) {
        bodyClose = k;
        break;
      }
    }
  }
  if (bodyClose === -1) {
    diagnostics.push(diag(file, tokens[bodyOpen], "Unbalanced parentheses in table body"));
    return { diagnostics };
  }

  const body = tokens.slice(bodyOpen + 1, bodyClose);
  const { members, footer } = parseBody(body, file, diagnostics);

  // Post-close content: optional ';', trailing/standalone comments → footer; any code
  // token (GO, ON, CREATE INDEX, …) → non-fatal diagnostic, file not round-trippable.
  const footerComments = [...footer];
  let roundTrippable = true;
  for (let k = bodyClose + 1; k < tokens.length; k++) {
    const t = tokens[k] as Token;
    if (isPunct(t, ";")) continue;
    if (isComment(t)) {
      footerComments.push(commentText(t));
      continue;
    }
    roundTrippable = false;
    diagnostics.push({
      file,
      line: t.line,
      column: t.col,
      severity: "warning",
      message: `Un-modeled content after CREATE TABLE ('${t.value}'); the table is kept but its file will not be rewritten (ADR-0012).`,
    });
    break;
  }

  const table: Table = {
    schema,
    name,
    sourceFile: basename(file),
    members,
    readOnly: false,
    roundTrippable,
  };
  if (headerComments.length) table.headerComments = headerComments;
  if (footerComments.length) table.footerComments = footerComments;

  return { table, diagnostics };
}

interface BodyResult {
  members: Member[];
  footer: string[];
}

function parseBody(body: Token[], file: string, diagnostics: Diagnostic[]): BodyResult {
  const members: Member[] = [];
  let pendingLeading: string[] = [];
  let idx = 0;
  const len = body.length;

  const memberEndFrom = (start: number): number => {
    let d = 0;
    for (let k = start; k < len; k++) {
      const t = body[k] as Token;
      if (isPunct(t, "(")) d++;
      else if (isPunct(t, ")")) d--;
      else if (isPunct(t, ",") && d === 0) return k;
    }
    return len;
  };

  while (idx < len) {
    const t = body[idx] as Token;
    if (isComment(t)) {
      pendingLeading.push(commentText(t));
      idx++;
      continue;
    }
    if (isPunct(t, ",")) {
      idx++; // separator
      continue;
    }

    const end = memberEndFrom(idx);
    const runTokens = body.slice(idx, end);
    const { member, carry } = parseMember(runTokens, file, diagnostics, pendingLeading);
    if (member) members.push(member);
    pendingLeading = carry;
    idx = end < len ? end + 1 : len;

    // Trailing-comma style: an inline comment right after the separating comma, on the
    // member's line, is that member's trailing comment.
    while (idx < len && isComment(body[idx]) && !(body[idx] as Token).startsLine) {
      const c = body[idx] as Token;
      const last = members[members.length - 1];
      if (last) {
        last.trailingComment = last.trailingComment
          ? `${last.trailingComment} ${commentText(c)}`
          : commentText(c);
      }
      idx++;
    }
  }

  return { members, footer: pendingLeading };
}

interface MemberResult {
  member?: Member;
  carry: string[];
}

function parseMember(
  runTokens: Token[],
  file: string,
  diagnostics: Diagnostic[],
  leadingIn: string[],
): MemberResult {
  const code = runTokens.filter((t) => !isComment(t));
  if (code.length === 0) {
    // Only comments in this run (e.g. commented-out trailing members): carry forward.
    return { carry: [...leadingIn, ...runTokens.map(commentText)] };
  }

  const lastCode = code[code.length - 1] as Token;
  const leading = [...leadingIn];
  const trailing: string[] = [];
  const carry: string[] = [];
  for (const t of runTokens) {
    if (!isComment(t)) continue;
    if (t.line === lastCode.line && t.offset > lastCode.offset) trailing.push(commentText(t));
    else if (t.line < lastCode.line) leading.push(commentText(t));
    else carry.push(commentText(t));
  }

  const member = parseMemberCode(code, file, diagnostics);
  if (!member) return { carry: [...leading, ...carry] };

  if (leading.length) member.leadingComments = leading;
  if (trailing.length) member.trailingComment = trailing.join(" ");
  return { member, carry };
}

function parseMemberCode(code: Token[], file: string, diagnostics: Diagnostic[]): Member | undefined {
  const first = code[0] as Token;
  const up = first.value.toUpperCase();
  if (first.kind === "ident" && up === "CONSTRAINT") return parseConstraint(code, file, diagnostics);
  if (first.kind === "ident" && up === "PERIOD") return parsePeriod(code, file, diagnostics);
  return parseColumn(code, file, diagnostics);
}

function parseColumn(code: Token[], file: string, diagnostics: Diagnostic[]): Column | undefined {
  let p = 0;
  const name = (code[p++] as Token).value;

  const typeTok = code[p];
  if (!isName(typeTok)) {
    diagnostics.push(diag(file, typeTok, `Expected a data type for column '${name}'`));
    return undefined;
  }
  let dataType = (typeTok as Token).value.toUpperCase();
  p++;
  if (isPunct(code[p], "(")) {
    p++;
    const args: string[] = [];
    let cur: string[] = [];
    while (p < code.length && !isPunct(code[p], ")")) {
      if (isPunct(code[p], ",")) {
        args.push(cur.join(" "));
        cur = [];
      } else {
        cur.push((code[p] as Token).value);
      }
      p++;
    }
    if (cur.length) args.push(cur.join(" "));
    if (isPunct(code[p], ")")) p++;
    dataType = `${dataType}(${args.join(", ")})`;
  }

  const col: Column = { kind: "column", name, dataType, nullable: true };

  while (p < code.length) {
    const t = code[p] as Token;
    const u = t.value.toUpperCase();
    if (t.kind === "ident" && u === "NOT" && isKw(code[p + 1], "NULL")) {
      col.nullable = false;
      p += 2;
      continue;
    }
    if (t.kind === "ident" && u === "NULL") {
      col.nullable = true;
      p++;
      continue;
    }
    if (t.kind === "ident" && u === "IDENTITY") {
      p++;
      let seed = 1;
      let increment = 1;
      if (isPunct(code[p], "(")) {
        p++;
        seed = Number((code[p++] as Token).value);
        if (isPunct(code[p], ",")) p++;
        increment = Number((code[p++] as Token).value);
        if (isPunct(code[p], ")")) p++;
      }
      col.identity = { seed, increment };
      continue;
    }
    if (t.kind === "ident" && u === "DEFAULT") {
      p++;
      const r = readExpr(code, p);
      col.default = r.text;
      p = r.next;
      continue;
    }
    if (t.kind === "ident" && u === "COLLATE") {
      p++;
      col.collate = (code[p++] as Token).value;
      continue;
    }
    if (t.kind === "ident" && u === "GENERATED") {
      p++;
      if (isKw(code[p], "ALWAYS")) p++;
      if (isKw(code[p], "AS")) p++;
      if (isKw(code[p], "ROW")) p++;
      const dir = code[p] ? (code[p] as Token).value.toUpperCase() : "";
      if (dir === "START") {
        col.generatedAs = "rowStart";
        p++;
      } else if (dir === "END") {
        col.generatedAs = "rowEnd";
        p++;
      }
      continue;
    }
    if (t.kind === "ident" && u === "AS") {
      p++;
      const r = readExpr(code, p);
      col.computed = r.text;
      p = r.next;
      continue;
    }
    diagnostics.push(diag(file, t, `Unsupported column modifier '${t.value}' on '${name}'`, "warning"));
    p++;
  }

  return col;
}

function parseConstraint(code: Token[], file: string, diagnostics: Diagnostic[]): Constraint | undefined {
  let p = 1; // skip CONSTRAINT
  const name = (code[p++] as Token).value;
  const kind = code[p] ? (code[p] as Token).value.toUpperCase() : "";

  if (kind === "PRIMARY") {
    p++;
    if (isKw(code[p], "KEY")) p++;
    if (isKw(code[p], "CLUSTERED") || isKw(code[p], "NONCLUSTERED")) p++;
    const cols = readColumnList(code, p);
    return { kind: "constraint", constraintType: "primaryKey", name, columns: cols.cols };
  }

  if (kind === "FOREIGN") {
    p++;
    if (isKw(code[p], "KEY")) p++;
    const local = readColumnList(code, p);
    p = local.next;
    if (!isKw(code[p], "REFERENCES")) {
      diagnostics.push(diag(file, code[p], `FOREIGN KEY '${name}' is missing REFERENCES`));
      return undefined;
    }
    p++;
    let refSchema: string | undefined;
    let refTable = (code[p++] as Token).value;
    if (isPunct(code[p], ".")) {
      p++;
      refSchema = refTable;
      refTable = (code[p++] as Token).value;
    }
    const ref = readColumnList(code, p);
    p = ref.next;
    let onDelete: ReferentialAction | undefined;
    let onUpdate: ReferentialAction | undefined;
    while (isKw(code[p], "ON")) {
      p++;
      const which = code[p] ? (code[p] as Token).value.toUpperCase() : "";
      p++;
      const action = readReferentialAction(code, p);
      p = action.next;
      if (which === "DELETE") onDelete = action.action;
      else if (which === "UPDATE") onUpdate = action.action;
    }
    return {
      kind: "constraint",
      constraintType: "foreignKey",
      name,
      columns: local.cols,
      references: { schema: refSchema, table: refTable, columns: ref.cols },
      ...(onDelete ? { onDelete } : {}),
      ...(onUpdate ? { onUpdate } : {}),
    };
  }

  if (kind === "UNIQUE") {
    p++;
    if (isKw(code[p], "CLUSTERED") || isKw(code[p], "NONCLUSTERED")) p++;
    const cols = readColumnList(code, p);
    return { kind: "constraint", constraintType: "unique", name, columns: cols.cols };
  }

  if (kind === "CHECK") {
    p++;
    const r = readExpr(code, p);
    return { kind: "constraint", constraintType: "check", name, expression: r.text };
  }

  diagnostics.push(diag(file, code[p], `Unsupported constraint kind '${kind}' for '${name}'`));
  return undefined;
}

function parsePeriod(code: Token[], file: string, diagnostics: Diagnostic[]): PeriodForSystemTime | undefined {
  let p = 1; // skip PERIOD
  if (isKw(code[p], "FOR")) p++;
  if (isKw(code[p], "SYSTEM_TIME")) p++;
  const cols = readColumnList(code, p);
  if (cols.cols.length !== 2) {
    diagnostics.push(diag(file, code[0], "PERIOD FOR SYSTEM_TIME requires two columns"));
    return undefined;
  }
  return { kind: "period", startColumn: cols.cols[0] as string, endColumn: cols.cols[1] as string };
}

interface ColumnListResult {
  cols: string[];
  next: number;
}

function readColumnList(code: Token[], start: number): ColumnListResult {
  let p = start;
  const cols: string[] = [];
  if (!isPunct(code[p], "(")) return { cols, next: p };
  p++;
  while (p < code.length && !isPunct(code[p], ")")) {
    const t = code[p] as Token;
    if (isPunct(t, ",")) {
      p++;
      continue;
    }
    if (isName(t)) {
      cols.push(t.value);
      p++;
      // skip ASC/DESC sort hints.
      if (isKw(code[p], "ASC") || isKw(code[p], "DESC")) p++;
      continue;
    }
    p++; // skip anything unexpected
  }
  if (isPunct(code[p], ")")) p++;
  return { cols, next: p };
}

interface ExprResult {
  text: string;
  next: number;
}

/** Read a balanced parenthesized expression (or a single token) and render it canonically. */
function readExpr(code: Token[], start: number): ExprResult {
  let p = start;
  if (!isPunct(code[p], "(")) {
    const t = code[p];
    return { text: t ? renderTokens([t]) : "", next: p + 1 };
  }
  let d = 0;
  const slice: Token[] = [];
  for (; p < code.length; p++) {
    const t = code[p] as Token;
    slice.push(t);
    if (isPunct(t, "(")) d++;
    else if (isPunct(t, ")")) {
      d--;
      if (d === 0) {
        p++;
        break;
      }
    }
  }
  return { text: renderTokens(slice), next: p };
}

interface ActionResult {
  action: ReferentialAction;
  next: number;
}

function readReferentialAction(code: Token[], start: number): ActionResult {
  let p = start;
  const w0 = code[p] ? (code[p] as Token).value.toUpperCase() : "";
  if (w0 === "CASCADE") return { action: "cascade", next: p + 1 };
  if (w0 === "NO" && isKw(code[p + 1], "ACTION")) return { action: "noAction", next: p + 2 };
  if (w0 === "SET" && isKw(code[p + 1], "NULL")) return { action: "setNull", next: p + 2 };
  if (w0 === "SET" && isKw(code[p + 1], "DEFAULT")) return { action: "setDefault", next: p + 2 };
  return { action: "noAction", next: p + 1 };
}

/** Render a token slice with deterministic spacing (used for default/check/computed exprs). */
function renderTokens(tokens: Token[]): string {
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    const prev = tokens[i - 1];
    const noSpace =
      i === 0 ||
      isPunct(t, ")") ||
      isPunct(t, ",") ||
      isPunct(t, ".") ||
      isPunct(t, "(") ||
      isPunct(prev, "(") ||
      isPunct(prev, ".");
    out += (noSpace ? "" : " ") + t.text;
  }
  return out;
}

function diag(
  file: string,
  tok: Token | undefined,
  message: string,
  severity: "error" | "warning" = "error",
): Diagnostic {
  return {
    file,
    line: tok ? tok.line : 0,
    column: tok ? tok.col : undefined,
    severity,
    message,
  };
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

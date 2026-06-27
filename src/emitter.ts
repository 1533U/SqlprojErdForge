/**
 * Canonical emitter (model → .sql).
 *
 * Produces the pinned canonical style (C4 / ADR-0013) and never reorders members (C5).
 * Comments are re-emitted in their four slots (ADR-0006). See docs/03-sql-conventions.md
 * C4.1–C4.8 for the full rule set; `src/formatCheck.ts` (P4-1) enforces byte-for-byte match.
 */

import type {
  Table,
  Member,
  Column,
  Constraint,
  PeriodForSystemTime,
} from "./model.ts";
import { assertNever } from "./model.ts";

const INDENT = "    ";

export function emitTable(table: Table): string {
  const lines: string[] = [];

  for (const c of table.headerComments ?? []) lines.push(`-- ${c}`);

  lines.push(`CREATE TABLE ${qualified(table.schema, table.name)} (`);

  const printable = table.members;
  printable.forEach((member, index) => {
    const isLast = index === printable.length - 1;
    for (const c of member.leadingComments ?? []) lines.push(`${INDENT}-- ${c}`);
    const body = emitMember(member);
    const comma = isLast ? "" : ",";
    const trailing = member.trailingComment ? ` -- ${member.trailingComment}` : "";
    lines.push(`${INDENT}${body}${comma}${trailing}`);
  });

  lines.push(");");

  for (const c of table.footerComments ?? []) lines.push(`-- ${c}`);

  return lines.join("\n") + "\n";
}

function emitMember(member: Member): string {
  switch (member.kind) {
    case "column":
      return emitColumn(member);
    case "constraint":
      return emitConstraint(member);
    case "period":
      return emitPeriod(member);
    default:
      return assertNever(member);
  }
}

function emitColumn(col: Column): string {
  if (col.computed !== undefined) {
    return `${ident(col.name)} AS ${col.computed}`;
  }
  const parts: string[] = [ident(col.name), col.dataType];
  if (col.collate) parts.push(`COLLATE ${col.collate}`);
  if (col.generatedAs) {
    // Temporal columns are implicitly NOT NULL; no null clause is emitted.
    parts.push(col.generatedAs === "rowStart" ? "GENERATED ALWAYS AS ROW START" : "GENERATED ALWAYS AS ROW END");
    return parts.join(" ");
  }
  parts.push(col.nullable ? "NULL" : "NOT NULL");
  if (col.identity) {
    parts.push(
      col.identity.seed === 1 && col.identity.increment === 1
        ? "IDENTITY"
        : `IDENTITY(${col.identity.seed}, ${col.identity.increment})`,
    );
  }
  if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`);
  return parts.join(" ");
}

function emitConstraint(c: Constraint): string {
  switch (c.constraintType) {
    case "primaryKey":
      return `CONSTRAINT ${ident(c.name)} PRIMARY KEY (${columnList(c.columns)})`;
    case "foreignKey": {
      const ref = qualified(c.references.schema, c.references.table);
      let out = `CONSTRAINT ${ident(c.name)} FOREIGN KEY (${columnList(c.columns)}) REFERENCES ${ref} (${columnList(c.references.columns)})`;
      if (c.onDelete) out += ` ON DELETE ${referentialAction(c.onDelete)}`;
      if (c.onUpdate) out += ` ON UPDATE ${referentialAction(c.onUpdate)}`;
      return out;
    }
    case "unique":
      return `CONSTRAINT ${ident(c.name)} UNIQUE (${columnList(c.columns)})`;
    case "check":
      return `CONSTRAINT ${ident(c.name)} CHECK ${c.expression}`;
    default:
      return assertNever(c);
  }
}

function emitPeriod(p: PeriodForSystemTime): string {
  return `PERIOD FOR SYSTEM_TIME (${ident(p.startColumn)}, ${ident(p.endColumn)})`;
}

function referentialAction(a: "noAction" | "cascade" | "setNull" | "setDefault"): string {
  switch (a) {
    case "noAction":
      return "NO ACTION";
    case "cascade":
      return "CASCADE";
    case "setNull":
      return "SET NULL";
    case "setDefault":
      return "SET DEFAULT";
    default:
      return assertNever(a);
  }
}

const SIMPLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Bracket-quote an identifier only when it is not a simple bare identifier. */
function ident(nameValue: string): string {
  return SIMPLE.test(nameValue) ? nameValue : `[${nameValue.replace(/]/g, "]]")}]`;
}

function qualified(schema: string | undefined, name: string): string {
  return schema ? `${ident(schema)}.${ident(name)}` : ident(name);
}

function columnList(cols: string[]): string {
  return cols.map(ident).join(", ");
}

# 01 — Scope

## Problem statement

Developers working in a SQL Server **database project** (`.sqlproj`) have no live,
in-editor visualization of the schema they are authoring. Existing ERD tools either
require a live database connection or are one-shot importers that cannot write changes
back into the project's `.sql` files. We want a visualization that is a **live mirror of
the project** and, ideally, lets us edit the schema *through* the diagram.

## Goals

1. **Read a `.sqlproj` without a database connection.** The schema is derived purely
   from the project's declarative `.sql` files.
2. **Render an interactive ERD** of tables, columns, primary keys, and foreign-key
   relationships inside VS Code.
3. **Stay live.** Editing a `.sql` file updates the diagram automatically.
4. **Round-trip safely.** Edits made on the diagram are written back into the `.sql`
   files as clean, minimal, reviewable diffs that preserve comments and member order.
5. **Preserve and surface comments.** Column comments are first-class and can be shown
   on the diagram.
6. **Be reviewable.** Every generated change is presented as a before/after diff the user
   can confirm or discard.

## Non-goals

- **No database connectivity.** We never connect to, read from, or write to a live SQL
  Server. The project files are the only source of truth.
- **No full T-SQL generality.** We intentionally support a constrained, declarative
  subset (see [`03-sql-conventions.md`](03-sql-conventions.md)). Unsupported constructs
  are reported as diagnostics, not silently mis-parsed.
- **No migration generation / schema diffing between versions.** DACPAC publish and
  schema compare remain the job of existing Microsoft tooling.
- **No visualization of programmability objects** (stored procedures, functions,
  triggers) in v1. The ERD is about tables and their relationships.
- **No multi-database / cross-database relationship modeling** in v1.
- **Not a general-purpose ER modeling tool** for arbitrary databases — it is scoped to
  *our* `.sqlproj` conventions.

## Audience

Internal engineering team that already authors `.sqlproj` files following shared
conventions. Because it is internal, we can lean on those conventions instead of solving
the fully generic problem.

## Success criteria

- **Phase 0 (spike):** `parse → emit → parse` is **byte-stable** on our real project
  files, including files with comments. This proves round-tripping is viable.
- **Phase 1:** Opening the command on a `.sqlproj` shows an accurate, auto-laid-out ERD
  that updates live as files change.
- **Phase 2+:** A user can perform a defined set of edits on the diagram and the
  resulting `.sql` diff is minimal, correct, comment-preserving, and DACPAC-buildable.

## Constraints & assumptions

- Our team **already follows** the conventions this tool relies on (declarative
  `CREATE TABLE`, one table per file, explicit named FK constraints, consistent
  formatting). This is the foundational assumption that makes the project tractable.
- The tool must install as a single VS Code extension with **no second runtime** (no
  required .NET install on developer machines).
- `.sql` files remain the single source of truth at all times; the tool never introduces
  a competing store of schema data.

## Out-of-scope risks we accept

- A `.sql` file using a construct outside the supported subset will be flagged with a
  diagnostic and excluded from the model rather than partially rendered. We accept that
  the tool is only as complete as the agreed conventions.

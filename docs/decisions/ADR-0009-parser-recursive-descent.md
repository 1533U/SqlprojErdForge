# ADR-0009 — Hand-written recursive-descent parser (over Chevrotain)

**Status:** Accepted

## Context

[ADR-0002](ADR-0002-pure-typescript-parser.md) committed to a pure-TypeScript
parser/emitter for the constrained subset ([`../03-sql-conventions.md`](../03-sql-conventions.md))
but left the implementation technique open: a hand-written recursive-descent parser versus
a parser-generator such as [Chevrotain](https://chevrotain.io/). Phase 0 needs the technique
pinned before writing code.

The dominant cost and risk for this grammar is **not** the grammar size — it is:

1. **Comment/trivia attachment** to the four slots in
   [ADR-0006](ADR-0006-comment-trivia-model.md) with exact source positions.
2. **Loud, precise diagnostics** (file + line + column) with the affected table excluded,
   per [ADR-0002](ADR-0002-pure-typescript-parser.md) / C6 — a lenient parser that silently
   misreads schema is the real danger.
3. **Lexical oddities** observed in the real corpus: bracket-quoted identifiers
   (`[dbo].[InvBuyer]`), identifiers containing `+` (`[PorMasterHdr+]`), bracketed type
   names (`[varchar](20)`), both leading- and trailing-comma layouts, and fully
   commented-out `CREATE TABLE` statements that must be skipped (C9).

## Decision

Implement the parser as a **hand-written recursive-descent parser** fed by a small
**trivia-preserving tokenizer** (the tokenizer keeps comment tokens and per-token
line/column/offset, rather than discarding whitespace and comments).

## Rationale

- A parser generator does **not** solve the hard parts: it discards trivia by default, so
  comment attachment is custom work either way; and its built-in error recovery actively
  works against the "fail loudly, exclude the table" requirement.
- The grammar (`CREATE TABLE` + named, table-level constraints + a column-definition
  allowlist) is small enough that recursive descent is a few hundred lines and is easy to
  read, test, and extend.
- Full control over the tokenizer makes the lexical oddities (`+` in names, bracket
  quoting, type brackets, leading/trailing commas, C9 skip) straightforward.
- No runtime dependency, consistent with the single-runtime minimalism of
  [ADR-0002](ADR-0002-pure-typescript-parser.md).

## Consequences

- We own the tokenizer, parser, and their tests. The supported-construct allowlist
  (C6, and [ADR-0012](ADR-0012-allowlist-scope.md)) lives in code and in the conventions doc.
- Diagnostics are produced directly at the point of failure with precise positions.

## Alternatives considered

- **Chevrotain grammar:** rejected for this scope — extra dependency and learning curve,
  trivia still hand-attached, and error recovery that masks the loud-failure behavior we
  explicitly want. Worth revisiting only if the supported surface grows dramatically.

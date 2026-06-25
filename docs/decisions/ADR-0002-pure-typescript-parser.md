# ADR-0002 — Pure-TypeScript parser/emitter (no .NET sidecar)

**Status:** Accepted

## Context

Parsing T-SQL accurately in the general case is best done with Microsoft's
`Microsoft.SqlServer.TransactSql.ScriptDom` / `Microsoft.SqlServer.DacFx`, which also
resolve cross-file references and build a semantic model. However, those libraries are
.NET. Using them at runtime would require shipping/installing a second runtime alongside a
VS Code (Node/TypeScript) extension and bridging via a sidecar process.

Crucially, we constrain the input to a small declarative subset
([ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md)).

## Decision

Implement a **pure-TypeScript** parser and canonical emitter for the supported subset.
**Do not** ship a .NET sidecar at runtime. Keep DacFx/DACPAC only as an **optional CI
validation gate**.

## Rationale

- The supported subset (`CREATE TABLE` + named table-level constraints) is small enough to
  parse with a hand-written recursive-descent parser (or Chevrotain) in a few hundred
  lines.
- A single-runtime extension is dramatically simpler to package, install, and maintain for
  an internal tool — no per-Electron-ABI native rebuilds, no bundled .NET.
- We still get an authoritative correctness backstop by building the DACPAC in CI, without
  making it a developer-machine dependency.

## Consequences

- The parser must **fail loudly** on anything outside the subset (diagnostics with file +
  line), because we don't have ScriptDom's generality to fall back on. A lenient parser
  that silently misreads schema is the real danger and is explicitly disallowed.
- We own the grammar and its tests; the supported-construct allowlist is part of the
  conventions doc.

## Alternatives considered

- **.NET sidecar (DacFx/ScriptDom over JSON-RPC):** most accurate and handles full T-SQL,
  but adds a second runtime and packaging complexity unjustified by our constrained input.
- **WASM build of a parser:** ScriptDom/DacFx aren't designed for it; high effort.

# Architecture Decision Records (ADRs)

Each ADR captures one significant decision, its context, and its consequences. They are
immutable once accepted; if a decision changes, add a new ADR that supersedes the old one.

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001-vscode-extension.md) | Deliver as a VS Code extension | Accepted |
| [ADR-0002](ADR-0002-pure-typescript-parser.md) | Pure-TypeScript parser/emitter (no .NET sidecar) | Accepted |
| [ADR-0003](ADR-0003-opinionated-subset-and-canonical-format.md) | Opinionated SQL subset + canonical formatting | Accepted |
| [ADR-0004](ADR-0004-in-memory-model-no-sqlite.md) | In-memory derived model, no SQLite | Accepted |
| [ADR-0005](ADR-0005-layout-sidecar.md) | Committed JSON layout sidecar | Accepted |
| [ADR-0006](ADR-0006-comment-trivia-model.md) | Comment trivia model (four slots) | Accepted |
| [ADR-0007](ADR-0007-edit-apply-ux.md) | Edit-apply UX via diff preview | Accepted |
| [ADR-0008](ADR-0008-fk-only-relationships.md) | Relationships from declared FK constraints only | Accepted |
| [ADR-0009](ADR-0009-parser-recursive-descent.md) | Hand-written recursive-descent parser (over Chevrotain) | Accepted |
| [ADR-0010](ADR-0010-formatting-strategy-lazy-canonicalization.md) | Formatting strategy: lazy canonicalization ("format on touch") — settles D1 | Accepted |
| [ADR-0011](ADR-0011-syspro-mirror-read-only.md) | Syspro mirror tables are read-only — settles D2 | Accepted |
| [ADR-0012](ADR-0012-allowlist-scope.md) | Allowlist scope: temporal columns, PERIOD, post-`GO` statements | Accepted |
| [ADR-0013](ADR-0013-canonical-format-rules.md) | Canonical format rules pinned (C4.1–C4.8) — settles P0-15 | Accepted |

# 08 — Structural refactor plan (src/ + webview/)

Behavior-preserving decomposition after the thermo-nuclear review (2026-06-27).
Each slice is ≤1 session; run the listed verify commands before merging.

## Target boundaries

| Layer | Path | Owns |
|---|---|---|
| Core | `src/` root (`model`, `tokenizer`, `parser`, `emitter`, `project`, `erd`) | SQL pipeline |
| Diagram | `src/diagram/` | Graph projection, ELK layout |
| Layout I/O | `src/layout.ts` | Sidecar read/write + position updates |
| Edits | `src/edits/` | Mutations, validation, candidates |
| Protocol | `src/protocol/` | Wire DTOs (intents = edit params) |
| Verify | `src/verify/` | Headless exit criteria |
| Extension | `src/extension/` | VS Code host |
| Webview canvas | `webview/src/canvas/` | React Flow |
| Webview edit UI | `webview/src/edit/` | Edit session + banner |

## Slices

| # | Slice | Status | Green after |
|---|---|---|---|
| 1 | Extract `src/verify/` from `cli.ts` | done | spike, verify:p1, verify:p3 |
| 2 | `applyLayoutUpdate` → `layout.ts` only | done | verify:p1 |
| 3 | Unify intent/param types | done | verify:p3 |
| 4 | Split `App.tsx` — edit UI | done | typecheck, compile |
| 5 | Split `App.tsx` — canvas | done | verify:p1 |
| 6 | Host edit dispatch table | done | verify:p3 |
| 7 | Shared `editInteraction.ts` | done | verify:p3 |
| 8 | Decompose `graph.ts` → `diagram/` | done | spike, verify:p1 |
| 9 | Edit operation registry | done | verify:p3 |

**Full gate:** `npm run typecheck && npm run compile && npm run spike && npm run verify:p1 && npm run verify:p3`

## Next (post-refactor)

- **P3-7** rename table — register as eighth edit operation.
- Parser decomposition (`src/core/parse/`) when P0-14 allowlist work starts.

# Changelog

All notable changes to this project are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/); dates are ISO `YYYY-MM-DD`.
Append meaningful changes to `Unreleased` as part of the "document progress" routine
(see [`AGENTS.md`](AGENTS.md)).

## [Unreleased]

### Added
- Initial project design documentation (`docs/01`–`07`): scope, architecture, SQL
  conventions, comment model, data model, edit/apply UX, and roadmap.
- 7 Architecture Decision Records (`docs/decisions/ADR-0001`–`0007`).
- Project README with overview, tech stack, and documentation map.
- `.gitignore` for the future VS Code extension (keeps `.erdforge/layout.json` committed).
- Project-management scaffolding: `AGENTS.md` (operating manual), `docs/STATUS.md`
  (living snapshot), `docs/backlog.md` (task list), and this changelog.
- Test fixture corpus under `test/fixtures/` (curated from the example
  `OSConnectWeylandtsDB` project) with a documented README, unblocking Phase 0 (`P0-1`).
- Synthetic `test/fixtures/SampleErd.sqlproj` entry point so project discovery is tested
  from the `.sqlproj` (MSBuild XML, backslash paths, build-item filtering) rather than a
  folder scan (`P0-1b`); added loader tasks `P0-12`/`P0-13` and detailed the Project loader
  component in `02-architecture.md`.

### Changed
- Added convention **C9**: commented-out schema (tables, columns, constraints) is ignored
  entirely — no model entry, no ERD node, no diagnostic. Updated `03-sql-conventions.md`,
  `04-comment-model.md`, and backlog `P0-9`.
- Added convention **C10** + **ADR-0008**: ERD relationships are derived **only** from
  declared `FOREIGN KEY` constraints and are **never inferred** from names/types. Updated
  `03`, `05`, the ADR index, and backlog (`P0-11`).
- Reframed the Phase 0 idempotency exit criterion to a realistic "stable fixed point after
  one normalization pass + acceptable minimal diff" (true byte-stability on messy input is
  not the bar).
- Expanded the roadmap risk register with R1–R4 (formatting-vs-real-files, idempotency bar,
  Syspro mirror tables, parser effort) and added open decisions D1 (formatting strategy)
  and D2 (Syspro mirror scope).

### Notes
- Repository is in the **design phase**; no implementation code yet. Next step is the
  Phase 0 parser/emitter idempotency spike.
- Reconnaissance of the example project surfaced real-world syntax to handle (bracket
  identifiers, `CLUSTERED` PKs with index options, commented-out tables/columns, unusual
  identifiers like `PorMasterHdr+`, `IDENTITY`/`DEFAULT`/`COLLATE`); captured as backlog
  `P0-8`/`P0-9` and in `docs/STATUS.md`.

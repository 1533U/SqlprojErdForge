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

### Notes
- Repository is in the **design phase**; no implementation code yet. Next step is the
  Phase 0 parser/emitter idempotency spike.

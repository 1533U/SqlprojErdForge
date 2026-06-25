# ADR-0001 — Deliver as a VS Code extension

**Status:** Accepted

## Context

The tool must visualize and edit a SQL Server database project where the developer already
works. The project is a set of `.sql` files on disk. We need live file watching, a rich
interactive canvas, and the ability to write changes back as reviewable diffs.

## Decision

Deliver the tool as a **VS Code extension**, with the diagram rendered in a **webview**.

## Rationale

- Lives exactly where the `.sqlproj` is authored — no context switch.
- VS Code provides the APIs we need out of the box: `FileSystemWatcher` for liveness,
  webviews for a React-based canvas, `WorkspaceEdit` and the diff editor for reviewable
  writes, and the Problems panel for diagnostics.
- Changes land on the editor's undo stack and in Git, giving a built-in safety net.

## Consequences

- The diagram UI runs in a webview (React + React Flow) communicating with the extension
  host over the message channel.
- We are bound by what the VS Code extension API exposes; notably, Cursor's exact inline
  keep/reject widget is not available, so we use the diff editor / Refactor Preview
  instead (see [ADR-0007](ADR-0007-edit-apply-ux.md)).

## Alternatives considered

- **Standalone desktop/web app:** loses in-editor integration, file watching, Git diff,
  and the undo stack we get for free.

import { type ReactElement } from "react";

import { describeOp, type DraftEntry } from "./session";

export interface DraftToolbarProps {
  draft: DraftEntry[];
  message: string | undefined;
  onReview: () => void;
  onDiscard: () => void;
  onRemoveEntry: (id: number) => void;
}

export function DraftToolbar(props: DraftToolbarProps): ReactElement | null {
  const { draft, message } = props;
  if (draft.length === 0 && !message) return null;

  return (
    <div className="erdforge-draft" role="region" aria-label="Pending edits">
      {message ? <div className="erdforge-draft__message">{message}</div> : null}
      {draft.length > 0 ? (
        <>
          <div className="erdforge-draft__header">
            <strong>{draft.length}</strong> pending {draft.length === 1 ? "edit" : "edits"}
            <div className="erdforge-draft__actions">
              <button type="button" className="erdforge-btn" onClick={props.onReview}>
                Review &amp; apply
              </button>
              <button
                type="button"
                className="erdforge-btn erdforge-btn--ghost"
                onClick={props.onDiscard}
              >
                Discard
              </button>
            </div>
          </div>
          <ul className="erdforge-draft__list">
            {draft.map((entry) => (
              <li key={entry.id} className="erdforge-draft__item">
                <span>{describeOp(entry.op)}</span>
                <button
                  type="button"
                  className="erdforge-draft__remove"
                  title="Remove this edit from the draft"
                  onClick={() => props.onRemoveEntry(entry.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

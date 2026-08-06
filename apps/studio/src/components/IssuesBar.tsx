import type { SceneId, ValidationIssue } from '@embranche/story-format';

interface Props {
  issues: ValidationIssue[];
  /** Controlled from the editor: the health badge opens this list too. */
  open: boolean;
  onToggle: () => void;
  onSelect: (sceneId: SceneId) => void;
}

/**
 * Live validation: clicking an issue selects the offending scene.
 *
 * The list folds away, because it is a proofreading pass and not a permanent
 * companion: on a long story it would eat a third of the canvas to repeat what
 * the ring on each node already says. The header stays, so the counts never
 * disappear.
 */
export function IssuesBar({ issues, open, onToggle, onSelect }: Props) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return (
    <div className={`issues${open ? ' issues--open' : ''}`}>
      <button
        type="button"
        className="issues__head"
        onClick={onToggle}
        aria-expanded={open}
        disabled={issues.length === 0}
      >
        <span className="issues__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span>Validation</span>
        {errors.length > 0 && (
          <span className="pill pill--error">
            {errors.length} erreur{errors.length > 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="pill pill--warning">
            {warnings.length} avertissement{warnings.length > 1 ? 's' : ''}
          </span>
        )}
        {issues.length === 0 && <span className="pill pill--ok">Rien à signaler</span>}
        <span className="app__spacer" />
        {issues.length > 0 && (
          <span className="field__hint" style={{ margin: 0 }}>
            {open ? 'replier' : 'déplier'}
          </span>
        )}
      </button>

      {open && (
        <div className="issues__list">
          {[...errors, ...warnings].map((issue, index) => (
            <button
              key={`${issue.code}-${issue.sceneId ?? ''}-${index}`}
              type="button"
              className="issue"
              onClick={() => issue.sceneId && onSelect(issue.sceneId)}
              disabled={!issue.sceneId}
            >
              <span className={`issue__dot issue__dot--${issue.severity}`} />
              <span>{issue.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

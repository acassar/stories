import type { SceneId, ValidationIssue } from '@embranche/story-format';

interface Props {
  issues: ValidationIssue[];
  onSelect: (sceneId: SceneId) => void;
}

/** Live validation: clicking an issue selects the offending scene. */
export function IssuesBar({ issues, onSelect }: Props) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return (
    <div className="issues">
      <div className="issues__head">
        <span>Validation</span>
        {errors.length > 0 && <span className="pill pill--error">{errors.length} erreur(s)</span>}
        {warnings.length > 0 && (
          <span className="pill pill--warning">{warnings.length} avertissement(s)</span>
        )}
        {issues.length === 0 && <span className="pill pill--ok">Rien à signaler</span>}
      </div>

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
  );
}

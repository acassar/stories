import { analyzeStory, isDeadWeight, isNeverWritten } from '@embranche/story-format';
import type { ItemUsage, SceneId, Story, VariableUsage } from '@embranche/story-format';

import { Overlay } from './Overlay';

interface Props {
  story: Story;
  onSelect: (sceneId: SceneId) => void;
  onClose: () => void;
}

const OP_LABELS: Record<string, string> = {
  set: 'pose',
  inc: 'ajoute à',
  dec: 'retire de',
  toggle: 'inverse',
  unset: 'efface',
  addItem: 'donne',
  removeItem: 'reprend',
};

/**
 * The variables of a story, as a table (STU-12).
 *
 * Conditions and effects are scattered across the links, which is right — a
 * consequence belongs to the path that causes it — but it leaves the author
 * without an answer to "who touches `prudent`, and does anyone still read it?".
 * This view is that answer, and every row leads back to the node it comes from.
 */
export function VariablesPanel({ story, onSelect, onClose }: Props) {
  const usage = analyzeStory(story);
  const empty = usage.variables.length === 0 && usage.items.length === 0;

  return (
    <Overlay label="Variables du récit" onClose={onClose}>
      <div className="sheet">
        <div className="sheet__head">
          <div>
            <div className="dash__title">Variables et objets</div>
            <div className="dash__subtitle">
              Ce que « {story.title} » écrit, ce qu’elle relit, et ce qui ne sert plus.
            </div>
          </div>
          <div className="app__spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="sheet__body">
          {empty && (
            <div className="empty">
              Ce récit n’utilise ni variable ni objet. Les conditions et les effets s’ajoutent sur
              les liens, depuis le panneau d’édition.
            </div>
          )}

          {usage.variables.length > 0 && (
            <UsageTable
              caption="Variables"
              rows={usage.variables}
              initialOf={(row) => (row.declared ? String(row.initial) : '—')}
              onSelect={onSelect}
            />
          )}

          {usage.items.length > 0 && (
            <UsageTable
              caption="Objets"
              rows={usage.items}
              initialOf={(row) => (row.declared ? `× ${String(row.initial)}` : '—')}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------

interface TableProps<T extends VariableUsage | ItemUsage> {
  caption: string;
  rows: T[];
  initialOf: (row: T) => string;
  onSelect: (sceneId: SceneId) => void;
}

function UsageTable<T extends VariableUsage | ItemUsage>({
  caption,
  rows,
  initialOf,
  onSelect,
}: TableProps<T>) {
  return (
    <section className="usage">
      <h2 className="usage__caption">{caption}</h2>
      <div className="usage__row usage__row--head">
        <div>Nom</div>
        <div>Départ</div>
        <div>Écrite par</div>
        <div>Lue par</div>
      </div>

      {rows.map((row) => (
        <div className="usage__row" key={row.name}>
          <div className="usage__name">
            <code>{row.name}</code>
            {isDeadWeight(row) && (
              <span className="pill pill--warning" title="Aucune condition ne la lit">
                jamais lue
              </span>
            )}
            {isNeverWritten(row) && (
              <span className="pill pill--warning" title="Aucun effet ne l’écrit">
                jamais écrite
              </span>
            )}
          </div>
          <div className="usage__initial">{initialOf(row)}</div>
          <div className="usage__sites">
            {row.writes.length === 0 && <span className="field__hint">—</span>}
            {row.writes.map((site, index) => (
              <button
                key={`${site.sceneId}-${site.linkId}-${index}`}
                type="button"
                className="usage__site"
                onClick={() => onSelect(site.sceneId)}
                title={`Ouvrir « ${site.sceneTitle} »`}
              >
                {site.sceneTitle}
                <span className="usage__op">{OP_LABELS[site.op] ?? site.op}</span>
              </button>
            ))}
          </div>
          <div className="usage__sites">
            {row.reads.length === 0 && <span className="field__hint">—</span>}
            {row.reads.map((site, index) => (
              <button
                key={`${site.sceneId}-${site.linkId}-${index}`}
                type="button"
                className="usage__site"
                onClick={() => onSelect(site.sceneId)}
                title={`Ouvrir « ${site.sceneTitle} »`}
              >
                {site.sceneTitle}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

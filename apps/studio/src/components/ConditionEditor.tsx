import { useMemo } from 'react';

import { conditionSchema } from '@embranche/story-format';
import type { Condition, SceneId } from '@embranche/story-format';

import {
  CONDITION_OPERATORS,
  defaultLeaf,
  flattenCondition,
  formatVariableValue,
  parseVariableValue,
  unflattenCondition,
} from '../lib/values';
import type { LeafCondition } from '../lib/values';

interface Props {
  value: Condition | undefined;
  onChange: (condition: Condition | undefined) => void;
  /** Variables already mentioned by the story — offered as autocompletion. */
  knownVariables: string[];
  sceneIds: SceneId[];
}

/**
 * Editor for a display condition.
 *
 * The common case ("a list of tests joined by AND or OR") is edited line by
 * line. Richer shapes, imported from hand-written JSON, fall back to a JSON
 * field validated by the schema: an austere field beats a rewrite that would
 * lose information.
 */
export function ConditionEditor({ value, onChange, knownVariables, sceneIds }: Props) {
  const flat = useMemo(() => (value ? flattenCondition(value) : null), [value]);

  if (!value) {
    return (
      <button
        type="button"
        className="btn btn--small"
        onClick={() => onChange(defaultLeaf(knownVariables[0]))}
      >
        ＋ Condition d’affichage
      </button>
    );
  }

  if (!flat) {
    return <RawConditionEditor value={value} onChange={onChange} />;
  }

  const setLeaf = (index: number, leaf: LeafCondition) => {
    const leaves = flat.leaves.map((current, i) => (i === index ? leaf : current));
    onChange(unflattenCondition({ ...flat, leaves }));
  };

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="inline">
        <span className="field__hint">Visible si</span>
        {flat.leaves.length > 1 && (
          <select
            className="select"
            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
            value={flat.join}
            onChange={(event) =>
              onChange(unflattenCondition({ ...flat, join: event.target.value as 'and' | 'or' }))
            }
            aria-label="Joindre les tests par"
          >
            <option value="and">tous les tests</option>
            <option value="or">au moins un test</option>
          </select>
        )}
        <span className="app__spacer" />
        <button
          type="button"
          className="btn btn--small"
          onClick={() =>
            onChange(
              unflattenCondition({
                ...flat,
                leaves: [...flat.leaves, defaultLeaf(knownVariables[0])],
              }),
            )
          }
        >
          ＋
        </button>
        <button type="button" className="btn btn--small" onClick={() => onChange(undefined)}>
          Retirer
        </button>
      </div>

      {flat.leaves.map((leaf, index) => (
        <LeafRow
          // The index is the key: rows have no identity of their own, and order
          // is the only stable landmark for the author.
          key={index}
          leaf={leaf}
          knownVariables={knownVariables}
          sceneIds={sceneIds}
          onChange={(next) => setLeaf(index, next)}
          onRemove={() =>
            onChange(
              unflattenCondition({
                ...flat,
                leaves: flat.leaves.filter((_, i) => i !== index),
              }),
            )
          }
        />
      ))}
    </div>
  );
}

interface LeafProps {
  leaf: LeafCondition;
  knownVariables: string[];
  sceneIds: SceneId[];
  onChange: (leaf: LeafCondition) => void;
  onRemove: () => void;
}

function LeafRow({ leaf, knownVariables, sceneIds, onChange, onRemove }: LeafProps) {
  const changeOperator = (op: LeafCondition['op']) => {
    switch (op) {
      case 'always':
        onChange({ op });
        return;
      case 'hasItem':
      case 'lacksItem':
        onChange({ op, item: 'item' in leaf ? leaf.item : 'objet' });
        return;
      case 'visited':
      case 'notVisited':
        onChange({ op, scene: 'scene' in leaf ? leaf.scene : (sceneIds[0] ?? '') });
        return;
      default:
        onChange({
          op,
          variable: 'variable' in leaf ? leaf.variable : (knownVariables[0] ?? 'variable'),
          value: 'value' in leaf ? leaf.value : true,
        });
    }
  };

  return (
    <div className="card">
      <div className="card__head">
        <select
          className="select"
          style={{ flex: '1 1 auto', padding: '7px 9px', fontSize: 12 }}
          value={leaf.op}
          onChange={(event) => changeOperator(event.target.value as LeafCondition['op'])}
          aria-label="Type de test"
        >
          {CONDITION_OPERATORS.map((operator) => (
            <option key={operator.value} value={operator.value}>
              {operator.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--icon btn--danger"
          onClick={onRemove}
          aria-label="Retirer ce test"
        >
          ✕
        </button>
      </div>

      {'variable' in leaf && (
        <div className="inline" style={{ marginTop: 8 }}>
          <input
            className="input"
            style={{ padding: '7px 9px', fontSize: 12 }}
            value={leaf.variable}
            list="emb-known-variables"
            onChange={(event) => onChange({ ...leaf, variable: event.target.value })}
            aria-label="Variable"
          />
          <input
            className="input"
            style={{ padding: '7px 9px', fontSize: 12 }}
            value={formatVariableValue(leaf.value)}
            onChange={(event) =>
              onChange({ ...leaf, value: parseVariableValue(event.target.value) })
            }
            aria-label="Valeur comparée"
          />
        </div>
      )}

      {'item' in leaf && (
        <div className="inline" style={{ marginTop: 8 }}>
          <input
            className="input"
            style={{ padding: '7px 9px', fontSize: 12 }}
            value={leaf.item}
            onChange={(event) => onChange({ ...leaf, item: event.target.value })}
            aria-label="Objet"
          />
          <input
            className="input"
            style={{ padding: '7px 9px', fontSize: 12, width: 76 }}
            type="number"
            min={1}
            value={leaf.quantity ?? 1}
            onChange={(event) =>
              onChange({ ...leaf, quantity: Math.max(1, Number(event.target.value) || 1) })
            }
            aria-label="Quantité"
          />
        </div>
      )}

      {'scene' in leaf && (
        <select
          className="select"
          style={{ marginTop: 8, padding: '7px 9px', fontSize: 12 }}
          value={leaf.scene}
          onChange={(event) => onChange({ ...leaf, scene: event.target.value })}
          aria-label="Scène"
        >
          {sceneIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}

      {knownVariables.length > 0 && (
        <datalist id="emb-known-variables">
          {knownVariables.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** Fallback for nested conditions: raw JSON, validated by the schema. */
function RawConditionEditor({
  value,
  onChange,
}: {
  value: Condition;
  onChange: (condition: Condition | undefined) => void;
}) {
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="field__hint">
        Condition imbriquée — éditée en JSON pour ne rien perdre à la traduction.
      </div>
      <textarea
        className="textarea input--mono"
        defaultValue={JSON.stringify(value, null, 2)}
        onBlur={(event) => {
          try {
            const parsed = conditionSchema.safeParse(JSON.parse(event.target.value));
            if (parsed.success) onChange(parsed.data);
          } catch {
            // Transiently invalid input: the last good value is kept.
          }
        }}
        aria-label="Condition (JSON)"
      />
      <button type="button" className="btn btn--small" onClick={() => onChange(undefined)}>
        Retirer la condition
      </button>
    </div>
  );
}

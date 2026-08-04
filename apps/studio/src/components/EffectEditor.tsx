import type { Effect } from '@embranche/story-format';

import { EFFECT_OPERATORS, formatVariableValue, parseVariableValue } from '../lib/values';

interface Props {
  value: Effect[] | undefined;
  onChange: (effects: Effect[] | undefined) => void;
  knownVariables: string[];
}

/**
 * Editeur des effets d'un choix. Le vocabulaire est ferme (voir `story-format`)
 * donc une liste de lignes suffit : pas de repli JSON necessaire ici.
 */
export function EffectEditor({ value, onChange, knownVariables }: Props) {
  const effects = value ?? [];

  const update = (next: Effect[]) => onChange(next.length > 0 ? next : undefined);

  const setAt = (index: number, effect: Effect) =>
    update(effects.map((current, i) => (i === index ? effect : current)));

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="inline">
        <span className="field__hint">Effets ({effects.length})</span>
        <span className="app__spacer" />
        <button
          type="button"
          className="btn btn--small"
          onClick={() =>
            update([
              ...effects,
              { op: 'set', variable: knownVariables[0] ?? 'variable', value: true },
            ])
          }
        >
          ＋ Effet
        </button>
      </div>

      {effects.map((effect, index) => (
        <div className="card" key={index}>
          <div className="card__head">
            <select
              className="select"
              style={{ flex: '1 1 auto', padding: '7px 9px', fontSize: 12 }}
              value={effect.op}
              onChange={(event) =>
                setAt(
                  index,
                  migrateEffect(effect, event.target.value as Effect['op'], knownVariables),
                )
              }
              aria-label="Type d’effet"
            >
              {EFFECT_OPERATORS.map((operator) => (
                <option key={operator.value} value={operator.value}>
                  {operator.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--icon btn--danger"
              onClick={() => update(effects.filter((_, i) => i !== index))}
              aria-label="Retirer cet effet"
            >
              ✕
            </button>
          </div>

          <div className="inline" style={{ marginTop: 8 }}>
            {'variable' in effect && (
              <input
                className="input"
                style={{ padding: '7px 9px', fontSize: 12 }}
                value={effect.variable}
                list="emb-known-variables"
                onChange={(event) => setAt(index, { ...effect, variable: event.target.value })}
                aria-label="Variable"
              />
            )}
            {'item' in effect && (
              <input
                className="input"
                style={{ padding: '7px 9px', fontSize: 12 }}
                value={effect.item}
                onChange={(event) => setAt(index, { ...effect, item: event.target.value })}
                aria-label="Objet"
              />
            )}
            {effect.op === 'set' && (
              <input
                className="input"
                style={{ padding: '7px 9px', fontSize: 12 }}
                value={formatVariableValue(effect.value)}
                onChange={(event) =>
                  setAt(index, { ...effect, value: parseVariableValue(event.target.value) })
                }
                aria-label="Valeur"
              />
            )}
            {(effect.op === 'inc' || effect.op === 'dec') && (
              <input
                className="input"
                style={{ padding: '7px 9px', fontSize: 12, width: 90 }}
                type="number"
                value={effect.value}
                onChange={(event) =>
                  setAt(index, { ...effect, value: Number(event.target.value) || 0 })
                }
                aria-label="Quantité"
              />
            )}
            {(effect.op === 'addItem' || effect.op === 'removeItem') && (
              <input
                className="input"
                style={{ padding: '7px 9px', fontSize: 12, width: 90 }}
                type="number"
                min={1}
                value={effect.quantity ?? 1}
                onChange={(event) =>
                  setAt(index, {
                    ...effect,
                    quantity: Math.max(1, Number(event.target.value) || 1),
                  })
                }
                aria-label="Quantité"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Change l'operateur en conservant ce qui a du sens dans la nouvelle forme. */
function migrateEffect(effect: Effect, op: Effect['op'], knownVariables: string[]): Effect {
  const variable = 'variable' in effect ? effect.variable : (knownVariables[0] ?? 'variable');
  const item = 'item' in effect ? effect.item : 'objet';
  switch (op) {
    case 'set':
      return { op, variable, value: 'value' in effect ? effect.value : true };
    case 'inc':
    case 'dec':
      return {
        op,
        variable,
        value:
          typeof effect === 'object' && 'value' in effect && typeof effect.value === 'number'
            ? effect.value
            : 1,
      };
    case 'toggle':
    case 'unset':
      return { op, variable };
    case 'addItem':
    case 'removeItem':
      return { op, item, quantity: 'quantity' in effect ? effect.quantity : 1 };
  }
}

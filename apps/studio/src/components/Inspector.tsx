import { useState } from 'react';

import { STORY_THEMES, themeLabels } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { collectStoryVariables } from '@embranche/story-format';
import type { Scene, SceneId, Story, ValidationIssue } from '@embranche/story-format';

import {
  addChoice,
  duplicateScene,
  removeChoice,
  removeScene,
  setStartScene,
  toggleEnding,
  updateChoice,
  updateScene,
  updateStory,
} from '../lib/storyDoc';
import { ConditionEditor } from './ConditionEditor';
import { EffectEditor } from './EffectEditor';

interface Props {
  story: Story;
  selectedId: SceneId | null;
  issues: ValidationIssue[];
  onChange: (story: Story) => void;
  onSelect: (sceneId: SceneId | null) => void;
}

/** Panneau d'edition : la scene selectionnee, ou les metadonnees du recit. */
export function Inspector({ story, selectedId, issues, onChange, onSelect }: Props) {
  const [tab, setTab] = useState<'scene' | 'story'>('scene');
  const scene = selectedId ? story.scenes[selectedId] : undefined;
  const activeTab = scene ? tab : 'story';

  return (
    <aside className="inspector" aria-label="Panneau d’édition">
      <div className="inline" style={{ marginBottom: 4 }}>
        <button
          type="button"
          className={`btn btn--small${activeTab === 'scene' ? ' btn--success' : ''}`}
          onClick={() => setTab('scene')}
          disabled={!scene}
        >
          Scène
        </button>
        <button
          type="button"
          className={`btn btn--small${activeTab === 'story' ? ' btn--success' : ''}`}
          onClick={() => setTab('story')}
        >
          Récit
        </button>
      </div>

      {activeTab === 'story' ? (
        <StoryPanel story={story} onChange={onChange} />
      ) : scene ? (
        <ScenePanel
          story={story}
          scene={scene}
          issues={issues.filter((issue) => issue.sceneId === scene.id)}
          onChange={onChange}
          onSelect={onSelect}
        />
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------

function StoryPanel({ story, onChange }: { story: Story; onChange: (story: Story) => void }) {
  const set = (patch: Partial<Story>) => onChange(updateStory(story, patch));

  return (
    <>
      <div className="inspector__label">Le récit</div>

      <label className="field">
        <span className="field__label">Titre</span>
        <input
          className="input"
          value={story.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Auteur</span>
        <input
          className="input"
          value={story.author ?? ''}
          onChange={(event) => set({ author: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Accroche</span>
        <textarea
          className="textarea"
          rows={3}
          value={story.blurb ?? ''}
          onChange={(event) => set({ blurb: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Genre affiché</span>
        <input
          className="input"
          value={story.tag ?? ''}
          placeholder="Fantastique, Enquête…"
          onChange={(event) => set({ tag: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Teinte de reliure</span>
        <select
          className="select"
          value={story.theme ?? 'night'}
          onChange={(event) => set({ theme: event.target.value as StoryTheme })}
        >
          {STORY_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {themeLabels[theme]}
            </option>
          ))}
        </select>
      </label>

      <div className="inline" style={{ marginTop: 14 }}>
        <label style={{ flex: 1 }}>
          <span className="field__label">Durée (min)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={story.estimatedMinutes ?? 0}
            onChange={(event) => set({ estimatedMinutes: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span className="field__label">Version</span>
          <input
            className="input"
            value={story.version}
            onChange={(event) => set({ version: event.target.value })}
          />
        </label>
      </div>

      <div className="inline" style={{ marginTop: 14 }}>
        <label style={{ flex: 1 }}>
          <span className="field__label">Interlocuteur</span>
          <input
            className="input"
            value={story.narrator?.name ?? ''}
            placeholder="Elara"
            onChange={(event) =>
              set({ narrator: { ...story.narrator, name: event.target.value } })
            }
          />
        </label>
        <label style={{ flex: 1 }}>
          <span className="field__label">Statut affiché</span>
          <input
            className="input"
            value={story.narrator?.status ?? ''}
            placeholder="en ligne"
            onChange={(event) =>
              set({
                narrator: { name: story.narrator?.name ?? '', status: event.target.value },
              })
            }
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Publication</span>
        <select
          className="select"
          value={story.status ?? 'draft'}
          onChange={(event) => set({ status: event.target.value as Story['status'] })}
        >
          <option value="draft">Brouillon</option>
          <option value="published">Publiée</option>
        </select>
      </label>

      <div className="field__hint" style={{ marginTop: 16 }}>
        Scène de départ : <strong>{story.scenes[story.startSceneId]?.title ?? '—'}</strong>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

interface ScenePanelProps {
  story: Story;
  scene: Scene;
  issues: ValidationIssue[];
  onChange: (story: Story) => void;
  onSelect: (sceneId: SceneId | null) => void;
}

function ScenePanel({ story, scene, issues, onChange, onSelect }: ScenePanelProps) {
  const knownVariables = [...collectStoryVariables(story)].sort();
  const sceneIds = Object.keys(story.scenes);
  const isStart = story.startSceneId === scene.id;

  const set = (patch: Partial<Scene>) => onChange(updateScene(story, scene.id, patch));

  return (
    <>
      <div className="inline">
        <span className="inspector__label">Scène sélectionnée</span>
        <span className="app__spacer" />
        {isStart && <span className="pill pill--ok">Départ</span>}
      </div>

      <label className="field">
        <span className="field__label">Titre</span>
        <input
          className="input"
          value={scene.title}
          onChange={(event) => set({ title: event.target.value })}
        />
        <span className="field__hint">Identifiant : {scene.id}</span>
      </label>

      <div className="field">
        <div className="inline">
          <span className="field__label" style={{ margin: 0 }}>
            Texte de la scène
          </span>
          <span className="app__spacer" />
          <button
            type="button"
            className="btn btn--small"
            onClick={() => set({ blocks: [...scene.blocks, { text: '' }] })}
          >
            ＋ Message
          </button>
        </div>
        <div className="stack" style={{ marginTop: 8 }}>
          {scene.blocks.map((block, index) => (
            <div className="card" key={index}>
              <textarea
                className="textarea"
                rows={2}
                value={block.text}
                placeholder="Ce qui arrive au joueur, en un message."
                onChange={(event) =>
                  set({
                    blocks: scene.blocks.map((current, i) =>
                      i === index ? { ...current, text: event.target.value } : current,
                    ),
                  })
                }
                aria-label={`Message ${index + 1}`}
              />
              <div className="inline" style={{ marginTop: 6 }}>
                <select
                  className="select"
                  style={{ padding: '5px 8px', fontSize: 12, width: 'auto' }}
                  value={block.speaker ?? 'narrator'}
                  onChange={(event) =>
                    set({
                      blocks: scene.blocks.map((current, i) =>
                        i === index
                          ? { ...current, speaker: event.target.value as 'narrator' | 'player' }
                          : current,
                      ),
                    })
                  }
                  aria-label="Qui parle"
                >
                  <option value="narrator">Interlocuteur</option>
                  <option value="player">Joueur</option>
                </select>
                <span className="app__spacer" />
                <button
                  type="button"
                  className="btn btn--icon btn--danger"
                  onClick={() => set({ blocks: scene.blocks.filter((_, i) => i !== index) })}
                  aria-label={`Supprimer le message ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {scene.blocks.length === 0 && (
            <div className="field__hint">Aucun texte : la scène s’affichera vide.</div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`btn toggle${scene.ending ? ' toggle--on' : ''}`}
        onClick={() => onChange(toggleEnding(story, scene.id))}
      >
        {scene.ending ? '✓ Scène de fin' : 'Marquer comme fin'}
      </button>

      {scene.ending && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label>
            <span className="field__label">Catégorie de fin</span>
            <input
              className="input"
              value={scene.ending.type}
              placeholder="Fin lumineuse"
              onChange={(event) =>
                set({ ending: { ...scene.ending!, type: event.target.value } })
              }
            />
          </label>
          <label>
            <span className="field__label">Nom de la fin</span>
            <input
              className="input"
              value={scene.ending.name}
              onChange={(event) =>
                set({ ending: { ...scene.ending!, name: event.target.value } })
              }
            />
          </label>
          <label>
            <span className="field__label">Phrase de clôture</span>
            <textarea
              className="textarea"
              rows={2}
              value={scene.ending.blurb}
              onChange={(event) =>
                set({ ending: { ...scene.ending!, blurb: event.target.value } })
              }
            />
          </label>
        </div>
      )}

      {!scene.ending && (
        <>
          <div className="row-between">
            <span className="field__label" style={{ margin: 0 }}>
              Choix ({scene.choices.length})
            </span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => onChange(addChoice(story, scene.id))}
            >
              ＋ Ajouter
            </button>
          </div>

          <div className="stack">
            {scene.choices.map((choice) => (
              <div className="card" key={choice.id}>
                <input
                  className="input"
                  style={{ border: 'none', borderBottom: '1.5px solid #eee3d2', borderRadius: 0, padding: '3px 0 7px', fontFamily: 'var(--emb-font-prose)' }}
                  value={choice.label}
                  onChange={(event) =>
                    onChange(updateChoice(story, scene.id, choice.id, { label: event.target.value }))
                  }
                  aria-label="Libellé du choix"
                />
                <div className="inline" style={{ marginTop: 8 }}>
                  <span className="field__hint" style={{ flex: 'none', margin: 0 }}>
                    ↳ vers
                  </span>
                  <select
                    className="select"
                    style={{ flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 12 }}
                    value={choice.target}
                    onChange={(event) =>
                      onChange(
                        updateChoice(story, scene.id, choice.id, { target: event.target.value }),
                      )
                    }
                    aria-label="Scène cible"
                  >
                    {sceneIds.map((id) => (
                      <option key={id} value={id}>
                        {story.scenes[id]?.title || id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--icon btn--danger"
                    onClick={() => onChange(removeChoice(story, scene.id, choice.id))}
                    aria-label={`Supprimer le choix ${choice.label}`}
                  >
                    ✕
                  </button>
                </div>

                <ConditionEditor
                  value={choice.condition}
                  knownVariables={knownVariables}
                  sceneIds={sceneIds}
                  onChange={(condition) =>
                    onChange(updateChoice(story, scene.id, choice.id, { condition }))
                  }
                />
                <EffectEditor
                  value={choice.effects}
                  knownVariables={knownVariables}
                  onChange={(effects) =>
                    onChange(updateChoice(story, scene.id, choice.id, { effects }))
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}

      {issues.length > 0 && (
        <div className="stack" style={{ marginTop: 18 }}>
          {issues.map((issue, index) => (
            <div key={index} className={`pill pill--${issue.severity}`}>
              {issue.message}
            </div>
          ))}
        </div>
      )}

      <div className="stack" style={{ marginTop: 22 }}>
        <button
          type="button"
          className="btn"
          disabled={isStart}
          onClick={() => onChange(setStartScene(story, scene.id))}
        >
          Marquer comme scène de départ
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const result = duplicateScene(story, scene.id);
            onChange(result.story);
            onSelect(result.sceneId);
          }}
        >
          Dupliquer cette scène
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            onChange(removeScene(story, scene.id));
            onSelect(null);
          }}
        >
          Supprimer cette scène
        </button>
      </div>
    </>
  );
}

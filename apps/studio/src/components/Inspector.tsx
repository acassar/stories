import { useState } from 'react';

import { STORY_THEMES, kinds, themeLabels } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { collectStoryVariables } from '@embranche/story-format';
import type { Scene, SceneId, SceneKind, Story, ValidationIssue } from '@embranche/story-format';

import {
  addLink,
  duplicateScene,
  removeLink,
  removeScene,
  setKind,
  setStartScene,
  soleIncomingLink,
  toggleEnding,
  updateLink,
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

/** Editing panel: the selected scene, or the story metadata. */
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
            onChange={(event) =>
              set({ estimatedMinutes: Math.max(0, Number(event.target.value) || 0) })
            }
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
            onChange={(event) => set({ narrator: { ...story.narrator, name: event.target.value } })}
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
  const palette = kinds[scene.kind];

  const set = (patch: Partial<Scene>) => onChange(updateScene(story, scene.id, patch));

  return (
    <>
      <div className="inline">
        <span className="inspector__label">Nœud sélectionné</span>
        <span className="app__spacer" />
        {isStart && <span className="pill pill--ok">Départ</span>}
      </div>

      {/*
        The kind comes first: it drives everything else in the panel, from the
        label to the reading behavior.
      */}
      <div className="field">
        <span className="field__label">Type de nœud</span>
        <div className="kind-picker">
          {(['npc', 'player', 'choice'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`kind-picker__option${scene.kind === kind ? ' kind-picker__option--on' : ''}`}
              style={
                scene.kind === kind
                  ? {
                      background: kinds[kind].surface,
                      borderColor: kinds[kind].border,
                      color: kinds[kind].ink,
                    }
                  : undefined
              }
              onClick={() => onChange(setKind(story, scene.id, kind))}
            >
              {kinds[kind].label}
            </button>
          ))}
        </div>
        <span className="field__hint">{kindHelp[scene.kind]}</span>
      </div>

      {scene.kind === 'choice' && (
        <label className="field">
          <span className="field__label">Libellé du bouton</span>
          <input
            className="input"
            value={scene.label ?? ''}
            placeholder="Mentir"
            onChange={(event) => set({ label: event.target.value })}
          />
          <span className="field__hint">
            Ce que le joueur lit sur le bouton. Le message envoyé, lui, s’écrit ci-dessous —
            laisse-le vide pour envoyer le libellé tel quel.
          </span>
        </label>
      )}

      <label className="field">
        <span className="field__label">Titre de travail</span>
        <input
          className="input"
          value={scene.title}
          onChange={(event) => set({ title: event.target.value })}
        />
        <span className="field__hint">Identifiant : {scene.id}</span>
      </label>

      {scene.kind === 'choice' && (
        <IncomingLinkPanel
          story={story}
          scene={scene}
          knownVariables={knownVariables}
          sceneIds={sceneIds}
          onChange={onChange}
        />
      )}

      <div className="field" style={{ borderTop: `2px solid ${palette.border}`, paddingTop: 12 }}>
        <div className="inline">
          <span className="field__label" style={{ margin: 0 }}>
            {scene.kind === 'npc' ? 'Messages envoyés' : 'Ce que dit le joueur'}
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
                placeholder={
                  scene.kind === 'npc'
                    ? 'Ce qui arrive au joueur, en un message.'
                    : 'Ce que le joueur envoie, en un message.'
                }
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
            <div className="field__hint">
              {scene.kind === 'choice'
                ? 'Sans message, c’est le libellé du bouton qui part dans la conversation.'
                : 'Aucun texte : le nœud passera sans rien afficher.'}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`btn toggle${scene.ending ? ' toggle--on' : ''}`}
        onClick={() => onChange(toggleEnding(story, scene.id))}
      >
        {scene.ending ? '✓ Nœud de fin' : 'Marquer comme fin'}
      </button>

      {scene.ending && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label>
            <span className="field__label">Catégorie de fin</span>
            <input
              className="input"
              value={scene.ending.type}
              placeholder="Fin lumineuse"
              onChange={(event) => set({ ending: { ...scene.ending!, type: event.target.value } })}
            />
          </label>
          <label>
            <span className="field__label">Nom de la fin</span>
            <input
              className="input"
              value={scene.ending.name}
              onChange={(event) => set({ ending: { ...scene.ending!, name: event.target.value } })}
            />
          </label>
          <label>
            <span className="field__label">Phrase de clôture</span>
            <textarea
              className="textarea"
              rows={2}
              value={scene.ending.blurb}
              onChange={(event) => set({ ending: { ...scene.ending!, blurb: event.target.value } })}
            />
          </label>
        </div>
      )}

      {!scene.ending && (
        <>
          <div className="row-between">
            <span className="field__label" style={{ margin: 0 }}>
              Suites ({scene.next.length})
            </span>
            <select
              className="select"
              style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
              value=""
              onChange={(event) => {
                if (event.target.value) onChange(addLink(story, scene.id, event.target.value));
              }}
              aria-label="Relier à un nœud existant"
            >
              <option value="">＋ Relier à…</option>
              {sceneIds
                .filter((id) => !scene.next.some((link) => link.to === id))
                .map((id) => (
                  <option key={id} value={id}>
                    {kinds[story.scenes[id]!.kind].label} · {nodeName(story, id)}
                  </option>
                ))}
            </select>
          </div>

          <div className="field__hint" style={{ marginTop: -4 }}>
            {describeFlow(story, scene)}
          </div>

          <div className="stack">
            {scene.next.map((link) => {
              const target = story.scenes[link.to];
              return (
                <div className="card" key={link.id}>
                  <div className="inline">
                    <span className="field__hint" style={{ flex: 'none', margin: 0 }}>
                      ↳ vers
                    </span>
                    <select
                      className="select"
                      style={{ flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 12 }}
                      value={link.to}
                      onChange={(event) =>
                        onChange(updateLink(story, scene.id, link.id, { to: event.target.value }))
                      }
                      aria-label="Nœud cible"
                    >
                      {sceneIds.map((id) => (
                        <option key={id} value={id}>
                          {kinds[story.scenes[id]!.kind].label} · {nodeName(story, id)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn--icon btn--danger"
                      onClick={() => onChange(removeLink(story, scene.id, link.id))}
                      aria-label={`Supprimer le lien vers ${nodeName(story, link.to)}`}
                    >
                      ✕
                    </button>
                  </div>

                  {target && (
                    <button
                      type="button"
                      className="btn btn--small"
                      style={{ marginTop: 6 }}
                      onClick={() => onSelect(target.id)}
                    >
                      Ouvrir « {nodeName(story, target.id)} »
                    </button>
                  )}

                  {/*
                    On a link to a choice, condition and effects can also be
                    edited from the choice node itself — it is the same object,
                    seen from both ends.
                  */}
                  <ConditionEditor
                    value={link.condition}
                    knownVariables={knownVariables}
                    sceneIds={sceneIds}
                    onChange={(condition) =>
                      onChange(updateLink(story, scene.id, link.id, { condition }))
                    }
                  />
                  <EffectEditor
                    value={link.effects}
                    knownVariables={knownVariables}
                    onChange={(effects) =>
                      onChange(updateLink(story, scene.id, link.id, { effects }))
                    }
                  />
                </div>
              );
            })}
            {scene.next.length === 0 && (
              <div className="field__hint">
                Aucune suite. Tire une arête depuis le nœud, ou relie-le ci-dessus à un nœud
                existant.
              </div>
            )}
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
          Supprimer ce nœud
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

const kindHelp: Record<SceneKind, string> = {
  npc: 'L’interlocuteur parle. La lecture enchaîne toute seule vers la suite.',
  player: 'Le joueur parle, sans rien décider. La lecture enchaîne toute seule.',
  choice: 'Le joueur décide. C’est le seul type de nœud qui arrête la lecture.',
};

function nodeName(story: Story, id: SceneId): string {
  const scene = story.scenes[id];
  if (!scene) return id;
  return (scene.kind === 'choice' ? scene.label || scene.title : scene.title) || id;
}

/** States in plain words what the format infers from the kind of the targets. */
function describeFlow(story: Story, scene: Scene): string {
  const targets = scene.next
    .map((link) => story.scenes[link.to])
    .filter((target): target is Scene => Boolean(target));
  if (targets.length === 0) return 'Le récit s’arrête ici.';
  if (targets.some((target) => target.kind === 'choice')) {
    return `Le joueur choisit entre ${targets.length} réponse(s).`;
  }
  return targets.length > 1
    ? 'Enchaînement automatique : le premier lien dont la condition est remplie l’emporte.'
    : 'Enchaînement automatique : la suite arrive sans que le joueur agisse.';
}

/**
 * Condition and effects of the link that *leads* to this choice.
 *
 * They live on the edge — it is the path taken that has consequences, not the
 * node reached, which several routes may lead to. But for the author, "this
 * button only appears if..." is a property of the button, so they are shown
 * here, on the node, as long as there is a single incoming link.
 */
function IncomingLinkPanel({
  story,
  scene,
  knownVariables,
  sceneIds,
  onChange,
}: {
  story: Story;
  scene: Scene;
  knownVariables: string[];
  sceneIds: SceneId[];
  onChange: (story: Story) => void;
}) {
  const incoming = soleIncomingLink(story, scene.id);
  if (!incoming) {
    return (
      <div className="field__hint">
        Ce choix est atteint par plusieurs chemins : ouvre le nœud de départ concerné pour régler sa
        condition et ses effets.
      </div>
    );
  }

  return (
    <div className="field">
      <span className="field__label">Quand ce bouton apparaît</span>
      <ConditionEditor
        value={incoming.link.condition}
        knownVariables={knownVariables}
        sceneIds={sceneIds}
        onChange={(condition) =>
          onChange(updateLink(story, incoming.sceneId, incoming.link.id, { condition }))
        }
      />
      <span className="field__label" style={{ marginTop: 10 }}>
        Ce que l’appuyer déclenche
      </span>
      <EffectEditor
        value={incoming.link.effects}
        knownVariables={knownVariables}
        onChange={(effects) =>
          onChange(updateLink(story, incoming.sceneId, incoming.link.id, { effects }))
        }
      />
    </div>
  );
}

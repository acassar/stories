import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { resolveShell, tokensToCssVars } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import { StoryEngine } from '@embranche/story-engine';
import { sceneMessages, speakerOf, validateStory } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

interface Props {
  story: Story;
  /** Scene de depart du test — permet de jouer a partir de la scene selectionnee. */
  fromSceneId?: string | null;
  onClose: () => void;
}

/**
 * Playtest integre : la meme histoire, le meme moteur que le lecteur, dans un
 * cadre de telephone. Aucune logique de recit ici — juste un affichage branche
 * sur `story-engine`.
 */
export function Playtest({ story, fromSceneId, onClose }: Props) {
  const [mode, setMode] = useState<ColorMode>('light');
  const blocking = useMemo(
    () => validateStory(story).issues.filter((issue) => issue.severity === 'error'),
    [story],
  );

  if (blocking.length > 0) {
    return (
      <Overlay onClose={onClose}>
        <div className="panel" style={{ maxWidth: 420, padding: 24, gap: 12 }}>
          <div className="inspector__label">Playtest impossible</div>
          <p className="section-help">
            Le récit comporte {blocking.length} erreur(s) bloquante(s). Corrige-les et relance.
          </p>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {blocking.slice(0, 4).map((issue, index) => (
              <li key={index} className="field__hint">
                {issue.message}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <PlaytestSession
        story={story}
        fromSceneId={fromSceneId ?? null}
        mode={mode}
        onToggleMode={() => setMode((current) => (current === 'light' ? 'dark' : 'light'))}
      />
      <aside className="drawer__aside">
        <h2>Playtest</h2>
        <p>
          Le moteur qui tourne ici est exactement celui du lecteur : mêmes conditions, mêmes effets,
          même historique. Les choix grisés sont ceux dont la condition n’est pas remplie.
        </p>
        <button type="button" className="btn" onClick={onClose}>
          Fermer le playtest
        </button>
      </aside>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Playtest"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

interface SessionProps {
  story: Story;
  fromSceneId: string | null;
  mode: ColorMode;
  onToggleMode: () => void;
}

function PlaytestSession({ story, fromSceneId, mode, onToggleMode }: SessionProps) {
  // Une session = un moteur. Changer d'histoire ou de point de depart en cree
  // un neuf, ce qui remet naturellement la partie a zero.
  const engine = useMemo(() => {
    const created = new StoryEngine(story);
    if (fromSceneId && story.scenes[fromSceneId]) {
      created.loadState({ ...created.state, currentSceneId: fromSceneId, visited: [fromSceneId] });
    }
    return created;
  }, [story, fromSceneId]);

  useEffect(() => () => engine.dispose(), [engine]);

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const { scene, state } = snapshot;

  // Le playtest n'a pas de mise en scene : les enchainements automatiques se
  // deroulent d'un trait jusqu'au prochain choix. La borne n'est qu'un garde-fou
  // — une boucle sans choix est une erreur bloquante, et le playtest refuse de
  // s'ouvrir sur un recit qui en contient.
  useEffect(() => {
    for (let steps = 0; steps < 200 && engine.advance(); steps += 1);
  }, [engine, snapshot]);
  const tokens = resolveShell((story.theme ?? 'night') as StoryTheme, mode);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [state]);

  const transcript = buildTranscript(story, state);

  return (
    <div className="phone">
      <div
        className="phone__screen"
        style={{ ...tokensToCssVars(tokens), background: tokens.bg, color: tokens.ink }}
      >
        <header
          className="inline"
          style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${tokens.line}`,
            flex: 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `italic 600 15px ${'var(--emb-font-prose)'}` }}>
              {story.narrator?.name ?? story.title}
            </div>
            <div style={{ font: `italic 400 11px ${'var(--emb-font-prose)'}`, color: tokens.sub }}>
              {scene.title}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            style={{ color: tokens.ink, borderColor: tokens.line }}
            onClick={onToggleMode}
            aria-label="Basculer jour / nuit"
          >
            {mode === 'light' ? '☀' : '☾'}
          </button>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            style={{ color: tokens.ink, borderColor: tokens.line }}
            onClick={() => engine.reset()}
            aria-label="Recommencer"
          >
            ⟲
          </button>
        </header>

        <div
          ref={scroller}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
          }}
        >
          {transcript.map((message, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.fromPlayer ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  background: message.fromPlayer ? tokens.accent : tokens.panel,
                  color: message.fromPlayer ? tokens.onAccent : tokens.ink,
                  border: `1px solid ${message.fromPlayer ? tokens.accent : tokens.line}`,
                  font: `${message.fromPlayer ? '400' : 'italic 400'} 15px/1.48 var(--emb-font-prose)`,
                  padding: '10px 13px',
                  borderRadius: message.fromPlayer ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                }}
              >
                {message.text}
              </div>
            </div>
          ))}

          {scene.isEnding && scene.ending && (
            <div
              style={{
                marginTop: 12,
                padding: '14px 16px',
                borderTop: `1px solid ${tokens.line}`,
                borderBottom: `1px solid ${tokens.line}`,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  font: '600 11px var(--emb-font-ui)',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: tokens.accent,
                }}
              >
                {scene.ending.type}
              </div>
              <div style={{ font: 'italic 600 22px var(--emb-font-prose)', marginTop: 6 }}>
                {scene.ending.name}
              </div>
              <div
                style={{ font: '400 14px/1.55 var(--emb-font-prose)', opacity: 0.85, marginTop: 8 }}
              >
                {scene.ending.blurb}
              </div>
            </div>
          )}
        </div>

        <footer
          style={{
            flex: 'none',
            padding: '10px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {scene.allChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={!choice.available}
              onClick={() => engine.choose(choice.id)}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '88%',
                textAlign: 'right',
                border: `1px solid ${tokens.accent}`,
                background: 'transparent',
                color: tokens.accent,
                font: 'italic 500 14px var(--emb-font-prose)',
                padding: '10px 15px',
                borderRadius: '14px 14px 3px 14px',
                cursor: choice.available ? 'pointer' : 'not-allowed',
                opacity: choice.available ? 1 : 0.38,
              }}
              title={choice.available ? undefined : 'Condition non remplie'}
            >
              {choice.label}
            </button>
          ))}

          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn--small"
              disabled={!snapshot.canGoBack}
              onClick={() => engine.goBack()}
            >
              ← Revenir
            </button>
            <span style={{ font: '400 11px var(--emb-font-ui)', color: tokens.sub }}>
              {state.history.length} choix · {Object.keys(state.variables).length} variables
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface TranscriptMessage {
  text: string;
  fromPlayer: boolean;
}

/**
 * Reconstitue la correspondance depuis l'historique : les messages de chaque
 * noeud traverse, puis ceux du noeud courant.
 *
 * Le type du noeud suffit a savoir de quel cote afficher la bulle — plus besoin
 * de conserver le libelle du choix dans l'historique, puisque le choix est
 * lui-meme un noeud traverse.
 */
function buildTranscript(story: Story, state: GameState): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  const push = (sceneId: string): void => {
    const scene = story.scenes[sceneId];
    if (!scene) return;
    const fromPlayer = speakerOf(scene) === 'player';
    for (const block of sceneMessages(scene)) messages.push({ text: block.text, fromPlayer });
  };

  for (const entry of state.history) push(entry.sceneId);
  push(state.currentSceneId);
  return messages;
}

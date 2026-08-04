import { useRef } from 'react';

import { accents, resolveTokens } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { GameState, Story } from '@embranche/story-format';

import { BrandMark, MoonIcon, SunIcon } from '../components/Icons';
import { countEndings } from '../lib/library';

interface Props {
  stories: Story[];
  /** Fins deja vues, par recit. */
  endings: Record<string, string[]>;
  /** Sauvegardes en cours, par recit. */
  saves: Record<string, GameState | null>;
  mode: ColorMode;
  onToggleMode: () => void;
  onOpen: (storyId: string) => void;
  onImport: (file: File) => void;
}

/** Ecran d'accueil : l'ex-libris du lecteur. */
export function Library({ stories, endings, saves, mode, onToggleMode, onOpen, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <header className="topbar">
        <span style={{ color: 'var(--emb-accent)', display: 'flex' }}>
          <BrandMark />
        </span>
        <span style={{ font: 'italic 600 18px var(--emb-font-prose)' }}>Embranche</span>
        <span style={{ flex: 1 }} />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileInput.current?.click()}
          aria-label="Ouvrir une histoire depuis un fichier"
        >
          ＋
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMode}
          aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
        >
          {mode === 'light' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <div className="scroll">
        <div className="library">
          <p className="library__eyebrow">Ex-libris,</p>
          <h1 className="library__title">Que vas-tu vivre&nbsp;?</h1>
          <hr className="rule" />

          <ul className="card-list">
            {stories.map((story) => {
              const theme = (story.theme ?? 'night') as StoryTheme;
              const tokens = resolveTokens(theme, mode);
              const total = countEndings(story);
              const seen = endings[story.id]?.length ?? 0;
              const save = saves[story.id];
              return (
                <li key={story.id}>
                  <button type="button" className="story-card" onClick={() => onOpen(story.id)}>
                    <span
                      className="story-card__cover"
                      style={{ background: accents[theme].grad }}
                      aria-hidden="true"
                    />
                    <span className="story-card__body">
                      <span className="story-card__tag" style={{ color: tokens.accent }}>
                        {story.tag ?? 'Récit'}
                      </span>
                      <span className="story-card__title">{story.title}</span>
                      <span className="story-card__author">{story.author ?? 'anonyme'}</span>
                      <span className="story-card__meta">
                        <strong style={{ color: tokens.accent }}>
                          {seen}/{total} fins
                        </strong>
                        <span aria-hidden="true">·</span>
                        <span>{Object.keys(story.scenes).length} scènes</span>
                        {save && <span className="resume-chip">En cours</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {stories.length === 0 && (
            <p className="library__eyebrow" style={{ marginTop: 24 }}>
              Aucune histoire. Ouvre un JSON exporté depuis le studio pour commencer.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

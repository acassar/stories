import { resolveTokens } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { GameState, Story } from '@embranche/story-format';

import { ImportButton } from '../components/ImportButton';
import { StoryCover } from '../components/StoryCover';
import { BrandMark, MoonIcon, SunIcon } from '../components/Icons';
import type { LayoutKind } from '../hooks/useLayoutKind';
import { countDecisions, countEndings, latestRun } from '../lib/library';

interface Props {
  stories: Story[];
  /** Endings already seen, per story. */
  endings: Record<string, string[]>;
  /** Runs in progress, per story. */
  saves: Record<string, GameState | null>;
  mode: ColorMode;
  layout: LayoutKind;
  onToggleMode: () => void;
  onOpen: (storyId: string) => void;
  onImport: (file: File) => void;
}

/** Home screen: the reader's bookplate. */
export function Library({
  stories,
  endings,
  saves,
  mode,
  layout,
  onToggleMode,
  onOpen,
  onImport,
}: Props) {
  const resume = latestRun(stories, saves);
  // Each card wears the colour of its own story, not that of the shell.
  const resumeTokens = resume
    ? resolveTokens((resume.story.theme ?? 'night') as StoryTheme, mode)
    : null;
  const resumeDecisions = resume ? countDecisions(resume.story, resume.state) : 0;

  return (
    <>
      {/* On a wide screen the rail already carries the brand and the two
          buttons: a second copy of them would be one navigation too many. */}
      {layout === 'mobile' && (
        <header className="topbar">
          <span style={{ color: 'var(--emb-accent)', display: 'flex' }}>
            <BrandMark />
          </span>
          <span style={{ font: 'italic 600 18px var(--emb-font-prose)' }}>Embranche</span>
          <span style={{ flex: 1 }} />
          <ImportButton onImport={onImport} />
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleMode}
            aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
          >
            {mode === 'light' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>
      )}

      <div className="scroll">
        <div className="library">
          <p className="library__eyebrow">Ex-libris,</p>
          <h1 className="library__title">Que vas-tu vivre&nbsp;?</h1>
          <hr className="rule" />

          {resume && (
            <button
              type="button"
              className="resume"
              onClick={() => onOpen(resume.story.id)}
              style={{
                borderColor: 'var(--emb-hard)',
                boxShadow: 'var(--emb-hard-shadow-sm)',
              }}
            >
              <StoryCover
                story={resume.story}
                mode={mode}
                iconSize={26}
                className="cover--resume"
              />
              <span className="resume__body">
                <span className="resume__label" style={{ color: resumeTokens?.accentText }}>
                  Reprendre la lecture
                </span>
                <span className="resume__title">{resume.story.title}</span>
                <span className="resume__meta">
                  {resumeDecisions} choix fait{resumeDecisions > 1 ? 's' : ''} ·{' '}
                  {endings[resume.story.id]?.length ?? 0}/{countEndings(resume.story)} fins
                </span>
              </span>
            </button>
          )}

          <ul className={layout === 'desktop' ? 'story-grid' : 'card-list'}>
            {stories.map((story) => {
              const theme = (story.theme ?? 'night') as StoryTheme;
              const tokens = resolveTokens(theme, mode);
              const total = countEndings(story);
              const seen = endings[story.id]?.length ?? 0;
              const save = saves[story.id];
              return (
                <li key={story.id}>
                  <button type="button" className="story-card" onClick={() => onOpen(story.id)}>
                    <StoryCover
                      story={story}
                      mode={mode}
                      iconSize={layout === 'desktop' ? 72 : 30}
                      className="story-card__cover"
                      tilt
                    />
                    <span className="story-card__body">
                      <span className="story-card__tag" style={{ color: tokens.accentText }}>
                        {story.tag ?? 'Récit'}
                      </span>
                      <span className="story-card__title">{story.title}</span>
                      <span className="story-card__author">{story.author ?? 'anonyme'}</span>
                      <span className="story-card__meta">
                        <strong style={{ color: tokens.accentText }}>
                          {seen}/{total} fins
                        </strong>
                        <span aria-hidden="true">·</span>
                        <span>{Object.keys(story.scenes).length} scènes</span>
                        {save && (
                          <span
                            className="resume-chip"
                            style={{ background: tokens.accentText, color: tokens.onAccent }}
                          >
                            En cours
                          </span>
                        )}
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

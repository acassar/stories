import { resolveTokens } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { Story } from '@embranche/story-format';

import { BackIcon, MoonIcon, SunIcon, ThemeIcon } from '../components/Icons';
import type { LayoutKind } from '../hooks/useLayoutKind';
import { countEndings } from '../lib/library';

interface Props {
  story: Story;
  endingsSeen: number;
  /** True when a run is in progress on this story. */
  hasSave: boolean;
  mode: ColorMode;
  layout: LayoutKind;
  onToggleMode: () => void;
  onBack: () => void;
  onResume: () => void;
  onStart: () => void;
}

/** Story sheet: what is known before opening the book. */
export function Detail({
  story,
  endingsSeen,
  hasSave,
  mode,
  layout,
  onToggleMode,
  onBack,
  onResume,
  onStart,
}: Props) {
  const theme = (story.theme ?? 'night') as StoryTheme;
  const tokens = resolveTokens(theme, mode);

  return (
    <div className="scroll">
      <div className="detail">
        <div className="detail__cover" style={{ background: tokens.tint }}>
          <div className="detail__cover-icon" style={{ color: tokens.accent }}>
            <ThemeIcon theme={theme} size={92} strokeWidth={1.2} />
          </div>
          <div className="detail__cover-actions">
            <button
              type="button"
              className="icon-btn icon-btn--cut"
              onClick={onBack}
              aria-label="Retour à la bibliothèque"
            >
              <BackIcon />
            </button>
            {layout === 'mobile' && (
              <button
                type="button"
                className="icon-btn icon-btn--cut"
                onClick={onToggleMode}
                aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
              >
                {mode === 'light' ? <SunIcon /> : <MoonIcon />}
              </button>
            )}
          </div>
        </div>

        {/* Outside the cover: on a phone it rides over the bottom of it, on a
            wide screen it starts the column beside it. */}
        <div className="detail__heading">
          <div className="detail__tag">{story.tag ?? 'Récit'}</div>
          <h1 className="detail__title">{story.title}</h1>
        </div>

        <div className="detail__body">
          <p className="detail__author">par {story.author ?? 'anonyme'}</p>
          {story.blurb && <p className="detail__blurb">{story.blurb}</p>}

          <div className="stats">
            <div className="stats__item">
              <div className="stats__value">{Object.keys(story.scenes).length}</div>
              <div className="stats__label">scènes</div>
            </div>
            <div className="stats__item">
              <div className="stats__value">
                {endingsSeen}/{countEndings(story)}
              </div>
              <div className="stats__label">fins vues</div>
            </div>
            <div className="stats__item">
              <div className="stats__value">{story.estimatedMinutes ?? '—'}</div>
              <div className="stats__label">minutes</div>
            </div>
          </div>

          <div className="detail__actions">
            {hasSave && (
              <button type="button" className="cta" onClick={onResume}>
                Reprendre la partie
              </button>
            )}
            <button type="button" className={hasSave ? 'cta cta--quiet' : 'cta'} onClick={onStart}>
              {endingsSeen > 0 || hasSave ? 'Recommencer l’aventure' : 'Commencer l’aventure'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { accents } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { Story } from '@embranche/story-format';

import { BackIcon, MoonIcon, SunIcon } from '../components/Icons';
import { countEndings } from '../lib/library';

interface Props {
  story: Story;
  endingsSeen: number;
  /** Vrai si une partie est en cours sur ce recit. */
  hasSave: boolean;
  mode: ColorMode;
  onToggleMode: () => void;
  onBack: () => void;
  onResume: () => void;
  onStart: () => void;
}

/** Fiche du recit : ce qu'on sait avant d'ouvrir le livre. */
export function Detail({
  story,
  endingsSeen,
  hasSave,
  mode,
  onToggleMode,
  onBack,
  onResume,
  onStart,
}: Props) {
  const theme = (story.theme ?? 'night') as StoryTheme;

  return (
    <div className="scroll">
      <div className="detail__cover" style={{ background: accents[theme].grad }}>
        <div className="detail__cover-actions">
          <button
            type="button"
            className="icon-btn icon-btn--over"
            onClick={onBack}
            aria-label="Retour à la bibliothèque"
          >
            <BackIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--over"
            onClick={onToggleMode}
            aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
          >
            {mode === 'light' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className="detail__heading">
          <div className="detail__tag">{story.tag ?? 'Récit'}</div>
          <h1 className="detail__title">{story.title}</h1>
        </div>
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
  );
}

import { accents } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import type { SceneEnding, Story } from '@embranche/story-format';

import { StarIcon } from '../components/Icons';
import { countEndings } from '../lib/library';

interface Props {
  story: Story;
  ending: SceneEnding;
  endingsSeen: number;
  /** Nombre de choix faits pour arriver la. */
  steps: number;
  onRestart: () => void;
  onLibrary: () => void;
}

/** Ecran de fin : ce que le joueur emporte de sa traversee. */
export function Ending({ story, ending, endingsSeen, steps, onRestart, onLibrary }: Props) {
  const theme = (story.theme ?? 'night') as StoryTheme;

  return (
    <div className="ending">
      <div className="ending__seal" style={{ background: accents[theme].grad }}>
        <StarIcon />
      </div>

      <p className="ending__type">{ending.type}</p>
      <h1 className="ending__name">{ending.name}</h1>
      <p className="ending__blurb">{ending.blurb}</p>

      <div className="ending__stats">
        <div>
          <div className="stats__value">
            {endingsSeen}/{countEndings(story)}
          </div>
          <div className="stats__label">fins de ce récit</div>
        </div>
        <div>
          <div className="stats__value">{steps}</div>
          <div className="stats__label">choix faits</div>
        </div>
      </div>

      <div className="ending__actions">
        <button type="button" className="cta" onClick={onRestart}>
          Rejouer ce récit
        </button>
        <button type="button" className="cta cta--quiet" onClick={onLibrary}>
          Retour à la bibliothèque
        </button>
      </div>
    </div>
  );
}

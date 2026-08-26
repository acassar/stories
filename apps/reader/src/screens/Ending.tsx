import { resolveTokens } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { SceneEnding, Story } from '@embranche/story-format';

import { StarIcon } from '../components/Icons';
import { countEndings } from '../lib/library';

interface Props {
  story: Story;
  ending: SceneEnding;
  endingsSeen: number;
  /** Number of choices made to get here. */
  steps: number;
  mode: ColorMode;
  onRestart: () => void;
  onLibrary: () => void;
}

/** Ending screen: what the player takes away from the run. */
export function Ending({ story, ending, endingsSeen, steps, mode, onRestart, onLibrary }: Props) {
  const theme = (story.theme ?? 'night') as StoryTheme;
  const tokens = resolveTokens(theme, mode);

  return (
    <div className="ending">
      <div
        className="ending__seal"
        style={{
          background: tokens.accentText,
          borderColor: tokens.hard,
          color: tokens.onAccent,
        }}
      >
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

import { resolveTokens } from '@embranche/design-tokens';
import type { ColorMode, StoryTheme } from '@embranche/design-tokens';
import type { Story } from '@embranche/story-format';

import { ThemeIcon } from './Icons';

/**
 * The sheet of a story: paper tinted with its binding, cut out with a franc
 * ink border, its drawing at the centre.
 *
 * It is the same object at every size — thumbnail in the library, sheet on the
 * detail screen, card in the desktop grid — so it is drawn once here. Sizing is
 * left to the caller through `className`: the component only says what a story
 * looks like, never how big it is.
 */
interface Props {
  story: Story;
  mode: ColorMode;
  /** Size of the drawing, in pixels. */
  iconSize: number;
  className?: string;
  /** Hairline across the top of the sheet — dropped on the smallest sizes. */
  ruled?: boolean;
  /** Slight tilt, as of a sheet laid down by hand. */
  tilt?: boolean;
}

export function StoryCover({ story, mode, iconSize, className, ruled = true, tilt }: Props) {
  const theme = (story.theme ?? 'night') as StoryTheme;
  const tokens = resolveTokens(theme, mode);

  return (
    <span
      className={`cover${tilt ? ' cover--tilt' : ''}${className ? ` ${className}` : ''}`}
      style={{ background: tokens.tint, borderColor: tokens.hard }}
      aria-hidden="true"
    >
      {ruled && <span className="cover__rule" style={{ background: tokens.wash }} />}
      <span className="cover__icon" style={{ color: tokens.accent }}>
        <ThemeIcon theme={theme} size={iconSize} strokeWidth={iconSize > 60 ? 1.2 : 1.6} />
      </span>
    </span>
  );
}

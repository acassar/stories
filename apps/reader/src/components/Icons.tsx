/** Reader pictograms, taken from the Embranche mockup. */

import type { StoryTheme } from '@embranche/design-tokens';

/**
 * The drawing a story wears on its cover.
 *
 * One per binding, and nothing else: the format carries no icon of its own, so
 * the ambience is what a story is illustrated by. A story that declares no
 * binding falls back on `night`, as everywhere else in the reader.
 */
const themeIcons: Record<StoryTheme, string[]> = {
  // Fantasy: a leaf lit from below.
  fantasy: ['M12 20c0-6.5 3.2-10.5 8.5-11.5C20.5 15 17 20 12 20Z', 'M12 20c0-3.2-1.2-5.4-3.4-6.6'],
  // Mystery: the magnifying glass of the file.
  mystery: ['M10.8 4.2a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8Z', 'm15.6 15.6 4.4 4.4'],
  // Adventure: the ridge line.
  adventure: ['M2.5 18.5 9 8l3.8 5.8L15.4 10l6.1 8.5Z', 'M9 8l1.6 2.6'],
  // Night: the correspondence read after dark.
  night: [
    'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z',
    'M4.5 5.5h.01',
    'M7.5 3.2h.01',
    'M3.4 9h.01',
  ],
};

interface ThemeIconProps {
  theme: StoryTheme;
  size: number;
  /** Thinner as the drawing grows, so the line keeps the same weight. */
  strokeWidth?: number;
}

export function ThemeIcon({ theme, size, strokeWidth = 1.6 }: ThemeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {themeIcons[theme].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.3" fill="currentColor" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill="currentColor" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 16.7 6.1 19.6l1.3-6.2L2.7 9.1l6.3-.7z"
        fill="#fff"
        opacity=".92"
      />
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.4" fill="currentColor" />
      <circle cx="18" cy="11" r="2.4" fill="currentColor" />
      <circle cx="8" cy="19" r="2.4" fill="currentColor" />
      <path
        d="M7.6 6.4 16.4 10M16 12.6 9.2 17.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".8"
      />
    </svg>
  );
}

/** The waits and their pace — a dial, not a cog: nothing here is machinery. */
export function PaceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

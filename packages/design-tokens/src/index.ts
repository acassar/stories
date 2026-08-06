/**
 * Embranche design tokens — the single source of the skin of both apps.
 *
 * Everything lives here: re-skinning the app means editing this file (and
 * `tokens.css`, its mirror for the static rules). No color value is ever
 * hard-coded elsewhere.
 *
 * Zero dependencies: this package is pure TypeScript.
 */

export type ColorMode = 'light' | 'dark';

/** Binding tint of a story. */
export type StoryTheme = 'fantasy' | 'mystery' | 'adventure' | 'night';

export const STORY_THEMES: readonly StoryTheme[] = ['fantasy', 'mystery', 'adventure', 'night'];

export interface PaperTokens {
  /** Page background. */
  bg: string;
  /** Background of surfaces laid on the page (cards, bubbles). */
  panel: string;
  /** Rules and separators. */
  line: string;
  /** Paper ruling behind the reading surface. */
  ruleLine: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  sub: string;
}

export interface AccentTokens {
  /** Accent in light mode. */
  light: string;
  /** Accent in dark mode. */
  dark: string;
  /** Cover / binding gradient. */
  grad: string;
}

export interface ResolvedTokens extends PaperTokens {
  /** Accent resolved for the current mode. */
  accent: string;
  /** Light-mode accent whatever the mode — for light surfaces. */
  accentOnPaper: string;
  /** Cover gradient. */
  grad: string;
  /** Readable ink laid on top of the accent. */
  onAccent: string;
}

export const paper: Record<ColorMode, PaperTokens> = {
  light: {
    bg: '#eee6d6',
    panel: '#f6f0e2',
    line: '#d9cbae',
    ruleLine: 'rgba(60,45,20,.05)',
    ink: '#332920',
    sub: '#8a7d64',
  },
  dark: {
    bg: '#1b212d',
    panel: '#242c3a',
    line: 'rgba(150,165,195,.18)',
    ruleLine: 'rgba(200,210,230,.05)',
    ink: '#e9e2d1',
    sub: '#9aa3b8',
  },
};

export const accents: Record<StoryTheme, AccentTokens> = {
  fantasy: { light: '#5c4a6e', dark: '#a68fc0', grad: 'linear-gradient(160deg,#3d2f4a,#7a638f)' },
  mystery: { light: '#2f4d47', dark: '#7fae9f', grad: 'linear-gradient(160deg,#1f332e,#4d6b60)' },
  adventure: { light: '#7a4a32', dark: '#d19a75', grad: 'linear-gradient(150deg,#4a2e1c,#8a5a3a)' },
  night: { light: '#22344f', dark: '#8fa8d1', grad: 'linear-gradient(160deg,#16202f,#3a4f6e)' },
};

/** Binding tint spelled out in words (UI labels). */
export const themeLabels: Record<StoryTheme, string> = {
  fantasy: 'Prune',
  mystery: 'Sapin',
  adventure: 'Terre cuite',
  night: 'Encre',
};

/**
 * Resolves the full palette for a given binding and mode. This is the only
 * function the UI needs to paint itself.
 */
export function resolveTokens(theme: StoryTheme, mode: ColorMode): ResolvedTokens {
  const sheet = paper[mode];
  const accent = accents[theme] ?? accents.fantasy;
  return {
    ...sheet,
    accent: mode === 'dark' ? accent.dark : accent.light,
    accentOnPaper: accent.light,
    grad: accent.grad,
    onAccent: mode === 'dark' ? paper.dark.bg : '#f6f0e2',
  };
}

/**
 * Reader shell: slightly lighter than the library paper in light mode, so the
 * cover stands out.
 */
export function resolveShell(theme: StoryTheme, mode: ColorMode): ResolvedTokens {
  const base = resolveTokens(theme, mode);
  if (mode === 'dark') return base;
  return { ...base, bg: '#f6f2ea', panel: '#ffffff', line: '#eee3d2' };
}

/** Studio palette — light only, a workbench on white paper. */
export const studio = {
  page: '#eee6d6',
  surface: '#ffffff',
  canvas: '#faf7f1',
  gridDot: '#e4dccd',
  border: '#ece5d8',
  fieldBorder: '#ddd3c2',
  ink: '#241d14',
  sub: '#6b6253',
  muted: '#9a8f7d',
  chip: '#efe7d8',
  edge: '#c9bda8',
  edgeBack: '#b69ae0',
  selected: '#7b53d4',
  linking: '#6aa3ff',
  linkingSoft: '#eaf2ff',
  ending: '#fbf3e6',
  endingBorder: '#e9c98a',
  endingBadge: '#f3d9a3',
  endingInk: '#7a5610',
  danger: '#d9624c',
  dangerBorder: '#f0d6cf',
  dangerSoft: '#fbeae6',
  success: '#1d9b6f',
  successSoft: '#e3f5ec',
  warn: '#9a8350',
  warnSoft: '#f6eed9',
} as const;

/**
 * Colors of the studio node kinds.
 *
 * The kind of a node is the most structuring information in the graph: it
 * decides who speaks and whether the player has to act. It must therefore read
 * at a glance on the canvas, without opening the inspector — hence one color
 * per kind rather than a label alone.
 *
 * Three families clearly distinct from a distance: cold ink for the
 * correspondent, green for the player's voice, plum for a decision. The `ink`
 * tint is used for text laid on top and stays readable on `surface`.
 */
export interface KindTokens {
  /** Card background. */
  surface: string;
  /** Card rule, and color of the incoming edge. */
  border: string;
  /** Ink of the title and of the kind label. */
  ink: string;
  /** Pill behind the kind label. */
  badge: string;
  /** Label shown to the author. */
  label: string;
}

export type SceneKindName = 'npc' | 'player' | 'choice';

export const kinds: Record<SceneKindName, KindTokens> = {
  npc: {
    surface: '#eef3fa',
    border: '#bccee4',
    ink: '#2c4a6b',
    badge: '#d9e6f6',
    label: 'Personnage',
  },
  player: {
    surface: '#ecf4ef',
    border: '#bcd8c6',
    ink: '#2b5a42',
    badge: '#d7eadf',
    label: 'Joueur',
  },
  choice: {
    surface: '#f3eefb',
    border: '#cfc0ee',
    ink: '#563a8f',
    badge: '#e6dcf8',
    label: 'Choix',
  },
};

export const typography = {
  /** Interface: titles, buttons, labels. */
  ui: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif",
  /** Prose: scene text, story titles. */
  prose: "'Newsreader', Georgia, serif",
} as const;

export const radii = {
  sm: '6px',
  md: '9px',
  lg: '12px',
  xl: '18px',
  pill: '999px',
} as const;

export const space = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const;

/**
 * Renders the resolved palette as CSS variables, to be set on a container. The
 * UI then only ever reads `var(--emb-*)`.
 */
export function tokensToCssVars(tokens: ResolvedTokens): Record<string, string> {
  return {
    '--emb-bg': tokens.bg,
    '--emb-panel': tokens.panel,
    '--emb-line': tokens.line,
    '--emb-rule': tokens.ruleLine,
    '--emb-ink': tokens.ink,
    '--emb-sub': tokens.sub,
    '--emb-accent': tokens.accent,
    '--emb-accent-paper': tokens.accentOnPaper,
    '--emb-on-accent': tokens.onAccent,
    '--emb-grad': tokens.grad,
  };
}

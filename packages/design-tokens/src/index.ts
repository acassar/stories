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
  /** Accent in light mode — vivid, for decoration. */
  light: string;
  /** Darkened light-mode accent, contrast-safe for text and for filled surfaces. */
  lightText: string;
  /** Accent in dark mode. Light enough to serve as both decoration and text. */
  dark: string;
  /** Cover / binding gradient. Kept for the studio dashboard. */
  grad: string;
}

/** Paper tinted with the colour of a story: the story sheet and its rules. */
export interface TintTokens {
  /** Fill of the sheet. */
  tint: string;
  /** Rules and hairlines drawn on the sheet. */
  wash: string;
}

export interface ResolvedTokens extends PaperTokens {
  /** Accent resolved for the current mode — decoration only. */
  accent: string;
  /**
   * Accent to write with, and to fill a surface that carries text with. Never
   * `accent`: the vivid tones do not all clear AA on paper.
   */
  accentText: string;
  /** Cover gradient. */
  grad: string;
  /** Readable ink laid on top of `accentText`. */
  onAccent: string;
  /** Fill of a story sheet. */
  tint: string;
  /** Hairlines drawn on a story sheet. */
  wash: string;
  /** Ink the sheets, bubbles and buttons are cut out with. */
  hard: string;
  /** Offset shadow of a small cut-out surface. */
  hardShadowSm: string;
  /** Offset shadow of a large cut-out surface. */
  hardShadow: string;
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

/**
 * The four bindings.
 *
 * `light` is the colour of the story as it is seen — franc, saturated. It is
 * never written with: `lightText` is the same hue taken down to AA on the cream
 * paper, and that is what carries text. In dark mode a single tone does both
 * jobs, since the paper is dark.
 */
export const accents: Record<StoryTheme, AccentTokens> = {
  fantasy: {
    light: '#6b34cf',
    lightText: '#6b34cf',
    dark: '#b79bf0',
    grad: 'linear-gradient(160deg,#3d2f4a,#7a638f)',
  },
  mystery: {
    light: '#0d7a61',
    lightText: '#0a6b55',
    dark: '#6fc9ae',
    grad: 'linear-gradient(160deg,#1f332e,#4d6b60)',
  },
  adventure: {
    light: '#d4501c',
    lightText: '#a83b12',
    dark: '#f0966b',
    grad: 'linear-gradient(150deg,#4a2e1c,#8a5a3a)',
  },
  night: {
    light: '#2b46cc',
    lightText: '#2b46cc',
    dark: '#93a8f5',
    grad: 'linear-gradient(160deg,#16202f,#3a4f6e)',
  },
};

/** Paper tinted with the binding, per mode. */
export const tints: Record<ColorMode, Record<StoryTheme, TintTokens>> = {
  light: {
    fantasy: { tint: '#e6dcfa', wash: '#c9b6f0' },
    mystery: { tint: '#d8ece5', wash: '#a9d6c8' },
    adventure: { tint: '#f7ddd0', wash: '#eeb695' },
    night: { tint: '#dde2fa', wash: '#b3bdf0' },
  },
  dark: {
    fantasy: { tint: '#2b2440', wash: '#453a63' },
    mystery: { tint: '#16302a', wash: '#245045' },
    adventure: { tint: '#3a2419', wash: '#5c3a25' },
    night: { tint: '#1f2745', wash: '#33406b' },
  },
};

/**
 * The ink everything is cut out with, and the shadow that ink casts. A sheet,
 * a bubble and a button are all the same gesture: a shape bordered franchement,
 * dropped slightly above the paper.
 */
export const cutout: Record<ColorMode, { hard: string; shadowSm: string; shadow: string }> = {
  light: {
    hard: '#2a2115',
    shadowSm: '2px 2px 0 rgba(42,33,21,.18)',
    shadow: '4px 4px 0 rgba(42,33,21,.22)',
  },
  dark: {
    hard: '#0d1017',
    shadowSm: '2px 2px 0 rgba(0,0,0,.45)',
    shadow: '4px 4px 0 rgba(0,0,0,.5)',
  },
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
  const known = theme in accents ? theme : 'fantasy';
  const accent = accents[known];
  const ink = cutout[mode];
  return {
    ...sheet,
    accent: mode === 'dark' ? accent.dark : accent.light,
    accentText: mode === 'dark' ? accent.dark : accent.lightText,
    grad: accent.grad,
    onAccent: mode === 'dark' ? paper.dark.bg : '#f6f0e2',
    ...tints[mode][known],
    hard: ink.hard,
    hardShadowSm: ink.shadowSm,
    hardShadow: ink.shadow,
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
    '--emb-accent-text': tokens.accentText,
    '--emb-on-accent': tokens.onAccent,
    '--emb-grad': tokens.grad,
    '--emb-tint': tokens.tint,
    '--emb-wash': tokens.wash,
    '--emb-hard': tokens.hard,
    '--emb-hard-shadow-sm': tokens.hardShadowSm,
    '--emb-hard-shadow': tokens.hardShadow,
  };
}

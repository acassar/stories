/**
 * Design tokens « Embranche » — source unique de la peau des deux apps.
 *
 * Tout est ici : re-skinner l'app, c'est modifier ce fichier (et `tokens.css`
 * qui en est le miroir pour les regles statiques). Aucune valeur de couleur ne
 * doit etre ecrite en dur ailleurs.
 *
 * Zero dependance : ce paquet est du TypeScript pur.
 */

export type ColorMode = 'light' | 'dark';

/** Teinte de reliure d'un recit. */
export type StoryTheme = 'fantasy' | 'mystery' | 'adventure' | 'night';

export const STORY_THEMES: readonly StoryTheme[] = ['fantasy', 'mystery', 'adventure', 'night'];

export interface PaperTokens {
  /** Fond de page. */
  bg: string;
  /** Fond des surfaces posees sur la page (cartes, bulles). */
  panel: string;
  /** Filets et separateurs. */
  line: string;
  /** Reglure de papier en fond de lecture. */
  ruleLine: string;
  /** Texte principal. */
  ink: string;
  /** Texte secondaire. */
  sub: string;
}

export interface AccentTokens {
  /** Accent en mode jour. */
  light: string;
  /** Accent en mode nuit. */
  dark: string;
  /** Degrade de couverture / reliure. */
  grad: string;
}

export interface ResolvedTokens extends PaperTokens {
  /** Accent resolu pour le mode courant. */
  accent: string;
  /** Accent « jour » quel que soit le mode — pour les surfaces claires. */
  accentOnPaper: string;
  /** Degrade de couverture. */
  grad: string;
  /** Encre lisible posee sur l'accent. */
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

/** Teinte de reliure lisible en toutes lettres (etiquettes d'UI). */
export const themeLabels: Record<StoryTheme, string> = {
  fantasy: 'Prune',
  mystery: 'Sapin',
  adventure: 'Terre cuite',
  night: 'Encre',
};

/**
 * Resout la palette complete pour une reliure et un mode donnes.
 * C'est la seule fonction dont l'UI a besoin pour se peindre.
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
 * Coquille du lecteur : legerement plus claire que le papier de la
 * bibliotheque en mode jour, pour que la couverture ressorte.
 */
export function resolveShell(theme: StoryTheme, mode: ColorMode): ResolvedTokens {
  const base = resolveTokens(theme, mode);
  if (mode === 'dark') return base;
  return { ...base, bg: '#f6f2ea', panel: '#ffffff', line: '#eee3d2' };
}

/** Palette du studio — jour uniquement, poste de travail sur papier blanc. */
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

export const typography = {
  /** Interface : titres, boutons, etiquettes. */
  ui: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif",
  /** Prose : texte des scenes, titres de recits. */
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
 * Rend la palette resolue sous forme de variables CSS, a poser sur un
 * conteneur. L'UI ne lit ensuite que `var(--emb-*)`.
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

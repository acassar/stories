/**
 * The words of the reader itself — buttons, sheets, toasts — in each language
 * it speaks.
 *
 * The stories carry their own languages (`translations` in the format); this is
 * only the frame around them. Every language is a full `Messages` object, so a
 * string missing from one is a type error rather than a hole on screen.
 *
 * As in `library.ts`, `localStorage` lives here and nowhere else.
 */

export const LOCALES = ['fr', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

const LOCALE_KEY = 'embranche.reader.locale.v1';

export interface Messages {
  toNight: string;
  toDay: string;
  dayNight: string;
  settings: string;
  importStory: string;
  openFile: string;

  libraryEyebrow: string;
  libraryTitle: string;
  resumeReading: string;
  decisionsMade: (count: number) => string;
  endingsCount: (seen: number, total: number) => string;
  scenesCount: (count: number) => string;
  inProgress: string;
  defaultTag: string;
  anonymous: string;
  emptyLibrary: string;

  backToLibrary: string;
  byAuthor: (author: string) => string;
  statScenes: string;
  statEndingsSeen: string;
  statMinutes: string;
  storyLanguage: string;
  resumeRun: string;
  startAdventure: string;
  restartAdventure: string;
  removeWarning: string;
  removeForGood: string;
  cancel: string;
  removeStory: string;

  backToSheet: string;
  typing: string;
  typingLabel: string;
  threadBook: string;
  threadCorrespondence: string;
  readOn: string;
  goBack: string;
  seeEnding: string;
  whatNext: string;
  reply: string;
  deadEnd: string;
  rereadBook: string;
  rereadCorrespondence: string;

  endingsOfStory: string;
  choicesMade: string;
  replay: string;

  appLanguage: string;
  paceTitle: string;
  paceHint: string;
  paceLabel: string;
  paces: Record<string, string>;
  paceRealTime: string;
  paceNone: string;
  paceRatio: (minutes: number) => string;
  gotIt: string;

  defaultAway: string;
  yourCorrespondent: string;
  awaySentence: (who: string, status: string, remaining: string) => string;

  storyRemoved: (title: string) => string;
  thisStory: string;
  notJson: string;
  storyRefused: (reason: string) => string;
  incoherentDocument: string;
  storyAdded: (title: string) => string;
}

const fr: Messages = {
  toNight: 'Passer en mode nuit',
  toDay: 'Passer en mode jour',
  dayNight: 'Jour / nuit',
  settings: 'Réglages',
  importStory: 'Ouvrir une histoire depuis un fichier',
  openFile: 'Ouvrir un fichier',

  libraryEyebrow: 'Ex-libris,',
  libraryTitle: 'Que vas-tu vivre ?',
  resumeReading: 'Reprendre la lecture',
  decisionsMade: (count) => `${count} choix fait${count > 1 ? 's' : ''}`,
  endingsCount: (seen, total) => `${seen}/${total} fins`,
  scenesCount: (count) => `${count} scènes`,
  inProgress: 'En cours',
  defaultTag: 'Récit',
  anonymous: 'anonyme',
  emptyLibrary: 'Aucune histoire. Ouvre un JSON exporté depuis le studio pour commencer.',

  backToLibrary: 'Retour à la bibliothèque',
  byAuthor: (author) => `par ${author}`,
  statScenes: 'scènes',
  statEndingsSeen: 'fins vues',
  statMinutes: 'minutes',
  storyLanguage: 'Langue du récit',
  resumeRun: 'Reprendre la partie',
  startAdventure: 'Commencer l’aventure',
  restartAdventure: 'Recommencer l’aventure',
  removeWarning: 'Ce récit quitte ta bibliothèque, avec la partie en cours et les fins trouvées.',
  removeForGood: 'Retirer définitivement',
  cancel: 'Annuler',
  removeStory: 'Retirer ce récit de ma bibliothèque',

  backToSheet: 'Retour à la fiche du récit',
  typing: 'écrit…',
  typingLabel: 'En train d’écrire',
  threadBook: 'Récit',
  threadCorrespondence: 'Correspondance',
  readOn: 'Lire la suite',
  goBack: '↩ Revenir en arrière',
  seeEnding: 'Voir la fin',
  whatNext: 'Et ensuite…',
  reply: 'Répondre',
  deadEnd: 'Cette scène ne mène nulle part — le récit s’arrête ici.',
  rereadBook: 'Relire le récit',
  rereadCorrespondence: 'Relire la correspondance',

  endingsOfStory: 'fins de ce récit',
  choicesMade: 'choix faits',
  replay: 'Rejouer ce récit',

  appLanguage: 'Langue',
  paceTitle: 'Le temps qui passe',
  paceHint:
    'Certains récits te font attendre pour de vrai — ton correspondant vit sa vie et te répond plus tard. Tu décides à quelle vitesse ce temps s’écoule.',
  paceLabel: 'Vitesse des attentes',
  paces: {
    '1': 'Temps réel',
    '2': '2× plus vite',
    '3': '3× plus vite',
    '5': '5× plus vite',
    '10': '10× plus vite',
    Infinity: 'Sans attente',
  },
  paceRealTime: 'Le récit se déroule au rythme que son auteur a écrit.',
  paceNone: 'Les silences sont supprimés : tout arrive d’un trait.',
  paceRatio: (minutes) => `Une heure d’attente en dure ${minutes}.`,
  gotIt: 'C’est noté',

  defaultAway: 'hors ligne',
  yourCorrespondent: 'Ton correspondant',
  awaySentence: (who, status, remaining) => `${who} est ${status} — de retour dans ${remaining}.`,

  storyRemoved: (title) => `« ${title} » a quitté ta bibliothèque.`,
  thisStory: 'Ce récit',
  notJson: 'Ce fichier n’est pas du JSON lisible.',
  storyRefused: (reason) => `Histoire refusée : ${reason}`,
  incoherentDocument: 'document incohérent',
  storyAdded: (title) => `« ${title} » ajoutée à ta bibliothèque.`,
};

const en: Messages = {
  toNight: 'Switch to night mode',
  toDay: 'Switch to day mode',
  dayNight: 'Day / night',
  settings: 'Settings',
  importStory: 'Open a story from a file',
  openFile: 'Open a file',

  libraryEyebrow: 'Ex libris,',
  libraryTitle: 'What will you live through?',
  resumeReading: 'Pick up reading',
  decisionsMade: (count) => `${count} choice${count === 1 ? '' : 's'} made`,
  endingsCount: (seen, total) => `${seen}/${total} endings`,
  scenesCount: (count) => `${count} scenes`,
  inProgress: 'In progress',
  defaultTag: 'Story',
  anonymous: 'anonymous',
  emptyLibrary: 'No stories yet. Open a JSON file exported from the studio to begin.',

  backToLibrary: 'Back to the library',
  byAuthor: (author) => `by ${author}`,
  statScenes: 'scenes',
  statEndingsSeen: 'endings seen',
  statMinutes: 'minutes',
  storyLanguage: 'Story language',
  resumeRun: 'Resume the story',
  startAdventure: 'Begin the adventure',
  restartAdventure: 'Start the adventure over',
  removeWarning:
    'This story leaves your library, along with the run in progress and the endings found.',
  removeForGood: 'Remove for good',
  cancel: 'Cancel',
  removeStory: 'Remove this story from my library',

  backToSheet: 'Back to the story sheet',
  typing: 'typing…',
  typingLabel: 'Typing',
  threadBook: 'Story',
  threadCorrespondence: 'Correspondence',
  readOn: 'Read on',
  goBack: '↩ Go back',
  seeEnding: 'See the ending',
  whatNext: 'And then…',
  reply: 'Reply',
  deadEnd: 'This scene leads nowhere — the story stops here.',
  rereadBook: 'Reread the story',
  rereadCorrespondence: 'Reread the correspondence',

  endingsOfStory: 'endings in this story',
  choicesMade: 'choices made',
  replay: 'Play this story again',

  appLanguage: 'Language',
  paceTitle: 'Time passing',
  paceHint:
    'Some stories make you wait for real — your correspondent lives their life and answers you later. You decide how fast that time goes by.',
  paceLabel: 'Speed of the waits',
  paces: {
    '1': 'Real time',
    '2': '2× faster',
    '3': '3× faster',
    '5': '5× faster',
    '10': '10× faster',
    Infinity: 'No waiting',
  },
  paceRealTime: 'The story unfolds at the pace its author wrote.',
  paceNone: 'The silences are gone: everything arrives in one go.',
  paceRatio: (minutes) => `An hour of waiting lasts ${minutes} minutes.`,
  gotIt: 'Got it',

  defaultAway: 'offline',
  yourCorrespondent: 'Your correspondent',
  awaySentence: (who, status, remaining) => `${who} is ${status} — back in ${remaining}.`,

  storyRemoved: (title) => `“${title}” has left your library.`,
  thisStory: 'This story',
  notJson: 'This file is not readable JSON.',
  storyRefused: (reason) => `Story refused: ${reason}`,
  incoherentDocument: 'inconsistent document',
  storyAdded: (title) => `“${title}” added to your library.`,
};

export const MESSAGES: Record<Locale, Messages> = { fr, en };

/** The first language the browser asks for that the reader speaks, French otherwise. */
export function pickLocale(preferred: readonly string[] = []): Locale {
  for (const wanted of preferred) {
    const primary = wanted.split('-')[0]?.toLowerCase();
    const match = LOCALES.find((locale) => locale === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export function loadLocale(
  preferred: readonly string[] = [],
  storage: Storage = window.localStorage,
): Locale {
  const stored = storage.getItem(LOCALE_KEY);
  return LOCALES.find((locale) => locale === stored) ?? pickLocale(preferred);
}

export function saveLocale(locale: Locale, storage: Storage = window.localStorage): void {
  storage.setItem(LOCALE_KEY, locale);
}

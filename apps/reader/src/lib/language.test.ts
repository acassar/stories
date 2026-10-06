import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetLanguage,
  languageName,
  loadLanguages,
  pickLanguage,
  saveLanguage,
} from './language';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

const bilingual = { language: 'fr', translations: { en: {} } };

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
});

describe('pickLanguage', () => {
  it('keeps the choice the reader made', () => {
    expect(pickLanguage(bilingual, 'en', ['fr'])).toBe('en');
  });

  it('follows the browser when nothing was chosen', () => {
    expect(pickLanguage(bilingual, undefined, ['de', 'en-GB'])).toBe('en');
  });

  it('falls back on the story language', () => {
    expect(pickLanguage(bilingual, undefined, ['de'])).toBe('fr');
    expect(pickLanguage({}, undefined, ['en'])).toBe('fr');
  });

  it('drops a choice the story no longer offers', () => {
    expect(pickLanguage({ language: 'fr' }, 'en', [])).toBe('fr');
  });
});

describe('stored choices', () => {
  it('remembers a language per story', () => {
    saveLanguage('vaelmont', 'en', storage);
    saveLanguage('kerlaven', 'fr', storage);
    expect(loadLanguages(storage)).toEqual({ vaelmont: 'en', kerlaven: 'fr' });
  });

  it('forgets the choice of a story put away', () => {
    saveLanguage('vaelmont', 'en', storage);
    forgetLanguage('vaelmont', storage);
    expect(loadLanguages(storage)).toEqual({});
  });

  it('survives a damaged entry', () => {
    storage.setItem('embranche.reader.languages.v1', '{oops');
    expect(loadLanguages(storage)).toEqual({});
  });
});

describe('languageName', () => {
  it('names a language in itself', () => {
    expect(languageName('fr')).toBe('Français');
    expect(languageName('en')).toBe('English');
  });
});

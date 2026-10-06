import { describe, expect, it } from 'vitest';

import { MESSAGES, loadLocale, pickLocale, saveLocale } from './i18n';

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

describe('pickLocale', () => {
  it('follows the first browser language the reader speaks', () => {
    expect(pickLocale(['de-DE', 'en-GB', 'fr'])).toBe('en');
  });

  it('falls back on French', () => {
    expect(pickLocale(['de-DE'])).toBe('fr');
    expect(pickLocale([])).toBe('fr');
  });
});

describe('stored locale', () => {
  it('keeps the reader’s choice over the browser', () => {
    const storage = memoryStorage();
    saveLocale('en', storage);
    expect(loadLocale(['fr-FR'], storage)).toBe('en');
  });

  it('ignores a value it does not speak', () => {
    const storage = memoryStorage();
    storage.setItem('embranche.reader.locale.v1', 'xx');
    expect(loadLocale(['en-US'], storage)).toBe('en');
  });
});

describe('messages', () => {
  it('agrees in number in each language', () => {
    expect(MESSAGES.fr.decisionsMade(1)).toBe('1 choix fait');
    expect(MESSAGES.fr.decisionsMade(2)).toBe('2 choix faits');
    expect(MESSAGES.en.decisionsMade(1)).toBe('1 choice made');
    expect(MESSAGES.en.decisionsMade(0)).toBe('0 choices made');
  });
});

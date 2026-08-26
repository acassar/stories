import { describe, expect, it } from 'vitest';

import { interpolate, textTokens } from './interpolate.js';

describe('interpolate', () => {
  it('puts the value of a variable in place of its token', () => {
    expect(interpolate('Il te reste {{ nuit }} nuits.', { nuit: 3 })).toBe('Il te reste 3 nuits.');
  });

  it('accepts a token written without spaces, and several in one line', () => {
    expect(interpolate('{{nom}} garde {{or}} pieces.', { nom: 'Elara', or: 12 })).toBe(
      'Elara garde 12 pieces.',
    );
  });

  it('leaves an unknown name standing, so the mistake stays visible', () => {
    expect(interpolate('Bonjour {{ prenom }}.', { nom: 'Elara' })).toBe('Bonjour {{ prenom }}.');
  });

  it('returns the text untouched when it holds no token', () => {
    const text = 'Le sentier disparait sous les fougeres.';
    expect(interpolate(text, { nuit: 3 })).toBe(text);
    expect(interpolate(text)).toBe(text);
  });

  it('reads a value of every type the format allows', () => {
    expect(interpolate('{{ a }} {{ b }} {{ c }}', { a: 'oui', b: 7, c: false })).toBe(
      'oui 7 false',
    );
  });

  it('substitutes, it never evaluates', () => {
    // Whatever sits between the braces is a name to look up and nothing else.
    // No expression, no call, no property access: a story is a file that may
    // come from anywhere, and opening one must not run its author's code.
    const state = { nuit: 3, toString: 'inoffensif' };
    expect(interpolate('{{ nuit > 2 }}', state)).toBe('{{ nuit > 2 }}');
    expect(interpolate('{{ nuit.toString() }}', state)).toBe('{{ nuit.toString() }}');
    expect(interpolate('{{ constructor }}', state)).toBe('{{ constructor }}');
    expect(interpolate('{{ __proto__ }}', state)).toBe('{{ __proto__ }}');
  });

  it('replaces a value that itself looks like a token only once', () => {
    // The result is not scanned again, so a value can never smuggle in a token.
    expect(interpolate('{{ a }}', { a: '{{ b }}', b: 'jamais lu' })).toBe('{{ b }}');
  });

  it('leaves empty braces alone', () => {
    expect(interpolate('Deux accolades vides {{}} et {{   }}.', {})).toBe(
      'Deux accolades vides {{}} et {{   }}.',
    );
  });
});

describe('textTokens', () => {
  it('lists the names a text asks for, in order and without repeats', () => {
    expect(textTokens('{{ nuit }}, encore {{nuit}}, puis {{ confiance }}.')).toEqual([
      'nuit',
      'confiance',
    ]);
  });

  it('finds a name the substitution would not know, so it can be reported', () => {
    expect(textTokens('Bonjour {{ prénom }} !')).toEqual(['prénom']);
  });

  it('finds nothing in ordinary prose', () => {
    expect(textTokens('Une phrase avec une accolade { seule.')).toEqual([]);
  });
});

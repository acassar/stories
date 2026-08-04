import { describe, expect, it } from 'vitest';

import { clairiereStory } from '@embranche/story-format';
import type { GameState } from '@embranche/story-format';

import { applyEffects } from './effects.js';
import { createInitialState } from './state.js';

const clock = () => '2026-01-01T00:00:00.000Z';

function base(): GameState {
  return {
    ...createInitialState(clairiereStory, clock),
    variables: { karma: 2, prudent: false },
    inventory: { piece: 3 },
  };
}

describe('applyEffects', () => {
  it('renvoie le meme objet quand il n’y a rien a appliquer', () => {
    const state = base();
    expect(applyEffects(state, undefined)).toBe(state);
    expect(applyEffects(state, [])).toBe(state);
  });

  it('ne mute jamais l’etat fourni', () => {
    const state = base();
    const next = applyEffects(state, [{ op: 'set', variable: 'karma', value: 99 }]);
    expect(state.variables.karma).toBe(2);
    expect(next.variables.karma).toBe(99);
    expect(next).not.toBe(state);
  });

  it('set / inc / dec', () => {
    const next = applyEffects(base(), [
      { op: 'set', variable: 'nom', value: 'Alex' },
      { op: 'inc', variable: 'karma', value: 3 },
      { op: 'dec', variable: 'karma', value: 1 },
    ]);
    expect(next.variables).toMatchObject({ nom: 'Alex', karma: 4 });
  });

  it('inc part de zero quand la variable n’existe pas', () => {
    const next = applyEffects(base(), [{ op: 'inc', variable: 'nouvelle', value: 2 }]);
    expect(next.variables.nouvelle).toBe(2);
  });

  it('toggle inverse un booleen et pose true sur une variable absente', () => {
    const next = applyEffects(base(), [
      { op: 'toggle', variable: 'prudent' },
      { op: 'toggle', variable: 'jamais-vue' },
    ]);
    expect(next.variables.prudent).toBe(true);
    expect(next.variables['jamais-vue']).toBe(true);
  });

  it('unset retire la variable', () => {
    const next = applyEffects(base(), [{ op: 'unset', variable: 'karma' }]);
    expect('karma' in next.variables).toBe(false);
  });

  it('addItem cumule les quantites, defaut 1', () => {
    const next = applyEffects(base(), [
      { op: 'addItem', item: 'piece', quantity: 2 },
      { op: 'addItem', item: 'lanterne' },
    ]);
    expect(next.inventory).toEqual({ piece: 5, lanterne: 1 });
  });

  it('removeItem ne descend pas sous zero et retire l’objet epuise', () => {
    const next = applyEffects(base(), [{ op: 'removeItem', item: 'piece', quantity: 10 }]);
    expect('piece' in next.inventory).toBe(false);

    const partial = applyEffects(base(), [{ op: 'removeItem', item: 'piece' }]);
    expect(partial.inventory.piece).toBe(2);
  });

  it('applique les effets dans l’ordre donne', () => {
    const setPuisInc = applyEffects(base(), [
      { op: 'set', variable: 'karma', value: 0 },
      { op: 'inc', variable: 'karma', value: 5 },
    ]);
    const incPuisSet = applyEffects(base(), [
      { op: 'inc', variable: 'karma', value: 5 },
      { op: 'set', variable: 'karma', value: 0 },
    ]);
    expect(setPuisInc.variables.karma).toBe(5);
    expect(incPuisSet.variables.karma).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { evaluateCondition, isSatisfied } from './conditions.js';
import type { ConditionContext } from './conditions.js';

const context: ConditionContext = {
  variables: { prudent: true, karma: 3, nom: 'Alex' },
  inventory: { lanterne: 1, piece: 5 },
  visited: ['start', 'arbre'],
};

describe('evaluateCondition', () => {
  it('always is always true', () => {
    expect(evaluateCondition({ op: 'always' }, context)).toBe(true);
  });

  it('compares equality across every type', () => {
    expect(evaluateCondition({ op: 'eq', variable: 'prudent', value: true }, context)).toBe(true);
    expect(evaluateCondition({ op: 'eq', variable: 'nom', value: 'Alex' }, context)).toBe(true);
    expect(evaluateCondition({ op: 'neq', variable: 'karma', value: 4 }, context)).toBe(true);
  });

  it('compares ordering on numbers', () => {
    expect(evaluateCondition({ op: 'gt', variable: 'karma', value: 2 }, context)).toBe(true);
    expect(evaluateCondition({ op: 'gte', variable: 'karma', value: 3 }, context)).toBe(true);
    expect(evaluateCondition({ op: 'lt', variable: 'karma', value: 3 }, context)).toBe(false);
    expect(evaluateCondition({ op: 'lte', variable: 'karma', value: 3 }, context)).toBe(true);
  });

  it('refuses to order two different types rather than coercing', () => {
    expect(evaluateCondition({ op: 'gt', variable: 'nom', value: 2 }, context)).toBe(false);
    expect(evaluateCondition({ op: 'lt', variable: 'prudent', value: 10 }, context)).toBe(false);
  });

  it('treats a missing variable as not equal, never as zero', () => {
    expect(evaluateCondition({ op: 'eq', variable: 'absente', value: 0 }, context)).toBe(false);
    expect(evaluateCondition({ op: 'gt', variable: 'absente', value: -1 }, context)).toBe(false);
    expect(evaluateCondition({ op: 'neq', variable: 'absente', value: 'x' }, context)).toBe(true);
  });

  it('queries the inventory with a default quantity of 1', () => {
    expect(evaluateCondition({ op: 'hasItem', item: 'lanterne' }, context)).toBe(true);
    expect(evaluateCondition({ op: 'hasItem', item: 'piece', quantity: 5 }, context)).toBe(true);
    expect(evaluateCondition({ op: 'hasItem', item: 'piece', quantity: 6 }, context)).toBe(false);
    expect(evaluateCondition({ op: 'lacksItem', item: 'epee' }, context)).toBe(true);
    expect(evaluateCondition({ op: 'lacksItem', item: 'piece', quantity: 6 }, context)).toBe(true);
  });

  it('queries the visited scenes', () => {
    expect(evaluateCondition({ op: 'visited', scene: 'arbre' }, context)).toBe(true);
    expect(evaluateCondition({ op: 'notVisited', scene: 'chateau' }, context)).toBe(true);
  });

  it('composes with and / or / not, including nested', () => {
    expect(
      evaluateCondition(
        {
          op: 'and',
          conditions: [
            { op: 'eq', variable: 'prudent', value: true },
            {
              op: 'or',
              conditions: [
                { op: 'hasItem', item: 'epee' },
                { op: 'gt', variable: 'karma', value: 1 },
              ],
            },
            { op: 'not', condition: { op: 'visited', scene: 'chateau' } },
          ],
        },
        context,
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        { op: 'and', conditions: [{ op: 'always' }, { op: 'hasItem', item: 'epee' }] },
        context,
      ),
    ).toBe(false);
  });
});

describe('isSatisfied', () => {
  it('treats a missing condition as satisfied', () => {
    expect(isSatisfied(undefined, context)).toBe(true);
  });
});

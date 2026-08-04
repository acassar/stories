import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';

import { edgeId, nextScenePosition, parseEdgeId, toEdges, toNodes } from './graph';

const issues = validateStory(clairiereStory).issues;

describe('graph', () => {
  it('produit un noeud par scene, a sa position du format', () => {
    const nodes = toNodes(clairiereStory, issues, 'start');
    expect(nodes).toHaveLength(6);
    const start = nodes.find((node) => node.id === 'start');
    expect(start?.position).toEqual({ x: 400, y: 26 });
    expect(start?.data.isStart).toBe(true);
    expect(start?.selected).toBe(true);
  });

  it('produit une arete par choix, portee par la poignee du choix', () => {
    const edges = toEdges(clairiereStory, issues);
    // 2 + 3 + 2 choix ; les trois fins n'en ont aucun.
    expect(edges).toHaveLength(7);
    const edge = edges.find((e) => e.id === 'start:vers-lucioles');
    expect(edge).toMatchObject({
      source: 'start',
      target: 'lucioles',
      sourceHandle: 'vers-lucioles',
    });
  });

  it('anime les aretes conditionnelles pour les distinguer', () => {
    const conditional = toEdges(clairiereStory, issues).find(
      (edge) => edge.id === 'lucioles:demander-elara',
    );
    expect(conditional?.animated).toBe(true);
  });

  it('ignore les aretes vers une cible inexistante — le noeud porte l’alerte', () => {
    const broken = structuredClone(clairiereStory);
    broken.scenes.start!.choices[0]!.target = 'fantome';
    expect(toEdges(broken, validateStory(broken).issues)).toHaveLength(6);
  });

  it('fait un aller-retour sur les identifiants d’arete', () => {
    expect(parseEdgeId(edgeId('start', 'vers-lucioles'))).toEqual({
      sceneId: 'start',
      choiceId: 'vers-lucioles',
    });
    expect(parseEdgeId('sans-separateur')).toBeNull();
  });

  it('place une nouvelle scene sous la plus basse', () => {
    // Trois scenes partagent y = 420 ; la premiere rencontree fait foi.
    expect(nextScenePosition(clairiereStory)).toEqual({ x: 70, y: 600 });
  });
});

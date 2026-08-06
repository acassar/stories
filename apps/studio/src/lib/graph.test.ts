import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';

import { childPosition, edgeId, nextScenePosition, parseEdgeId, toEdges, toNodes } from './graph';

const issues = validateStory(clairiereStory).issues;
const sceneCount = Object.keys(clairiereStory.scenes).length;

describe('graph', () => {
  it('produit un noeud par scene, a sa position du format', () => {
    const nodes = toNodes(clairiereStory, issues, 'start');
    expect(nodes).toHaveLength(sceneCount);
    const start = nodes.find((node) => node.id === 'start');
    expect(start?.position).toEqual({ x: 400, y: 0 });
    expect(start?.data.isStart).toBe(true);
    expect(start?.selected).toBe(true);
  });

  it('marque les noeuds qui arretent la lecture en attendant une decision', () => {
    const nodes = toNodes(clairiereStory, issues, null);
    // `start` propose des choix ; `prudence` est une replique qui enchaine seule.
    expect(nodes.find((node) => node.id === 'start')?.data.awaitsChoice).toBe(true);
    expect(nodes.find((node) => node.id === 'prudence')?.data.awaitsChoice).toBe(false);
  });

  it('produit une arete par lien', () => {
    const edges = toEdges(clairiereStory, issues);
    const links = Object.values(clairiereStory.scenes).flatMap((scene) => scene.next);
    expect(edges).toHaveLength(links.length);
    expect(edges.find((e) => e.id === 'start:vers-lucioles')).toMatchObject({
      source: 'start',
      target: 'c-lucioles',
    });
  });

  it('anime les aretes conditionnelles pour les distinguer', () => {
    const conditional = toEdges(clairiereStory, issues).find(
      (edge) => edge.id === 'lucioles:vers-elara',
    );
    expect(conditional?.animated).toBe(true);
    expect(conditional?.label).toBe('◇ si…');
  });

  it('signale sur l’arete ce que le noeud ne peut pas dire : les effets', () => {
    const withEffects = toEdges(clairiereStory, issues).find(
      (edge) => edge.id === 'arbre:vers-redescendre',
    );
    expect(withEffects?.label).toBe('⚙ 1');
  });

  it('laisse muette une arete qui n’a rien de particulier', () => {
    const plain = toEdges(clairiereStory, issues).find((edge) => edge.id === 'start:vers-arbre');
    expect(plain?.label).toBeUndefined();
  });

  it('ignore les aretes vers une cible inexistante — le noeud porte l’alerte', () => {
    const broken = structuredClone(clairiereStory);
    const before = toEdges(clairiereStory, issues).length;
    broken.scenes.start!.next[0]!.to = 'fantome';
    expect(toEdges(broken, validateStory(broken).issues)).toHaveLength(before - 1);
  });

  it('fait un aller-retour sur les identifiants d’arete', () => {
    expect(parseEdgeId(edgeId('start', 'vers-lucioles'))).toEqual({
      sceneId: 'start',
      linkId: 'vers-lucioles',
    });
    expect(parseEdgeId('sans-separateur')).toBeNull();
  });

  it('place une nouvelle scene sous la plus basse', () => {
    const lowest = Object.values(clairiereStory.scenes).reduce((a, b) =>
      b.position.y > a.position.y ? b : a,
    );
    expect(nextScenePosition(clairiereStory)).toEqual({
      x: lowest.position.x,
      y: lowest.position.y + 180,
    });
  });

  it('etale les enfants d’un meme parent pour qu’ils ne s’empilent pas', () => {
    const parent = clairiereStory.scenes.start!;
    expect(childPosition(parent, 1)).toEqual({ x: 400, y: 170 });
    expect(childPosition(parent, 2)).toEqual({ x: 530, y: 170 });
  });
});

import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { clairiereStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { Editor } from './Editor';

/** The shell, reduced to what the editor needs: a story and a way to save it. */
function Harness() {
  const [story, setStory] = useState<Story>(() => structuredClone(clairiereStory));
  return (
    <>
      <output data-testid="story">{JSON.stringify(story)}</output>
      <Editor story={story} onChange={setStory} onBack={vi.fn()} />
    </>
  );
}

function currentStory(): Story {
  return JSON.parse(screen.getByTestId('story').textContent ?? '{}') as Story;
}

function sceneCount(): number {
  return Object.keys(currentStory().scenes).length;
}

describe('Editor', () => {
  it('opens on the start scene, with the story reported as consistent', () => {
    render(<Harness />);
    expect(screen.getByText('Récit cohérent')).toBeInTheDocument();
    expect(screen.getByLabelText('Panneau d’édition')).toHaveTextContent('Le sentier');
  });

  it('says a story is playable but unfinished rather than simply consistent', () => {
    render(<Harness />);
    // A fresh choice has no continuation: a warning, not an error.
    fireEvent.click(screen.getByRole('button', { name: '＋ Choix' }));

    expect(screen.queryByText('Récit cohérent')).toBeNull();
    expect(screen.getByText(/^Jouable · \d+ à revoir$/)).toBeInTheDocument();
    // Warnings never block the playtest — they are writing, not breakage.
    expect(screen.getByRole('button', { name: '▶ Playtest' })).toBeEnabled();
  });

  it('refuses to chain a kind the graph would refuse to be linked', () => {
    render(<Harness />);
    // `start` already points at choices: chaining a character node under it
    // would mix a decision with a continuation.
    expect(screen.getByRole('button', { name: '＋ Personnage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '＋ Choix' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Chercher dans les scènes'), {
      target: { value: 'Sans rien brusquer' },
    });
    fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);

    // `prudence` chains on by itself, so a character node is welcome and a
    // choice is not.
    expect(screen.getByRole('button', { name: '＋ Personnage' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '＋ Choix' })).toBeDisabled();
  });

  it('turns red and blocks the playtest on a blocking error', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Chercher dans les scènes'), {
      target: { value: 'c-lucioles' },
    });
    fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);

    // A choice without a label would display an empty button: unplayable.
    fireEvent.change(screen.getByLabelText('Libellé du bouton'), { target: { value: '' } });

    expect(screen.getByText(/1 erreur · injouable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▶ Playtest' })).toBeDisabled();
  });

  it('unfolds the validation list when the health badge is pressed', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Choix' }));

    fireEvent.click(screen.getByTitle('Voir le détail de la validation'));
    // In the list each anomaly is clickable: it selects the node it concerns.
    expect(screen.getByRole('button', { name: /n'a ni suite ni fin/ })).toBeInTheDocument();
  });

  it('adds a node in the wake of the selected one, link included', () => {
    render(<Harness />);
    const before = sceneCount();

    fireEvent.click(screen.getByRole('button', { name: '＋ Choix' }));

    const story = currentStory();
    expect(Object.keys(story.scenes)).toHaveLength(before + 1);
    // The link is born with its target: never a dangling one.
    expect(story.scenes.start?.next.some((link) => link.to.startsWith('choix'))).toBe(true);
  });

  it('takes an edit back, then puts it forward again (STU-7)', () => {
    render(<Harness />);
    const before = sceneCount();

    fireEvent.click(screen.getByRole('button', { name: '＋ Choix' }));
    expect(sceneCount()).toBe(before + 1);

    fireEvent.click(screen.getByLabelText('Annuler'));
    expect(sceneCount()).toBe(before);

    fireEvent.click(screen.getByLabelText('Rétablir'));
    expect(sceneCount()).toBe(before + 1);
  });

  it('groups the letters of a title into a single undo step', () => {
    render(<Harness />);
    const field = screen.getByLabelText('Titre de travail');

    fireEvent.change(field, { target: { value: 'Le senti' } });
    fireEvent.change(field, { target: { value: 'Le sentie' } });
    fireEvent.change(field, { target: { value: 'Le sentier bas' } });

    fireEvent.click(screen.getByLabelText('Annuler'));
    expect(currentStory().scenes.start?.title).toBe('Le sentier');
  });

  it('has nothing to undo before the first edit', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Annuler')).toBeDisabled();
    expect(screen.getByLabelText('Rétablir')).toBeDisabled();
  });

  it('finds a node by its text and selects it (STU-11)', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Chercher dans les scènes'), {
      target: { value: 'lucioles' },
    });

    const results = screen.getByRole('listbox');
    fireEvent.click(within(results).getAllByRole('option')[0]!);

    expect(screen.getByLabelText('Panneau d’édition')).toHaveTextContent('lucioles');
  });

  it('says so when the search finds nothing', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Chercher dans les scènes'), {
      target: { value: 'hippopotame' },
    });
    expect(screen.getByText('Aucun nœud ne correspond.')).toBeInTheDocument();
  });

  it('rearranges the graph without touching anything else (STU-9)', () => {
    render(<Harness />);
    const before = currentStory();

    fireEvent.click(screen.getByTitle('Ranger le graphe'));

    const after = currentStory();
    expect(Object.keys(after.scenes)).toEqual(Object.keys(before.scenes));
    expect(after.scenes.start?.position).not.toEqual(before.scenes.start?.position);
    expect(after.scenes.start?.title).toBe(before.scenes.start?.title);
  });

  it('opens the variables table, and closes it on a scene (STU-12)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'ƒ Variables' }));

    const sheet = screen.getByRole('dialog', { name: 'Variables du récit' });
    expect(within(sheet).getByText('Variables')).toBeInTheDocument();
    expect(within(sheet).getByText('prudent')).toBeInTheDocument();

    fireEvent.click(within(sheet).getAllByTitle(/^Ouvrir «/)[0]!);
    expect(screen.queryByRole('dialog', { name: 'Variables du récit' })).toBeNull();
  });

  it('offers to playtest from the selected node (STU-13)', () => {
    render(<Harness />);
    // A single node is selected on open, so "from here" has a starting point.
    expect(screen.getByRole('button', { name: '▶ D’ici' })).toBeEnabled();
  });

  it('folds the panel away when the graph needs the room', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTitle('Replier le panneau'));
    expect(screen.queryByLabelText('Panneau d’édition')).toBeNull();

    fireEvent.click(screen.getByTitle('Déplier le panneau'));
    expect(screen.getByLabelText('Panneau d’édition')).toBeInTheDocument();
  });

  it('reports the dead paths of a story that has none (STU-14)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '⌀ Chemins morts' }));
    expect(screen.getByText(/Aucun chemin mort/)).toBeInTheDocument();
  });

  it('names what the focus is lighting up', () => {
    render(<Harness />);
    expect(screen.getByText(/« Le sentier »/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '◎ Focus' }));
    expect(screen.queryByText(/« Le sentier »/)).toBeNull();
  });
});

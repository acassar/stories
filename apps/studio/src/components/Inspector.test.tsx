import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';
import type { SceneId, Story } from '@embranche/story-format';

import { Inspector } from './Inspector';

/**
 * The panel is controlled: it never holds the document. The harness plays the
 * editor, so a test can assert on what the story became rather than on props.
 */
function Harness({ selectedIds = ['start'] }: { selectedIds?: SceneId[] }) {
  const [story, setStory] = useState<Story>(() => structuredClone(clairiereStory));
  const [selection, setSelection] = useState<SceneId[]>(selectedIds);

  return (
    <>
      <output data-testid="story">{JSON.stringify(story)}</output>
      <output data-testid="selection">{selection.join(',')}</output>
      <Inspector
        story={story}
        selectedIds={selection}
        issues={validateStory(story).issues}
        onChange={setStory}
        onSelect={(id) => setSelection([id])}
        onDeleteSelection={vi.fn()}
        onDuplicateSelection={vi.fn()}
      />
    </>
  );
}

function currentStory(): Story {
  return JSON.parse(screen.getByTestId('story').textContent ?? '{}') as Story;
}

describe('Inspector', () => {
  it('edits the selected node, and only it', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Titre de travail'), {
      target: { value: 'Le sentier bas' },
    });
    expect(currentStory().scenes.start?.title).toBe('Le sentier bas');
  });

  it('renames the node id and repoints everything that targeted it (STU-8)', () => {
    render(<Harness selectedIds={['lucioles']} />);

    const field = screen.getByLabelText('Identifiant du nœud');
    fireEvent.change(field, { target: { value: 'la clairière' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }));

    const story = currentStory();
    expect(story.scenes['la-clairiere']).toBeDefined();
    expect(story.scenes.lucioles).toBeUndefined();
    expect(story.scenes['c-lucioles']?.next[0]?.to).toBe('la-clairiere');
    // The panel follows the node it just renamed.
    expect(screen.getByTestId('selection')).toHaveTextContent('la-clairiere');
  });

  it('refuses an id another node already carries', () => {
    render(<Harness selectedIds={['lucioles']} />);

    fireEvent.change(screen.getByLabelText('Identifiant du nœud'), { target: { value: 'start' } });
    expect(screen.getByText('« start » est déjà pris.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renommer' })).toBeDisabled();
    expect(currentStory().scenes.lucioles).toBeDefined();
  });

  it('declares the known variables once for the whole panel', () => {
    const { container } = render(<Harness selectedIds={['lucioles']} />);
    // A duplicated DOM id is a broken autocompletion, silently.
    expect(container.querySelectorAll('#emb-known-variables')).toHaveLength(1);
  });

  it('offers the bulk gestures rather than a form when several nodes are selected', () => {
    render(<Harness selectedIds={['start', 'lucioles']} />);

    expect(screen.getByText('2 nœuds sélectionnés')).toBeInTheDocument();
    expect(screen.queryByLabelText('Titre de travail')).toBeNull();
    expect(screen.getByRole('button', { name: 'Supprimer 2 nœuds' })).toBeInTheDocument();
  });

  it('falls back to the story metadata when nothing is selected', () => {
    render(<Harness selectedIds={[]} />);
    expect(screen.getByRole('tab', { name: 'Nœud' })).toBeDisabled();
    expect(screen.getByLabelText('Panneau d’édition')).toHaveTextContent('Le récit');
  });

  it('shows the button condition on a choice node, edited from the incoming link', () => {
    render(<Harness selectedIds={['c-elara']} />);
    const panel = screen.getByLabelText('Panneau d’édition');
    expect(within(panel).getByText('Quand ce bouton apparaît')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Variable')).toHaveValue('prudent');
  });

  it('cuts the incoming link from the choice it leads to', () => {
    render(<Harness selectedIds={['c-elara']} />);
    const source = clairiereStory.scenes.lucioles!;
    const link = source.next.find((item) => item.to === 'c-elara')!;

    fireEvent.click(
      screen.getByRole('button', { name: `Supprimer le lien depuis ${source.title}` }),
    );

    // The link is gone from the node that owned it; the choice itself stays.
    expect(currentStory().scenes.lucioles?.next.some((item) => item.id === link.id)).toBe(false);
    expect(currentStory().scenes['c-elara']).toBeDefined();
  });
});

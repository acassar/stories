import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { loadSave } from './lib/library';

/**
 * End-to-end walkthrough of the reader, on the `story-format` JSON shipped with
 * the app — the very file the studio exports.
 */
describe('Embranche reader', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function openClairiere(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await user.click(screen.getByRole('button', { name: /La Clairière aux Lucioles/ }));
    return screen.getByRole('heading', { name: 'La Clairière aux Lucioles' });
  }

  it('lists the library with the ending count', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Que vas-tu vivre/ })).toBeInTheDocument();
    const card = screen.getByRole('button', { name: /La Clairière aux Lucioles/ });
    expect(within(card).getByText('0/3 fins')).toBeInTheDocument();
  });

  it('opens the sheet of a story', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    expect(screen.getByText(/les lucioles t'invitent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commencer l’aventure' })).toBeInTheDocument();
  });

  it('plays a scene, a choice, then an ending', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));

    // The start scene arrives as a conversation.
    expect(await screen.findByText(/fougères plus hautes que toi/)).toBeInTheDocument();
    expect(screen.getByText('Elara')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Suivre les lucioles' }));
    expect(await screen.findByText(/porte de lumière/)).toBeInTheDocument();
    // The choice node sent its line, distinct from the button label, then the
    // story chained on its own to the fireflies.
    expect(screen.getByText('Je les suis.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Franchir le portail' }));
    expect(await screen.findByRole('heading', { name: 'Le Royaume Lumière' })).toBeInTheDocument();
    expect(screen.getByText('Fin lumineuse')).toBeInTheDocument();
    // Two buttons pressed: nodes walked through automatically do not count.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('only shows the conditional choice once its condition holds', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));

    // Direct path: Elara's shortcut does not exist.
    await user.click(screen.getByRole('button', { name: 'Suivre les lucioles' }));
    expect(await screen.findByText(/porte de lumière/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Demander à Elara/ })).not.toBeInTheDocument();

    // Cautious detour through the oak: the `prudent = true` condition is set.
    await user.click(screen.getByRole('button', { name: 'Revenir au choix précédent' }));
    await user.click(await screen.findByRole('button', { name: 'Grimper au vieux chêne' }));
    await user.click(await screen.findByRole('button', { name: 'Redescendre vers les lueurs' }));
    expect(await screen.findByRole('button', { name: /Demander à Elara/ })).toBeInTheDocument();
  });

  it('saves the progress and allows resuming', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));
    await user.click(screen.getByRole('button', { name: 'Grimper au vieux chêne' }));
    expect(await screen.findByText(/château flotte entre les nuages/)).toBeInTheDocument();

    // The save is written by the app, not by the engine.
    const saved = loadSave('clairiere-lucioles');
    expect(saved?.currentSceneId).toBe('arbre');

    // Back to the sheet: resuming is offered.
    await user.click(screen.getByRole('button', { name: 'Revenir au choix précédent' }));
    await user.click(
      await screen.findByRole('button', { name: /Retour à la fiche|Revenir au choix/ }),
    );
    const resume = await screen.findByRole('button', { name: 'Reprendre la partie' });
    expect(resume).toBeInTheDocument();
  });

  it('toggles light / dark', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Passer en mode nuit' }));
    expect(screen.getByRole('button', { name: 'Passer en mode jour' })).toBeInTheDocument();
    expect(window.localStorage.getItem('embranche.reader.mode')).toBe('dark');
  });
});

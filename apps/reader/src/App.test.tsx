import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { loadSave } from './lib/library';

/**
 * Both the layout and the pace of the messages are read from `matchMedia`.
 * Tests run on the phone, with the animation off, unless they say otherwise —
 * reading a scene should not mean driving timers.
 */
function setMedia({ wide = false, reducedMotion = true } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion')
        ? reducedMotion
        : wide && query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const widenViewport = () => setMedia({ wide: true });
const animateMessages = () => setMedia({ reducedMotion: false });
const resetMedia = () => setMedia();

/** Long enough for a whole scene to type itself out. */
const TYPED = { timeout: 8000 };

/**
 * End-to-end walkthrough of the reader, on the `story-format` JSON shipped with
 * the app — the very file the studio exports.
 */
describe('Embranche reader', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    resetMedia();
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

    // The last message of the story is a message like the others: it is read in
    // the conversation, and the ending screen is opened on purpose.
    expect(await screen.findByRole('button', { name: 'Voir la fin' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voir la fin' }));

    expect(await screen.findByRole('heading', { name: 'Le Royaume Lumière' })).toBeInTheDocument();
    expect(screen.getByText('Fin lumineuse')).toBeInTheDocument();
    // Two buttons pressed: nodes walked through automatically do not count.
    expect(screen.getByText('2')).toBeInTheDocument();

    // And the conversation is still there behind it.
    await user.click(screen.getByRole('button', { name: 'Relire la correspondance' }));
    expect(screen.getByText('Je les suis.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir la fin' })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Revenir en arrière/ }));
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

    // Leaving does not unwind what has been played: one press on the arrow
    // closes the story, and the run is still there to be picked up.
    await user.click(screen.getByRole('button', { name: 'Retour à la fiche du récit' }));
    const resume = await screen.findByRole('button', { name: 'Reprendre la partie' });
    expect(resume).toBeInTheDocument();
    expect(loadSave('clairiere-lucioles')?.currentSceneId).toBe('arbre');
  });

  it('reads on a wide screen, with the rail instead of the topbar', async () => {
    widenViewport();
    const user = userEvent.setup();
    render(<App />);

    // The rail carries the settings; the phone topbar is gone.
    expect(screen.getByRole('button', { name: 'Passer en mode nuit' })).toBeInTheDocument();
    expect(screen.getByText('Embranche')).toBeInTheDocument();

    // Same walkthrough as on the phone, right up to the ending.
    await user.click(screen.getByRole('button', { name: /La Clairière aux Lucioles/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));
    expect(await screen.findByText(/fougères plus hautes que toi/)).toBeInTheDocument();

    // Going back stays reachable without the right-hand panel of the mockup.
    await user.click(screen.getByRole('button', { name: 'Suivre les lucioles' }));
    expect(await screen.findByText(/porte de lumière/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Revenir en arrière/ }));
    expect(await screen.findByRole('button', { name: 'Suivre les lucioles' })).toBeInTheDocument();
  });

  it('offers the run in progress at the top of the library', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));
    await user.click(screen.getByRole('button', { name: 'Grimper au vieux chêne' }));
    expect(await screen.findByText(/château flotte entre les nuages/)).toBeInTheDocument();

    // Back to the library: the run comes first, with what it is worth so far.
    await user.click(screen.getByRole('button', { name: 'Retour à la fiche du récit' }));
    await user.click(await screen.findByRole('button', { name: 'Retour à la bibliothèque' }));

    const resume = await screen.findByRole('button', { name: /Reprendre la lecture/ });
    expect(resume).toHaveTextContent('La Clairière aux Lucioles');
    // One choice pressed, and French counts from two: "fait", not "faits".
    expect(resume).toHaveTextContent('1 choix fait · 0/3 fins');

    // It leads back to the story it belongs to.
    await user.click(resume);
    expect(screen.getByRole('heading', { name: 'La Clairière aux Lucioles' })).toBeInTheDocument();
  });

  it('picks a run up again without typing the scene out a second time', async () => {
    animateMessages();
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));

    // A scene being discovered arrives one message at a time.
    expect(screen.getByLabelText('En train d’écrire')).toBeInTheDocument();
    await screen.findByText(/fougères plus hautes que toi/, undefined, TYPED);

    await user.click(await screen.findByRole('button', { name: 'Suivre les lucioles' }, TYPED));
    await screen.findByText(/porte de lumière/, undefined, TYPED);

    // Leave, then pick the run up again.
    await user.click(screen.getByRole('button', { name: 'Retour à la fiche du récit' }));
    await user.click(await screen.findByRole('button', { name: 'Reprendre la partie' }));

    // The scene stopped on is already there, whole, and nobody is typing.
    expect(screen.getByText(/porte de lumière/)).toBeInTheDocument();
    expect(screen.queryByLabelText('En train d’écrire')).not.toBeInTheDocument();
    // This is the one test that waits on the real clock — two scenes typing
    // themselves out, some three seconds of deliberate silence. It needs room
    // to breathe on a build machine, which is slower than a desk and runs it
    // under coverage instrumentation on top.
  }, 30_000);

  it('removes a story, and everything played on it', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));
    await user.click(screen.getByRole('button', { name: 'Grimper au vieux chêne' }));
    await user.click(await screen.findByRole('button', { name: 'Retour à la fiche du récit' }));

    // It takes two presses: the first only asks.
    await user.click(screen.getByRole('button', { name: /Retirer ce récit/ }));
    expect(screen.queryByRole('heading', { name: /Que vas-tu vivre/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retirer définitivement' }));

    // Back in a library that no longer holds it, and neither does the storage.
    expect(await screen.findByRole('heading', { name: /Que vas-tu vivre/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /La Clairière aux Lucioles/ }),
    ).not.toBeInTheDocument();
    expect(loadSave('clairiere-lucioles')).toBeNull();

    // And it does not come back on the next visit.
    cleanup();
    render(<App />);
    expect(
      screen.queryByRole('button', { name: /La Clairière aux Lucioles/ }),
    ).not.toBeInTheDocument();
  });

  it('lets the reader change their mind before removing', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: /Retirer ce récit/ }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: /Retirer ce récit/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retirer définitivement' }),
    ).not.toBeInTheDocument();
  });

  it('toggles light / dark', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Passer en mode nuit' }));
    expect(screen.getByRole('button', { name: 'Passer en mode jour' })).toBeInTheDocument();
    expect(window.localStorage.getItem('embranche.reader.mode')).toBe('dark');
  });
});

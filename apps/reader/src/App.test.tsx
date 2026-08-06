import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { loadSave } from './lib/library';

/**
 * Parcours de bout en bout du lecteur, sur le JSON `story-format` livre avec
 * l'app — celui-la meme que le studio exporte.
 */
describe('Lecteur Embranche', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function openClairiere(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await user.click(screen.getByRole('button', { name: /La Clairière aux Lucioles/ }));
    return screen.getByRole('heading', { name: 'La Clairière aux Lucioles' });
  }

  it('liste la bibliotheque avec le compte de fins', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Que vas-tu vivre/ })).toBeInTheDocument();
    const card = screen.getByRole('button', { name: /La Clairière aux Lucioles/ });
    expect(within(card).getByText('0/3 fins')).toBeInTheDocument();
  });

  it('ouvre la fiche d’un recit', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    expect(screen.getByText(/les lucioles t'invitent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commencer l’aventure' })).toBeInTheDocument();
  });

  it('joue une scene, un choix, puis une fin', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));

    // La scene de depart arrive en correspondance.
    expect(await screen.findByText(/fougères plus hautes que toi/)).toBeInTheDocument();
    expect(screen.getByText('Elara')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Suivre les lucioles' }));
    expect(await screen.findByText(/porte de lumière/)).toBeInTheDocument();
    // Le noeud de choix a envoye sa replique, distincte du libelle du bouton,
    // puis le recit a enchaine seul jusqu'aux lucioles.
    expect(screen.getByText('Je les suis.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Franchir le portail' }));
    expect(await screen.findByRole('heading', { name: 'Le Royaume Lumière' })).toBeInTheDocument();
    expect(screen.getByText('Fin lumineuse')).toBeInTheDocument();
    // Deux boutons pressés : les nœuds traversés seuls ne comptent pas.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('n’affiche le choix conditionnel qu’une fois sa condition remplie', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));

    // Chemin direct : le raccourci d'Elara n'existe pas.
    await user.click(screen.getByRole('button', { name: 'Suivre les lucioles' }));
    expect(await screen.findByText(/porte de lumière/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Demander à Elara/ })).not.toBeInTheDocument();

    // Detour prudent par le chene : la condition `prudent = true` est posee.
    await user.click(screen.getByRole('button', { name: 'Revenir au choix précédent' }));
    await user.click(await screen.findByRole('button', { name: 'Grimper au vieux chêne' }));
    await user.click(await screen.findByRole('button', { name: 'Redescendre vers les lueurs' }));
    expect(await screen.findByRole('button', { name: /Demander à Elara/ })).toBeInTheDocument();
  });

  it('sauvegarde la progression et permet de reprendre', async () => {
    const user = userEvent.setup();
    await openClairiere(user);
    await user.click(screen.getByRole('button', { name: 'Commencer l’aventure' }));
    await user.click(screen.getByRole('button', { name: 'Grimper au vieux chêne' }));
    expect(await screen.findByText(/château flotte entre les nuages/)).toBeInTheDocument();

    // La sauvegarde est ecrite par l'app, pas par le moteur.
    const saved = loadSave('clairiere-lucioles');
    expect(saved?.currentSceneId).toBe('arbre');

    // Retour a la fiche : la reprise est proposee.
    await user.click(screen.getByRole('button', { name: 'Revenir au choix précédent' }));
    await user.click(
      await screen.findByRole('button', { name: /Retour à la fiche|Revenir au choix/ }),
    );
    const resume = await screen.findByRole('button', { name: 'Reprendre la partie' });
    expect(resume).toBeInTheDocument();
  });

  it('bascule jour / nuit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Passer en mode nuit' }));
    expect(screen.getByRole('button', { name: 'Passer en mode jour' })).toBeInTheDocument();
    expect(window.localStorage.getItem('embranche.reader.mode')).toBe('dark');
  });
});

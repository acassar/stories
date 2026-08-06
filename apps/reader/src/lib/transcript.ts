/**
 * Construction de la correspondance.
 *
 * Le lecteur n'a qu'un seul format de lecture : chaque bloc de texte d'un noeud
 * traverse arrive comme un message. Depuis le format 2, la replique du joueur
 * n'est plus un cas special — c'est un noeud comme un autre, dont le type dit
 * de quel cote afficher la bulle. Fonction pure, donc directement testable.
 */

import { sceneMessages, speakerOf } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';
import type { ResolvedScene } from '@embranche/story-engine';

export interface Message {
  /** Cle stable : deux messages identiques a deux moments differents coexistent. */
  key: string;
  text: string;
  fromPlayer: boolean;
}

export interface TranscriptOptions {
  /**
   * Nombre de messages deja reveles pour la scene courante. Les precedents,
   * eux, sont toujours affiches en entier.
   */
  revealed: number;
}

export function buildTranscript(
  story: Story,
  state: GameState,
  scene: ResolvedScene,
  { revealed }: TranscriptOptions,
): Message[] {
  const messages: Message[] = [];

  state.history.forEach((entry, step) => {
    const past = story.scenes[entry.sceneId];
    if (!past) return;
    const fromPlayer = speakerOf(past) === 'player';
    sceneMessages(past).forEach((block, index) => {
      messages.push({ key: `${step}-${entry.sceneId}-${index}`, text: block.text, fromPlayer });
    });
  });

  // Seul le noeud courant est soumis a la revelation progressive : les
  // precedents sont deja arrives.
  scene.blocks.slice(0, revealed).forEach((block, index) => {
    messages.push({
      key: `now-${scene.id}-${index}`,
      text: block.text,
      fromPlayer: scene.speaker === 'player',
    });
  });

  return messages;
}

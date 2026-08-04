/**
 * Construction de la correspondance.
 *
 * Le lecteur n'a qu'un seul format de lecture : chaque bloc de texte d'une
 * scene arrive comme un message, et le libelle du choix retenu devient la
 * replique du joueur. Fonction pure, donc directement testable.
 */

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
    (past?.blocks ?? []).forEach((block, index) => {
      messages.push({
        key: `${step}-${entry.sceneId}-${index}`,
        text: block.text,
        fromPlayer: block.speaker === 'player',
      });
    });
    messages.push({ key: `${step}-reply`, text: entry.label, fromPlayer: true });
  });

  scene.blocks.slice(0, revealed).forEach((block, index) => {
    messages.push({
      key: `now-${scene.id}-${index}`,
      text: block.text,
      fromPlayer: block.speaker === 'player',
    });
  });

  return messages;
}

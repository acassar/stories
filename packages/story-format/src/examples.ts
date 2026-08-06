/**
 * Sample stories — the reader's starting library and the test sandbox.
 *
 * They are written to cover every shape of the graph: branching (`npc` →
 * several `choice`), automatic chaining (`choice` → `player`, `npc` → `npc`),
 * several paths converging on one node, conditional links and effects. What
 * breaks here breaks the format.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Story } from './types.js';

export const clairiereStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'clairiere-lucioles',
  title: 'La Clairière aux Lucioles',
  version: '2.0.0',
  author: 'Camille Roy',
  tag: 'Fantastique',
  theme: 'fantasy',
  estimatedMinutes: 7,
  status: 'published',
  blurb:
    "Une nuit, la forêt derrière chez toi s'illumine. Les lucioles t'invitent à franchir un seuil que personne n'a jamais osé passer.",
  narrator: { name: 'Elara', status: 'la voix de la clairière' },
  startSceneId: 'start',
  variables: { prudent: false },
  scenes: {
    start: {
      id: 'start',
      kind: 'npc',
      title: 'Le sentier',
      position: { x: 400, y: 0 },
      blocks: [
        { text: "Le sentier s'enfonce sous les fougères plus hautes que toi." },
        {
          text: "Devant, deux lueurs t'appellent — l'une vers le sol, l'autre vers la cime. Laquelle suis-tu ?",
        },
      ],
      next: [
        { id: 'vers-lucioles', to: 'c-lucioles' },
        { id: 'vers-arbre', to: 'c-arbre' },
      ],
    },
    'c-lucioles': {
      id: 'c-lucioles',
      kind: 'choice',
      title: 'Suivre les lucioles',
      label: 'Suivre les lucioles',
      position: { x: 190, y: 160 },
      blocks: [{ text: 'Je les suis.' }],
      next: [{ id: 'suite', to: 'lucioles' }],
    },
    'c-arbre': {
      id: 'c-arbre',
      kind: 'choice',
      title: 'Grimper au chêne',
      label: 'Grimper au vieux chêne',
      position: { x: 620, y: 160 },
      blocks: [{ text: "Je grimpe. J'ai besoin de voir d'en haut." }],
      next: [{ id: 'suite', to: 'arbre' }],
    },

    lucioles: {
      id: 'lucioles',
      kind: 'npc',
      title: 'Les lucioles',
      position: { x: 190, y: 310 },
      blocks: [
        { text: "Les lucioles s'assemblent." },
        {
          text: "Elles forment une porte de lumière qui palpite doucement, comme un cœur qui t'attend.",
        },
      ],
      next: [
        { id: 'vers-franchir', to: 'c-franchir' },
        { id: 'vers-attendre', to: 'c-attendre' },
        {
          // Only shows for a player who went up to the oak and came back down:
          // the cautious detour earns a shortcut.
          id: 'vers-elara',
          to: 'c-elara',
          condition: { op: 'eq', variable: 'prudent', value: true },
        },
      ],
    },
    'c-franchir': {
      id: 'c-franchir',
      kind: 'choice',
      title: 'Franchir',
      label: 'Franchir le portail',
      position: { x: 60, y: 470 },
      blocks: [{ text: "J'y vais." }],
      next: [{ id: 'suite', to: 'portail' }],
    },
    'c-attendre': {
      id: 'c-attendre',
      kind: 'choice',
      title: 'Attendre',
      label: "Attendre l'aube, prudent",
      position: { x: 300, y: 470 },
      blocks: [{ text: "J'attends l'aube." }],
      next: [{ id: 'suite', to: 'attente' }],
    },
    'c-elara': {
      id: 'c-elara',
      kind: 'choice',
      title: 'Demander à Elara',
      label: "Demander à Elara de t'ouvrir la voie",
      position: { x: 60, y: 610 },
      blocks: [{ text: 'Elara. Ouvre-moi.' }],
      next: [{ id: 'suite', to: 'portail' }],
    },

    arbre: {
      id: 'arbre',
      kind: 'npc',
      title: 'Le grand chêne',
      position: { x: 620, y: 310 },
      blocks: [
        { text: 'Du haut du vieux chêne, un château flotte entre les nuages.' },
        { text: "Ses fenêtres sont allumées, comme s'il t'attendait." },
      ],
      next: [
        { id: 'vers-sauter', to: 'c-sauter' },
        {
          id: 'vers-redescendre',
          to: 'c-redescendre',
          effects: [{ op: 'set', variable: 'prudent', value: true }],
        },
      ],
    },
    'c-sauter': {
      id: 'c-sauter',
      kind: 'choice',
      title: 'Sauter',
      label: 'Sauter vers le château',
      position: { x: 760, y: 470 },
      blocks: [{ text: 'Je saute.' }],
      next: [{ id: 'suite', to: 'chateau' }],
    },
    'c-redescendre': {
      id: 'c-redescendre',
      kind: 'choice',
      title: 'Redescendre',
      label: 'Redescendre vers les lueurs',
      position: { x: 520, y: 470 },
      blocks: [{ text: 'Non. Je redescends.' }],
      next: [{ id: 'suite', to: 'prudence' }],
    },
    // A player node that asks for nothing: the player speaks, then the story
    // reaches an already written scene on its own, without a choice.
    prudence: {
      id: 'prudence',
      kind: 'player',
      title: 'Sans rien brusquer',
      position: { x: 400, y: 620 },
      blocks: [{ text: 'Je préfère ne rien brusquer. Pas cette nuit.' }],
      next: [{ id: 'retour-lucioles', to: 'lucioles' }],
    },

    portail: {
      id: 'portail',
      kind: 'npc',
      title: 'Le Royaume Lumière',
      position: { x: 60, y: 760 },
      blocks: [
        { text: 'Tu franchis le seuil.' },
        { text: "La forêt te couronne gardien de l'aube." },
      ],
      next: [],
      ending: {
        type: 'Fin lumineuse',
        name: 'Le Royaume Lumière',
        blurb: "Tu franchis le seuil et la forêt te couronne gardien de l'aube.",
      },
    },
    attente: {
      id: 'attente',
      kind: 'npc',
      title: 'La Nuit Sans Fin',
      position: { x: 300, y: 760 },
      blocks: [
        { text: "Tu t'endors près des lucioles…" },
        { text: 'et la forêt te garde, paisible, pour toujours.' },
      ],
      next: [],
      ending: {
        type: 'Fin paisible',
        name: 'La Nuit Sans Fin',
        blurb: "Tu t'endors près des lucioles… et la forêt te garde, paisible, pour toujours.",
      },
    },
    chateau: {
      id: 'chateau',
      kind: 'npc',
      title: 'Le Château des Nues',
      position: { x: 780, y: 620 },
      blocks: [
        { text: "D'un bond, tu rejoins les nuages." },
        { text: "Une cité oubliée n'attendait que toi." },
      ],
      next: [],
      ending: {
        type: 'Fin lumineuse',
        name: 'Le Château des Nues',
        blurb:
          "D'un bond, tu rejoins les nuages et découvres une cité oubliée qui n'attendait que toi.",
      },
    },
  },
};

export const verlaineStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'dossier-verlaine',
  title: 'Le Dossier Verlaine',
  version: '2.0.0',
  author: 'Inès Marchal',
  tag: 'Enquête',
  theme: 'mystery',
  estimatedMinutes: 9,
  status: 'published',
  blurb:
    "3h12. Le commissariat dort. Sur le bureau du chef, un dossier rouge entrouvert — et une affaire qu'on t'avait formellement interdit de toucher.",
  narrator: { name: 'Renard', status: 'informateur' },
  startSceneId: 'start',
  scenes: {
    start: {
      id: 'start',
      kind: 'npc',
      title: 'Le bureau',
      position: { x: 400, y: 0 },
      blocks: [
        { text: 'Le bureau du commissaire est désert.' },
        { text: 'Sur la table : un dossier rouge entrouvert, un tiroir mal fermé.' },
      ],
      next: [
        { id: 'vers-lire', to: 'c-lire' },
        { id: 'vers-fouiller', to: 'c-fouiller' },
      ],
    },
    'c-lire': {
      id: 'c-lire',
      kind: 'choice',
      title: 'Lire le dossier',
      label: 'Lire le dossier',
      position: { x: 190, y: 160 },
      blocks: [{ text: "J'ouvre le dossier." }],
      next: [{ id: 'suite', to: 'dossier' }],
    },
    'c-fouiller': {
      id: 'c-fouiller',
      kind: 'choice',
      title: 'Fouiller le tiroir',
      label: 'Fouiller le tiroir',
      position: { x: 620, y: 160 },
      blocks: [{ text: 'Le tiroir, d’abord.' }],
      next: [{ id: 'suite', to: 'tiroir' }],
    },

    dossier: {
      id: 'dossier',
      kind: 'npc',
      title: 'Le dossier rouge',
      position: { x: 190, y: 310 },
      blocks: [
        { text: 'Une photo manque, arrachée.' },
        { text: 'À sa place, une adresse griffonnée à la hâte : quai 7, minuit.' },
      ],
      next: [
        { id: 'vers-secretaire', to: 'c-secretaire' },
        { id: 'vers-quai', to: 'c-quai' },
      ],
    },
    'c-secretaire': {
      id: 'c-secretaire',
      kind: 'choice',
      title: 'La secrétaire',
      label: 'Interroger la secrétaire',
      position: { x: 60, y: 470 },
      blocks: [{ text: 'Elle sait quelque chose. Je vais la voir.' }],
      next: [{ id: 'suite', to: 'secretaire' }],
    },
    'c-quai': {
      id: 'c-quai',
      kind: 'choice',
      title: 'Le quai 7',
      label: 'Filer au quai 7',
      position: { x: 300, y: 470 },
      blocks: [{ text: 'Quai 7. Tout de suite.' }],
      next: [{ id: 'suite', to: 'port' }],
    },

    tiroir: {
      id: 'tiroir',
      kind: 'npc',
      title: 'Le tiroir',
      position: { x: 620, y: 310 },
      blocks: [
        { text: 'Dans le tiroir : un revolver encore tiède.' },
        { text: 'Et un billet de train pour Le Havre, ce matin.' },
      ],
      next: [
        { id: 'vers-renforts', to: 'c-renforts' },
        { id: 'vers-seul', to: 'c-seul' },
      ],
    },
    'c-renforts': {
      id: 'c-renforts',
      kind: 'choice',
      title: 'Des renforts',
      label: 'Appeler des renforts',
      position: { x: 760, y: 470 },
      blocks: [{ text: "J'appelle. Je ne fais pas ça seul." }],
      next: [{ id: 'suite', to: 'renfort' }],
    },
    'c-seul': {
      id: 'c-seul',
      kind: 'choice',
      title: 'Continuer seul',
      label: 'Continuer seul',
      position: { x: 520, y: 470 },
      blocks: [{ text: 'Personne. Je continue seul.' }],
      // Two very different paths converge on the same quay.
      next: [{ id: 'suite', to: 'port' }],
    },

    port: {
      id: 'port',
      kind: 'npc',
      title: 'L’Aube au Quai 7',
      position: { x: 400, y: 630 },
      blocks: [
        { text: "Au petit jour, l'ombre que tu suivais se retourne." },
        { text: 'Tu avais raison depuis le début.' },
      ],
      next: [],
      ending: {
        type: 'Affaire élucidée',
        name: 'L’Aube au Quai 7',
        blurb:
          "Au petit jour, l'ombre que tu suivais se retourne. Tu avais raison depuis le début.",
      },
    },
    secretaire: {
      id: 'secretaire',
      kind: 'npc',
      title: 'L’Aveu',
      position: { x: 60, y: 630 },
      blocks: [
        { text: 'La secrétaire baisse les yeux.' },
        { text: 'Sa confession vaut tous les mandats du monde.' },
      ],
      next: [],
      ending: {
        type: 'Affaire élucidée',
        name: 'L’Aveu',
        blurb: 'La secrétaire baisse les yeux. Sa confession vaut tous les mandats du monde.',
      },
    },
    renfort: {
      id: 'renfort',
      kind: 'npc',
      title: 'Le Protocole',
      position: { x: 780, y: 630 },
      blocks: [
        { text: 'Tu as suivi les règles.' },
        { text: "L'affaire est bouclée — proprement, mais sans toi au cœur de la légende." },
      ],
      next: [],
      ending: {
        type: 'Fin prudente',
        name: 'Le Protocole',
        blurb:
          "Tu as suivi les règles. L'affaire est bouclée — proprement, mais sans toi au cœur de la légende.",
      },
    },
  },
};

export const cimesStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'appel-des-cimes',
  title: "L'Appel des Cimes",
  version: '1.0.0',
  author: 'Théo Lenoir',
  tag: 'Aventure',
  theme: 'adventure',
  estimatedMinutes: 6,
  status: 'draft',
  blurb:
    'Camp de base, 5h du matin. Le sommet est là, à portée. Mais la météo se referme, et chaque minute compte.',
  narrator: { name: 'Aïcha', status: 'ta cordée' },
  startSceneId: 'start',
  scenes: {
    start: {
      id: 'start',
      kind: 'npc',
      title: 'Le camp de base',
      position: { x: 400, y: 0 },
      blocks: [
        { text: 'La tempête gronde au loin.' },
        { text: "La fenêtre météo se referme. C'est maintenant ou jamais." },
      ],
      next: [
        { id: 'vers-tenter', to: 'c-tenter' },
        { id: 'vers-attendre', to: 'c-attendre' },
      ],
    },
    'c-tenter': {
      id: 'c-tenter',
      kind: 'choice',
      title: 'Tenter',
      label: 'Tenter le sommet',
      position: { x: 620, y: 160 },
      blocks: [{ text: 'On y va. Maintenant.' }],
      next: [{ id: 'suite', to: 'sommet' }],
    },
    'c-attendre': {
      id: 'c-attendre',
      kind: 'choice',
      title: 'Attendre',
      label: 'Attendre une accalmie',
      position: { x: 180, y: 160 },
      blocks: [{ text: 'On attend. La montagne ne bouge pas.' }],
      next: [{ id: 'suite', to: 'accalmie' }],
    },

    sommet: {
      id: 'sommet',
      kind: 'npc',
      title: 'La crevasse',
      position: { x: 620, y: 310 },
      blocks: [
        { text: 'À deux cents mètres du sommet, une crevasse barre la voie.' },
        { text: 'Le vent hurle.' },
      ],
      next: [
        { id: 'vers-contourner', to: 'c-contourner' },
        { id: 'vers-forcer', to: 'c-forcer' },
      ],
    },
    'c-contourner': {
      id: 'c-contourner',
      kind: 'choice',
      title: 'Contourner',
      label: 'La contourner, patient',
      position: { x: 500, y: 470 },
      blocks: [{ text: 'On la contourne. On a le temps.' }],
      next: [{ id: 'suite', to: 'gloire' }],
    },
    'c-forcer': {
      id: 'c-forcer',
      kind: 'choice',
      title: 'Forcer',
      label: 'Forcer le passage',
      position: { x: 740, y: 470 },
      blocks: [{ text: 'On passe. Droit devant.' }],
      next: [{ id: 'suite', to: 'chute' }],
    },

    accalmie: {
      id: 'accalmie',
      kind: 'npc',
      title: "L'accalmie",
      position: { x: 180, y: 310 },
      blocks: [
        { text: 'Tu patientes.' },
        { text: 'Le ciel se dégage enfin… mais la lumière baisse déjà.' },
      ],
      next: [
        { id: 'vers-repartir', to: 'c-repartir' },
        { id: 'vers-redescendre', to: 'c-redescendre' },
      ],
    },
    'c-repartir': {
      id: 'c-repartir',
      kind: 'choice',
      title: 'Repartir',
      label: 'Repartir vers le sommet',
      position: { x: 380, y: 470 },
      // Reaches an already visited scene: the graph is not a tree.
      blocks: [{ text: 'On repart. Le sommet nous attend.' }],
      next: [{ id: 'suite', to: 'sommet' }],
    },
    'c-redescendre': {
      id: 'c-redescendre',
      kind: 'choice',
      title: 'Redescendre',
      label: 'Redescendre, sage',
      position: { x: 120, y: 470 },
      blocks: [{ text: 'On redescend.' }],
      next: [{ id: 'suite', to: 'sage' }],
    },

    gloire: {
      id: 'gloire',
      kind: 'npc',
      title: 'Le Toit du Monde',
      position: { x: 500, y: 630 },
      blocks: [
        { text: 'Le sommet est à toi.' },
        { text: "Le monde entier s'étend sous tes crampons." },
      ],
      next: [],
      ending: {
        type: 'Fin triomphale',
        name: 'Le Toit du Monde',
        blurb: "Le sommet est à toi. Le monde entier s'étend sous tes crampons.",
      },
    },
    chute: {
      id: 'chute',
      kind: 'npc',
      title: 'La Crevasse',
      position: { x: 760, y: 630 },
      blocks: [
        { text: 'La glace cède.' },
        { text: "La montagne, elle, ne pardonne pas l'impatience." },
      ],
      next: [],
      ending: {
        type: 'Fin tragique',
        name: 'La Crevasse',
        blurb: "La glace cède. La montagne, elle, ne pardonne pas l'impatience.",
      },
    },
    sage: {
      id: 'sage',
      kind: 'npc',
      title: 'Le Retour du Sage',
      position: { x: 100, y: 630 },
      blocks: [
        { text: 'Tu redescends.' },
        { text: 'Le sommet attendra — et toi, tu seras encore là pour le gravir.' },
      ],
      next: [],
      ending: {
        type: 'Fin sereine',
        name: 'Le Retour du Sage',
        blurb: 'Tu redescends. Le sommet attendra — et toi, tu seras encore là pour le gravir.',
      },
    },
  },
};

export const inconnuStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'numero-inconnu',
  title: 'Numéro Inconnu',
  version: '2.0.0',
  author: 'Sacha Vidal',
  tag: 'Dialogue',
  theme: 'night',
  estimatedMinutes: 5,
  status: 'published',
  blurb:
    "Minuit passé. Ton téléphone vibre : un numéro masqué. Quelqu'un sait des choses sur toi — et n'a pas l'intention de raccrocher.",
  narrator: { name: 'Numéro inconnu', status: 'en ligne' },
  startSceneId: 'start',
  scenes: {
    start: {
      id: 'start',
      kind: 'npc',
      title: 'Minuit',
      position: { x: 400, y: 0 },
      blocks: [
        { text: 'Allô ? Tu es réveillé ?' },
        { text: "Il faut que je te parle. C'est important." },
        { text: "Ne raccroche pas, d'accord ?" },
      ],
      next: [
        { id: 'vers-qui', to: 'c-qui' },
        { id: 'vers-trompe', to: 'c-trompe' },
      ],
    },
    'c-qui': {
      id: 'c-qui',
      kind: 'choice',
      title: 'Qui êtes-vous ?',
      label: 'Qui êtes-vous ?',
      position: { x: 200, y: 160 },
      blocks: [{ text: 'Qui êtes-vous ?' }],
      next: [{ id: 'suite', to: 'qui' }],
    },
    'c-trompe': {
      id: 'c-trompe',
      kind: 'choice',
      title: 'Mauvais numéro',
      label: 'Vous vous trompez de numéro.',
      position: { x: 620, y: 160 },
      blocks: [{ text: 'Vous vous trompez de numéro.' }],
      next: [{ id: 'suite', to: 'trompe' }],
    },

    qui: {
      id: 'qui',
      kind: 'npc',
      title: 'Je te connais',
      position: { x: 200, y: 310 },
      blocks: [
        { text: 'Disons que je te connais mieux que tu ne le crois.' },
        { text: 'Regarde par ta fenêtre.' },
      ],
      next: [
        { id: 'vers-regarde', to: 'c-regarde' },
        { id: 'vers-blague', to: 'c-blague' },
      ],
    },
    trompe: {
      id: 'trompe',
      kind: 'npc',
      title: 'Non, c’est bien toi',
      position: { x: 620, y: 310 },
      blocks: [
        { text: "Non. C'est bien à toi que je parle, Alex." },
        { text: 'Et le temps presse.' },
      ],
      next: [
        { id: 'vers-mon-nom', to: 'c-mon-nom' },
        { id: 'vers-raccroche', to: 'c-raccroche' },
      ],
    },
    'c-mon-nom': {
      id: 'c-mon-nom',
      kind: 'choice',
      title: 'Mon nom',
      label: 'Comment connaissez-vous mon nom ?',
      position: { x: 460, y: 460 },
      blocks: [{ text: 'Comment connaissez-vous mon nom ?' }],
      next: [{ id: 'suite', to: 'qui' }],
    },
    'c-raccroche': {
      id: 'c-raccroche',
      kind: 'choice',
      title: 'Raccrocher',
      label: 'Je raccroche.',
      position: { x: 720, y: 460 },
      blocks: [{ text: 'Je raccroche.' }],
      next: [{ id: 'suite', to: 'raccroche' }],
    },
    'c-regarde': {
      id: 'c-regarde',
      kind: 'choice',
      title: 'Regarder',
      label: 'Je regarde…',
      position: { x: 80, y: 460 },
      blocks: [{ text: 'Je regarde…' }],
      next: [{ id: 'suite', to: 'fenetre' }],
    },
    'c-blague': {
      id: 'c-blague',
      kind: 'choice',
      title: 'Une blague',
      label: "C'est une blague ?",
      position: { x: 260, y: 460 },
      blocks: [{ text: "C'est une blague ?" }],
      next: [{ id: 'suite', to: 'blague' }],
    },

    blague: {
      id: 'blague',
      kind: 'npc',
      title: 'Tic. Tac.',
      position: { x: 260, y: 600 },
      blocks: [{ text: "Ce n'est pas une blague." }, { text: 'Tic. Tac.' }],
      next: [
        { id: 'vers-finalement', to: 'c-finalement' },
        { id: 'vers-bonne-nuit', to: 'c-bonne-nuit' },
      ],
    },
    'c-finalement': {
      id: 'c-finalement',
      kind: 'choice',
      title: 'Finalement…',
      label: '…je regarde par la fenêtre.',
      position: { x: 180, y: 750 },
      blocks: [{ text: '…bon. Je regarde.' }],
      next: [{ id: 'suite', to: 'fenetre' }],
    },
    'c-bonne-nuit': {
      id: 'c-bonne-nuit',
      kind: 'choice',
      title: 'Bonne nuit',
      label: 'Bonne nuit.',
      position: { x: 420, y: 750 },
      blocks: [{ text: 'Bonne nuit.' }],
      next: [{ id: 'suite', to: 'raccroche' }],
    },

    fenetre: {
      id: 'fenetre',
      kind: 'npc',
      title: 'La voiture grise',
      position: { x: 0, y: 620 },
      blocks: [{ text: 'Tu la vois, la voiture grise en bas ?' }],
      // npc → npc chaining: what follows arrives without the player acting.
      next: [{ id: 'suite', to: 'monte' }],
    },
    monte: {
      id: 'monte',
      kind: 'npc',
      title: 'Monte',
      position: { x: 0, y: 760 },
      blocks: [{ text: 'Monte. Maintenant.' }, { text: "Je t'expliquerai tout." }],
      next: [
        { id: 'vers-jy-vais', to: 'c-jy-vais' },
        { id: 'vers-refus', to: 'c-refus' },
      ],
    },
    'c-jy-vais': {
      id: 'c-jy-vais',
      kind: 'choice',
      title: 'J’y vais',
      label: "J'y vais.",
      position: { x: -80, y: 910 },
      blocks: [{ text: "J'y vais." }],
      next: [{ id: 'suite', to: 'descente' }],
    },
    // A line from the player, then the story takes over on its own.
    descente: {
      id: 'descente',
      kind: 'player',
      title: 'La cage d’escalier',
      position: { x: -80, y: 1050 },
      blocks: [{ text: "J'attrape mes clés. L'escalier. Quatre étages." }],
      next: [{ id: 'suite', to: 'voiture' }],
    },
    'c-refus': {
      id: 'c-refus',
      kind: 'choice',
      title: 'Refuser',
      label: 'Pas question.',
      position: { x: 160, y: 910 },
      blocks: [{ text: 'Pas question.' }],
      next: [{ id: 'suite', to: 'refus' }],
    },

    raccroche: {
      id: 'raccroche',
      kind: 'npc',
      title: 'Silence Radio',
      position: { x: 600, y: 900 },
      blocks: [{ text: '…' }],
      next: [],
      ending: {
        type: 'Fin silencieuse',
        name: 'Silence Radio',
        blurb:
          "Tu poses le téléphone. Au matin, plus aucune trace de l'appel. Tu ne sauras jamais.",
      },
    },
    voiture: {
      id: 'voiture',
      kind: 'npc',
      title: 'Le Rendez-vous',
      position: { x: -80, y: 1190 },
      blocks: [{ text: 'La portière claque.' }],
      next: [],
      ending: {
        type: 'Fin trouble',
        name: 'Le Rendez-vous',
        blurb: 'La portière claque. La ville défile. Ta vraie histoire, elle, commence à peine.',
      },
    },
    refus: {
      id: 'refus',
      kind: 'npc',
      title: 'La Porte Close',
      position: { x: 160, y: 1050 },
      blocks: [{ text: "Le moteur s'éteint." }],
      next: [],
      ending: {
        type: 'Fin sombre',
        name: 'La Porte Close',
        blurb:
          "Tu refermes le rideau. Dehors, le moteur s'éteint — et quelque chose d'autre avec lui.",
      },
    },
  },
};

/** Library shipped with the app. */
export const exampleStories: Story[] = [clairiereStory, verlaineStory, cimesStory, inconnuStory];

/** Reference story for the tests and for the first launch. */
export const exampleStory = clairiereStory;

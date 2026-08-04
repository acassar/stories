/**
 * Recits d'exemple — bibliotheque de depart du lecteur et bac a sable des
 * tests. Le contenu reprend la maquette Embranche ; « La Clairiere aux
 * Lucioles » a ete augmentee d'une variable et d'un choix conditionnel, pour
 * exercer cette partie du moteur de bout en bout.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Story } from './types.js';

export const clairiereStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'clairiere-lucioles',
  title: 'La Clairière aux Lucioles',
  version: '1.0.0',
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
      title: 'Le sentier',
      position: { x: 400, y: 26 },
      blocks: [
        { text: "Le sentier s'enfonce sous les fougères plus hautes que toi." },
        { text: "Devant, deux lueurs t'appellent — l'une vers le sol, l'autre vers la cime. Laquelle suis-tu ?" },
      ],
      choices: [
        { id: 'vers-lucioles', label: 'Suivre les lucioles', target: 'lucioles' },
        { id: 'vers-arbre', label: 'Grimper au vieux chêne', target: 'arbre' },
      ],
    },
    lucioles: {
      id: 'lucioles',
      title: 'Les lucioles',
      position: { x: 170, y: 220 },
      blocks: [
        { text: "Les lucioles s'assemblent." },
        { text: "Elles forment une porte de lumière qui palpite doucement, comme un cœur qui t'attend." },
      ],
      choices: [
        { id: 'franchir', label: 'Franchir le portail', target: 'portail' },
        { id: 'attendre', label: "Attendre l'aube, prudent", target: 'attente' },
        {
          // N'apparait qu'au joueur qui est passe par le chene puis redescendu :
          // le detour prudent lui vaut un raccourci.
          id: 'demander-elara',
          label: "Demander à Elara de t'ouvrir la voie",
          target: 'portail',
          condition: { op: 'eq', variable: 'prudent', value: true },
        },
      ],
    },
    arbre: {
      id: 'arbre',
      title: 'Le grand chêne',
      position: { x: 640, y: 220 },
      blocks: [
        { text: 'Du haut du vieux chêne, un château flotte entre les nuages.' },
        { text: "Ses fenêtres sont allumées, comme s'il t'attendait." },
      ],
      choices: [
        { id: 'sauter', label: 'Sauter vers le château', target: 'chateau' },
        {
          id: 'redescendre',
          label: 'Redescendre vers les lueurs',
          target: 'lucioles',
          effects: [{ op: 'set', variable: 'prudent', value: true }],
        },
      ],
    },
    portail: {
      id: 'portail',
      title: 'Le Royaume Lumière',
      position: { x: 70, y: 420 },
      blocks: [{ text: 'Tu franchis le seuil.' }, { text: "La forêt te couronne gardien de l'aube." }],
      choices: [],
      ending: {
        type: 'Fin lumineuse',
        name: 'Le Royaume Lumière',
        blurb: "Tu franchis le seuil et la forêt te couronne gardien de l'aube.",
      },
    },
    attente: {
      id: 'attente',
      title: 'La Nuit Sans Fin',
      position: { x: 320, y: 420 },
      blocks: [
        { text: "Tu t'endors près des lucioles…" },
        { text: 'et la forêt te garde, paisible, pour toujours.' },
      ],
      choices: [],
      ending: {
        type: 'Fin paisible',
        name: 'La Nuit Sans Fin',
        blurb: "Tu t'endors près des lucioles… et la forêt te garde, paisible, pour toujours.",
      },
    },
    chateau: {
      id: 'chateau',
      title: 'Le Château des Nues',
      position: { x: 660, y: 420 },
      blocks: [
        { text: "D'un bond, tu rejoins les nuages." },
        { text: "Une cité oubliée n'attendait que toi." },
      ],
      choices: [],
      ending: {
        type: 'Fin lumineuse',
        name: 'Le Château des Nues',
        blurb: "D'un bond, tu rejoins les nuages et découvres une cité oubliée qui n'attendait que toi.",
      },
    },
  },
};

export const verlaineStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'dossier-verlaine',
  title: 'Le Dossier Verlaine',
  version: '1.0.0',
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
      title: 'Le bureau',
      position: { x: 400, y: 30 },
      blocks: [
        { text: 'Le bureau du commissaire est désert.' },
        { text: 'Sur la table : un dossier rouge entrouvert, un tiroir mal fermé.' },
      ],
      choices: [
        { id: 'lire', label: 'Lire le dossier', target: 'dossier' },
        { id: 'fouiller', label: 'Fouiller le tiroir', target: 'tiroir' },
      ],
    },
    dossier: {
      id: 'dossier',
      title: 'Le dossier rouge',
      position: { x: 170, y: 230 },
      blocks: [
        { text: 'Une photo manque, arrachée.' },
        { text: "À sa place, une adresse griffonnée à la hâte : quai 7, minuit." },
      ],
      choices: [
        { id: 'secretaire', label: 'Interroger la secrétaire', target: 'secretaire' },
        { id: 'quai', label: 'Filer au quai 7', target: 'port' },
      ],
    },
    tiroir: {
      id: 'tiroir',
      title: 'Le tiroir',
      position: { x: 640, y: 230 },
      blocks: [
        { text: 'Dans le tiroir : un revolver encore tiède.' },
        { text: 'Et un billet de train pour Le Havre, ce matin.' },
      ],
      choices: [
        { id: 'renforts', label: 'Appeler des renforts', target: 'renfort' },
        { id: 'seul', label: 'Continuer seul', target: 'port' },
      ],
    },
    port: {
      id: 'port',
      title: 'L’Aube au Quai 7',
      position: { x: 400, y: 430 },
      blocks: [
        { text: "Au petit jour, l'ombre que tu suivais se retourne." },
        { text: 'Tu avais raison depuis le début.' },
      ],
      choices: [],
      ending: {
        type: 'Affaire élucidée',
        name: 'L’Aube au Quai 7',
        blurb: "Au petit jour, l'ombre que tu suivais se retourne. Tu avais raison depuis le début.",
      },
    },
    secretaire: {
      id: 'secretaire',
      title: 'L’Aveu',
      position: { x: 90, y: 430 },
      blocks: [
        { text: 'La secrétaire baisse les yeux.' },
        { text: 'Sa confession vaut tous les mandats du monde.' },
      ],
      choices: [],
      ending: {
        type: 'Affaire élucidée',
        name: 'L’Aveu',
        blurb: 'La secrétaire baisse les yeux. Sa confession vaut tous les mandats du monde.',
      },
    },
    renfort: {
      id: 'renfort',
      title: 'Le Protocole',
      position: { x: 700, y: 430 },
      blocks: [
        { text: 'Tu as suivi les règles.' },
        { text: "L'affaire est bouclée — proprement, mais sans toi au cœur de la légende." },
      ],
      choices: [],
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
  version: '0.4.0',
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
      title: 'Le camp de base',
      position: { x: 400, y: 30 },
      blocks: [
        { text: 'La tempête gronde au loin.' },
        { text: "La fenêtre météo se referme. C'est maintenant ou jamais." },
      ],
      choices: [
        { id: 'tenter', label: 'Tenter le sommet', target: 'sommet' },
        { id: 'attendre', label: 'Attendre une accalmie', target: 'accalmie' },
      ],
    },
    sommet: {
      id: 'sommet',
      title: 'La crevasse',
      position: { x: 620, y: 230 },
      blocks: [
        { text: 'À deux cents mètres du sommet, une crevasse barre la voie.' },
        { text: 'Le vent hurle.' },
      ],
      choices: [
        { id: 'contourner', label: 'La contourner, patient', target: 'gloire' },
        { id: 'forcer', label: 'Forcer le passage', target: 'chute' },
      ],
    },
    accalmie: {
      id: 'accalmie',
      title: "L'accalmie",
      position: { x: 180, y: 230 },
      blocks: [{ text: 'Tu patientes.' }, { text: 'Le ciel se dégage enfin… mais la lumière baisse déjà.' }],
      choices: [
        { id: 'repartir', label: 'Repartir vers le sommet', target: 'sommet' },
        { id: 'redescendre', label: 'Redescendre, sage', target: 'sage' },
      ],
    },
    gloire: {
      id: 'gloire',
      title: 'Le Toit du Monde',
      position: { x: 520, y: 430 },
      blocks: [{ text: 'Le sommet est à toi.' }, { text: "Le monde entier s'étend sous tes crampons." }],
      choices: [],
      ending: {
        type: 'Fin triomphale',
        name: 'Le Toit du Monde',
        blurb: "Le sommet est à toi. Le monde entier s'étend sous tes crampons.",
      },
    },
    chute: {
      id: 'chute',
      title: 'La Crevasse',
      position: { x: 740, y: 430 },
      blocks: [{ text: 'La glace cède.' }, { text: "La montagne, elle, ne pardonne pas l'impatience." }],
      choices: [],
      ending: {
        type: 'Fin tragique',
        name: 'La Crevasse',
        blurb: "La glace cède. La montagne, elle, ne pardonne pas l'impatience.",
      },
    },
    sage: {
      id: 'sage',
      title: 'Le Retour du Sage',
      position: { x: 120, y: 430 },
      blocks: [
        { text: 'Tu redescends.' },
        { text: 'Le sommet attendra — et toi, tu seras encore là pour le gravir.' },
      ],
      choices: [],
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
  version: '1.1.0',
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
      title: 'Minuit',
      position: { x: 400, y: 20 },
      blocks: [
        { text: 'Allô ? Tu es réveillé ?' },
        { text: "Il faut que je te parle. C'est important." },
        { text: "Ne raccroche pas, d'accord ?" },
      ],
      choices: [
        { id: 'qui', label: 'Qui êtes-vous ?', target: 'qui' },
        { id: 'trompe', label: 'Vous vous trompez de numéro.', target: 'trompe' },
      ],
    },
    qui: {
      id: 'qui',
      title: 'Je te connais',
      position: { x: 200, y: 180 },
      blocks: [
        { text: 'Disons que je te connais mieux que tu ne le crois.' },
        { text: 'Regarde par ta fenêtre.' },
      ],
      choices: [
        { id: 'regarde', label: 'Je regarde…', target: 'fenetre' },
        { id: 'blague', label: "C'est une blague ?", target: 'blague' },
      ],
    },
    trompe: {
      id: 'trompe',
      title: 'Non, c’est bien toi',
      position: { x: 620, y: 180 },
      blocks: [{ text: "Non. C'est bien à toi que je parle, Alex." }, { text: 'Et le temps presse.' }],
      choices: [
        { id: 'mon-nom', label: 'Comment connaissez-vous mon nom ?', target: 'qui' },
        { id: 'raccroche', label: 'Je raccroche.', target: 'raccroche' },
      ],
    },
    blague: {
      id: 'blague',
      title: 'Tic. Tac.',
      position: { x: 380, y: 330 },
      blocks: [{ text: "Ce n'est pas une blague." }, { text: 'Tic. Tac.' }],
      choices: [
        { id: 'finalement', label: '…je regarde par la fenêtre.', target: 'fenetre' },
        { id: 'bonne-nuit', label: 'Bonne nuit.', target: 'raccroche' },
      ],
    },
    fenetre: {
      id: 'fenetre',
      title: 'La voiture grise',
      position: { x: 120, y: 330 },
      blocks: [
        { text: 'Tu la vois, la voiture grise en bas ?' },
        { text: "Monte. Maintenant. Je t'expliquerai tout." },
      ],
      choices: [
        { id: 'jy-vais', label: "J'y vais.", target: 'voiture' },
        { id: 'refus', label: 'Pas question.', target: 'refus' },
      ],
    },
    raccroche: {
      id: 'raccroche',
      title: 'Silence Radio',
      position: { x: 660, y: 470 },
      blocks: [{ text: '…' }],
      choices: [],
      ending: {
        type: 'Fin silencieuse',
        name: 'Silence Radio',
        blurb: "Tu poses le téléphone. Au matin, plus aucune trace de l'appel. Tu ne sauras jamais.",
      },
    },
    voiture: {
      id: 'voiture',
      title: 'Le Rendez-vous',
      position: { x: 60, y: 470 },
      blocks: [{ text: 'La portière claque.' }],
      choices: [],
      ending: {
        type: 'Fin trouble',
        name: 'Le Rendez-vous',
        blurb: 'La portière claque. La ville défile. Ta vraie histoire, elle, commence à peine.',
      },
    },
    refus: {
      id: 'refus',
      title: 'La Porte Close',
      position: { x: 300, y: 470 },
      blocks: [{ text: "Le moteur s'éteint." }],
      choices: [],
      ending: {
        type: 'Fin sombre',
        name: 'La Porte Close',
        blurb: "Tu refermes le rideau. Dehors, le moteur s'éteint — et quelque chose d'autre avec lui.",
      },
    },
  },
};

/** Bibliotheque livree avec l'app. */
export const exampleStories: Story[] = [clairiereStory, verlaineStory, cimesStory, inconnuStory];

/** Recit de reference des tests et du premier lancement. */
export const exampleStory = clairiereStory;

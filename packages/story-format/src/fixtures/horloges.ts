/**
 * « La Maison aux Horloges » — the sample story set as a book.
 *
 * Written for the `book` reading style: second-person prose in short
 * paragraphs, and choices whose lines are gestures rather than replies, so that
 * they read as the next paragraph of the text. It has no narrator — a book
 * has no one on the other end, and no `player` node: nobody speaks unasked. It
 * still covers the usual shapes: a conditional choice earned on a detour, a
 * choice chained to narration, an npc → npc chain, two paths converging on the
 * same room.
 */

import { STORY_FORMAT_VERSION } from '../types.js';
import type { Story } from '../types.js';

export const horlogesStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'maison-horloges',
  title: 'La Maison aux Horloges',
  version: '1.0.0',
  author: 'Hélène Morvan',
  tag: 'Conte',
  theme: 'night',
  readingStyle: 'book',
  estimatedMinutes: 6,
  status: 'published',
  blurb:
    'La neige a tout recouvert, sauf une maison au bout du chemin, où mille horloges se sont arrêtées à la même minute. Une seule bat encore, quelque part sous le toit.',
  startSceneId: 'start',
  variables: { cle: false },
  scenes: {
    start: {
      id: 'start',
      kind: 'npc',
      title: 'Le chemin',
      position: { x: 400, y: 0 },
      blocks: [
        { text: 'Il a neigé toute la nuit, et le chemin ne mène plus qu’à une seule maison.' },
        {
          text: 'Ses fenêtres sont noires, sa cheminée froide, et pourtant, en tendant l’oreille, tu entends un tic-tac régulier qui traverse les murs.',
        },
        { text: 'La porte d’entrée est entrouverte. Sur le côté, un sentier contourne la façade.' },
      ],
      next: [
        { id: 'vers-porte', to: 'c-porte' },
        { id: 'vers-jardin', to: 'c-jardin' },
      ],
    },
    'c-porte': {
      id: 'c-porte',
      kind: 'choice',
      title: 'La porte',
      label: 'Pousser la porte d’entrée',
      position: { x: 620, y: 170 },
      blocks: [
        { text: 'Tu poses la main sur la poignée de cuivre, et la porte cède sans un bruit.' },
      ],
      next: [{ id: 'suite', to: 'hall' }],
    },
    'c-jardin': {
      id: 'c-jardin',
      kind: 'choice',
      title: 'Le jardin',
      label: 'Faire le tour par le jardin',
      position: { x: 180, y: 170 },
      blocks: [{ text: 'Tu longes le mur, les pieds enfoncés dans la neige fraîche.' }],
      next: [{ id: 'suite', to: 'jardin' }],
    },

    jardin: {
      id: 'jardin',
      kind: 'npc',
      title: 'La fontaine gelée',
      position: { x: 180, y: 330 },
      blocks: [
        {
          text: 'Derrière la maison, une fontaine a gelé d’un seul coup, l’eau figée en plein jet.',
        },
        {
          text: 'Au fond de la glace, prise comme un insecte dans l’ambre, une petite clé dorée attend.',
        },
      ],
      next: [
        {
          id: 'vers-cle',
          to: 'c-cle',
          effects: [{ op: 'set', variable: 'cle', value: true }],
        },
        { id: 'vers-laisser', to: 'c-laisser' },
      ],
    },
    'c-cle': {
      id: 'c-cle',
      kind: 'choice',
      title: 'Prendre la clé',
      label: 'Briser la glace pour prendre la clé',
      position: { x: 60, y: 490 },
      blocks: [
        {
          text: 'Tu frappes la glace du talon, une fois, deux fois, et la clé glisse dans ta paume, si froide qu’elle brûle.',
        },
      ],
      next: [{ id: 'suite', to: 'retour' }],
    },
    // The gesture is written, then the story walks back to the front door on
    // its own.
    retour: {
      id: 'retour',
      kind: 'npc',
      title: 'Retour à la façade',
      position: { x: 60, y: 630 },
      blocks: [{ text: 'Tu la glisses dans ta poche et reviens vers la façade, puis tu entres.' }],
      next: [{ id: 'suite', to: 'hall' }],
    },
    'c-laisser': {
      id: 'c-laisser',
      kind: 'choice',
      title: 'Laisser la clé',
      label: 'Laisser la clé où elle est',
      position: { x: 300, y: 490 },
      blocks: [
        {
          text: 'Tu la laisses dormir sous la glace, certaines choses ne t’appartiennent pas, et tu reviens vers la porte d’entrée.',
        },
      ],
      next: [{ id: 'suite', to: 'hall' }],
    },

    hall: {
      id: 'hall',
      kind: 'npc',
      title: 'Le hall',
      position: { x: 620, y: 630 },
      blocks: [
        {
          text: 'À l’intérieur, il y a des horloges partout : sur les murs, sur les marches, empilées jusqu’au plafond.',
        },
        {
          text: 'Toutes se sont arrêtées sur onze heures cinquante-huit. Toutes, sauf celle qui bat là-haut, sous le toit.',
        },
        { text: 'À ta gauche, la porte d’un salon laisse filtrer une lueur de braises.' },
      ],
      next: [
        { id: 'vers-escalier', to: 'c-escalier' },
        { id: 'vers-salon', to: 'c-salon' },
      ],
    },
    'c-escalier': {
      id: 'c-escalier',
      kind: 'choice',
      title: 'Monter',
      label: 'Monter vers le tic-tac',
      position: { x: 760, y: 790 },
      blocks: [
        { text: 'Tu montes, une marche après l’autre, et le tic-tac grandit à chaque palier.' },
      ],
      next: [{ id: 'suite', to: 'grenier' }],
    },
    'c-salon': {
      id: 'c-salon',
      kind: 'choice',
      title: 'Le salon',
      label: 'Entrer dans le salon',
      position: { x: 500, y: 790 },
      blocks: [{ text: 'Tu pousses la porte du salon.' }],
      next: [{ id: 'suite', to: 'salon' }],
    },

    salon: {
      id: 'salon',
      kind: 'npc',
      title: 'Le salon',
      position: { x: 500, y: 940 },
      blocks: [
        {
          text: 'Un fauteuil fait face à la cheminée, une couverture abandonnée sur l’accoudoir, une tasse encore tiède sur le guéridon.',
        },
      ],
      // npc → npc: the voice comes without the reader doing anything.
      next: [{ id: 'suite', to: 'voix' }],
    },
    voix: {
      id: 'voix',
      kind: 'npc',
      title: 'La voix',
      position: { x: 500, y: 1080 },
      blocks: [
        {
          text: 'Une voix s’élève derrière toi, calme, presque amusée : « Tu en as mis, du temps. »',
        },
        {
          text: 'Une vieille femme se tient sur le seuil, un trousseau de petites clés à la ceinture.',
        },
      ],
      next: [
        { id: 'vers-qui', to: 'c-qui' },
        { id: 'vers-fuir', to: 'c-fuir' },
      ],
    },
    'c-qui': {
      id: 'c-qui',
      kind: 'choice',
      title: 'Qui est-elle',
      label: 'Lui demander qui elle est',
      position: { x: 380, y: 1240 },
      blocks: [{ text: 'Tu lui demandes qui elle est, et ce qu’elle attendait de toi.' }],
      next: [{ id: 'suite', to: 'horlogere' }],
    },
    'c-fuir': {
      id: 'c-fuir',
      kind: 'choice',
      title: 'Fuir',
      label: 'Reculer vers la porte',
      position: { x: 620, y: 1240 },
      blocks: [
        { text: 'Tu recules sans la quitter des yeux, jusqu’à sentir le froid dans ton dos.' },
      ],
      next: [{ id: 'suite', to: 'dehors' }],
    },
    horlogere: {
      id: 'horlogere',
      kind: 'npc',
      title: 'L’horlogère',
      position: { x: 380, y: 1390 },
      blocks: [
        {
          text: 'Elle sourit : elle est l’horlogère, et la maison attend depuis cent hivers que quelqu’un remonte la dernière horloge.',
        },
        { text: 'Elle, elle ne peut plus. Ses mains tremblent trop.' },
      ],
      next: [{ id: 'vers-monter-avec', to: 'c-monter-avec' }],
    },
    'c-monter-avec': {
      id: 'c-monter-avec',
      kind: 'choice',
      title: 'Monter avec elle',
      label: 'Monter avec elle',
      position: { x: 380, y: 1540 },
      blocks: [{ text: 'Tu lui offres ton bras, et vous montez ensemble.' }],
      // Two very different ways in, the same attic.
      next: [{ id: 'suite', to: 'grenier' }],
    },

    grenier: {
      id: 'grenier',
      kind: 'npc',
      title: 'Le grenier',
      position: { x: 760, y: 1540 },
      blocks: [
        {
          text: 'Sous les poutres se dresse une horloge haute comme un homme, enfermée dans une cage de verre.',
        },
        {
          text: 'Son balancier ralentit à chaque coup, comme un cœur qui se fatigue. Il lui reste quelques minutes, peut-être moins.',
        },
      ],
      next: [
        {
          // Only for the reader who went round by the garden and broke the ice.
          id: 'vers-ouvrir',
          to: 'c-ouvrir',
          condition: { op: 'eq', variable: 'cle', value: true },
        },
        { id: 'vers-remonter', to: 'c-remonter' },
        { id: 'vers-arreter', to: 'c-arreter' },
      ],
    },
    'c-ouvrir': {
      id: 'c-ouvrir',
      kind: 'choice',
      title: 'Ouvrir la cage',
      label: 'Ouvrir la cage avec la clé de la fontaine',
      position: { x: 620, y: 1700 },
      blocks: [
        {
          text: 'Tu sors la clé de ta poche. Elle entre dans la serrure comme si elle l’avait toujours connue.',
        },
      ],
      next: [{ id: 'suite', to: 'minuit' }],
    },
    'c-remonter': {
      id: 'c-remonter',
      kind: 'choice',
      title: 'Remonter à la main',
      label: 'Briser le verre et remonter le mécanisme',
      position: { x: 860, y: 1700 },
      blocks: [
        {
          text: 'Tu brises le verre du coude et tournes la manivelle, encore et encore, jusqu’à ce que tes bras brûlent.',
        },
      ],
      next: [{ id: 'suite', to: 'aube' }],
    },
    'c-arreter': {
      id: 'c-arreter',
      kind: 'choice',
      title: 'Arrêter le balancier',
      label: 'Arrêter le balancier',
      position: { x: 1100, y: 1700 },
      blocks: [{ text: 'Tu passes la main entre les barreaux et retiens le balancier.' }],
      next: [{ id: 'suite', to: 'silence' }],
    },

    minuit: {
      id: 'minuit',
      kind: 'npc',
      title: 'Minuit sonne',
      position: { x: 620, y: 1860 },
      blocks: [
        {
          text: 'La cage s’ouvre, et pour la première fois depuis cent ans, l’aiguille franchit onze heures cinquante-neuf.',
        },
        {
          text: 'Minuit sonne. Mille horloges lui répondent à la fois, et dehors, sous la lune, la neige se met à fondre.',
        },
      ],
      next: [],
      ending: {
        type: 'Fin lumineuse',
        name: 'Minuit sonne',
        blurb: 'La clé de la fontaine ouvre la cage, et la maison entière se remet à battre.',
      },
    },
    aube: {
      id: 'aube',
      kind: 'npc',
      title: 'L’Horloger',
      position: { x: 860, y: 1860 },
      blocks: [
        {
          text: 'Le balancier repart, mais il est seul à battre : les autres horloges restent muettes.',
        },
        {
          text: 'Au matin, la maison est vide. Sur le manteau de la cheminée, une horloge neuve porte ton nom, et tu sais qu’il faudra la remonter chaque nuit.',
        },
      ],
      next: [],
      ending: {
        type: 'Fin étrange',
        name: 'L’Horloger',
        blurb: 'Tu as sauvé la dernière horloge, et la maison t’a gardé pour la remonter.',
      },
    },
    silence: {
      id: 'silence',
      kind: 'npc',
      title: 'Le Grand Silence',
      position: { x: 1100, y: 1860 },
      blocks: [
        {
          text: 'Le tic-tac s’éteint. Le silence qui suit est si épais qu’on pourrait le toucher.',
        },
        {
          text: 'Dehors, les flocons s’arrêtent en plein vol. Toi aussi, tu ne bouges plus — et rien, plus jamais, ne viendra te presser.',
        },
      ],
      next: [],
      ending: {
        type: 'Fin sombre',
        name: 'Le Grand Silence',
        blurb: 'Tu as arrêté la dernière horloge, et le temps s’est arrêté avec elle.',
      },
    },
    dehors: {
      id: 'dehors',
      kind: 'npc',
      title: 'La Neige',
      position: { x: 620, y: 1390 },
      blocks: [
        {
          text: 'Tu cours jusqu’au chemin sans te retourner. Quand enfin tu regardes en arrière, il n’y a plus de maison, seulement la neige, intacte.',
        },
      ],
      next: [],
      ending: {
        type: 'Fin prudente',
        name: 'La Neige',
        blurb: 'Tu es reparti, et la maison s’est refermée sur ses horloges.',
      },
    },
  },
};

# Embranche

Un jeu d'histoires interactives : un **studio** pour écrire des récits à embranchements sous forme de graphe, un **lecteur** mobile-first pour les jouer. Les deux partagent le même cœur.

> Pensé comme un vieux livre qu'on tient encore chaud entre les mains, tramé de correspondances qu'on lit d'un doigt. Palette sobre, un seul mode de lecture — la conversation — et une bascule jour / nuit.

---

## Architecture

```
apps/
  studio/          Créateur — éditeur visuel de graphe (React Flow). Desktop / tablette.
  reader/          Lecteur — mobile-first, lecture en correspondance.
packages/
  story-format/    Schéma, types et validation du format d'histoire (JSON).
  story-engine/    Moteur d'histoire. TypeScript pur.
  design-tokens/   Palette, typographie, rayons — la peau des deux apps.
```

### La règle qui structure tout

`story-engine` et `story-format` sont **agnostiques du framework UI** : pas de React, pas de DOM, pas d'I/O, pas de `localStorage`. Ils ne connaissent que des données et des événements.

Ce n'est pas une intention, c'est vérifié :

- une règle ESLint (`no-restricted-imports` + `no-restricted-globals`) fait **échouer le lint** si un fichier du cœur importe React ou touche à `window` ;
- leurs `tsconfig.json` déclarent `"types": []` et `"lib": ["ES2022"]` — sans `DOM`, `document` n'existe même pas pour le compilateur ;
- leurs tests tournent dans l'environnement `node` de Vitest.

Conséquence pratique : passer d'une app web à Tauri ou Capacitor, ou remplacer React, ne touche pas une ligne du cœur.

### Dépendances autorisées

| Paquet          | Dépend de                                       |
| --------------- | ----------------------------------------------- |
| `story-format`  | `zod` uniquement                                |
| `story-engine`  | `story-format`                                  |
| `design-tokens` | rien                                            |
| `apps/*`        | `story-format`, `story-engine`, `design-tokens` |

---

## Démarrer

```bash
pnpm install

pnpm dev:studio    # http://localhost:5174 — le créateur
pnpm dev:reader    # http://localhost:5173 — le lecteur
```

Le lecteur est mobile-first : ouvre-le dans l'inspecteur de ton navigateur en mode téléphone, ou depuis ton mobile — `vite` écoute sur le réseau local (`host: true`).

### Vérifier

```bash
pnpm verify        # lint + typecheck + tests
pnpm test          # 129 tests
pnpm lint
pnpm typecheck
pnpm format
```

---

## Le format d'histoire

C'est **le contrat** entre les deux apps : le studio écrit, le lecteur lit, aucune divergence de schéma.

```jsonc
{
  "formatVersion": 1,
  "id": "clairiere-lucioles",
  "title": "La Clairière aux Lucioles",
  "version": "1.0.0",
  "theme": "fantasy", // teinte de reliure : fantasy | mystery | adventure | night
  "narrator": { "name": "Elara", "status": "la voix de la clairière" },
  "startSceneId": "start",
  "variables": { "prudent": false },
  "scenes": {
    "start": {
      "id": "start",
      "title": "Le sentier",
      "position": { "x": 400, "y": 26 }, // position du nœud dans le studio
      "blocks": [{ "text": "Le sentier s'enfonce sous les fougères." }],
      "choices": [
        {
          "id": "vers-lucioles",
          "label": "Suivre les lucioles",
          "target": "lucioles",
          "condition": { "op": "eq", "variable": "prudent", "value": true },
          "effects": [{ "op": "addItem", "item": "lanterne" }],
        },
      ],
    },
  },
}
```

Quelques décisions et leurs raisons :

- **Un bloc de texte = un message.** Le lecteur n'a qu'un format de lecture, la correspondance : chaque bloc arrive comme un message, avec un temps de frappe. C'est ce qui fait que `blocks` est une liste et pas une chaîne.
- **Conditions et effets sont des données**, avec un vocabulaire fermé (`eq`, `gt`, `hasItem`, `visited`, `and`/`or`/`not`… et `set`, `inc`, `toggle`, `addItem`…). Aucun `eval`, aucun code arbitraire : un fichier d'histoire hostile ne peut rien exécuter.
- **La position des nœuds vit dans le format.** Ouvrir un JSON exporté remet le graphe exactement comme l'auteur l'avait posé.
- **Les champs média** (`backgroundImage`, `ambience`, `portrait`) sont déclarés mais **volontairement non exploités** — le contrat est figé, l'implémentation viendra.

### Validation

`validateStory` renvoie une liste d'anomalies typées, séparées en deux niveaux :

- **`error`** — le récit n'est pas jouable : scène de départ absente, choix vers une scène inexistante, identifiants dupliqués. Le studio bloque le playtest, le lecteur refuse le fichier.
- **`warning`** — un problème d'écriture qui n'empêche pas de jouer : scène orpheline, cul-de-sac, fin qui propose encore des choix, condition lisant une variable jamais écrite.

Le studio l'appelle à chaque frappe : les nœuds fautifs prennent un anneau rouge et la barre du bas liste les anomalies, cliquables.

---

## Le moteur

```ts
import { StoryEngine } from '@embranche/story-engine';

const engine = new StoryEngine(story);

engine.getCurrentScene(); // texte + SEULS les choix dont la condition est remplie
engine.choose('vers-lucioles'); // valide, applique les effets, avance
engine.goBack(); // annule d'un cran
engine.serialize(); // sauvegarde (à ranger où tu veux)

engine.on('story:ended', ({ ending }) => console.log(ending.name));
const unsubscribe = engine.subscribe(() => render()); // pour useSyncExternalStore
```

Deux points qui méritent d'être connus :

- **`goBack` rejoue, il n'inverse pas.** Annuler un `toggle` ou un `set` qui a écrasé une valeur est impossible par inversion. Le moteur étant déterministe, il repart d'un état neuf et rejoue l'historique tronqué — c'est exact par construction.
- **L'instantané a une référence stable** tant que l'état ne change pas. C'est le contrat exact de `useSyncExternalStore`, d'où un pont React de trente lignes (`useStory`) sans état dupliqué à resynchroniser.

Le moteur ne persiste rien. `serialize()` rend une chaîne, l'appelant décide de sa destination — c'est l'app qui appelle `localStorage`.

---

## Le studio

Deux écrans : le tableau de bord (créer, ouvrir, dupliquer, importer, exporter, supprimer) et l'éditeur de graphe.

Sur le canvas, chaque scène est un nœud et **chaque choix a sa propre poignée de sortie** : tirer la poignée d'un choix rebranche *ce* choix, tirer celle du bas en crée un nouveau. Le panneau de droite édite le texte (bloc par bloc), les choix, leurs conditions et leurs effets.

Les conditions se construisent ligne par ligne pour le cas courant — une liste de tests joints par ET ou OU. Une condition imbriquée, écrite à la main dans un JSON importé, bascule sur un champ JSON validé par le schéma : mieux vaut un champ austère qu'une réécriture qui perdrait de l'information.

Le **playtest** lance le récit courant dans `story-engine`, sans quitter l'éditeur, avec le même moteur que le lecteur. Les choix dont la condition n'est pas remplie y sont grisés plutôt que masqués — c'est un outil de relecture, pas une partie.

Le travail en cours est rangé dans `localStorage` (écriture différée de 400 ms, purgée avant fermeture d'onglet).

---

## Le lecteur

Mobile d'abord, puis élargi : cibles tactiles d'au moins 48 px, choix en boutons pleine largeur atteignables au pouce, `env(safe-area-inset-*)` respecté, aucun survol requis, texte lisible sans zoom. Au-delà de 720 px, la lecture est recentrée en colonne plutôt qu'étirée.

La lecture se fait en correspondance : les messages arrivent un à un avec un indicateur de frappe, la réponse choisie reste dans le fil. Taper dans la conversation saute l'attente. Une préférence système de mouvement réduit affiche la scène d'un bloc, sans rien changer au jeu.

Sauvegarde, palmarès des fins vues et mode jour/nuit vivent dans `localStorage`, branchés depuis l'app.

### Aller du studio au lecteur

1. Studio → **Exporter JSON** (ou l'icône ⤓ du tableau de bord).
2. Lecteur → **＋** en haut de la bibliothèque → choisir le fichier.

Le lecteur revalide le document et refuse net un récit incohérent.

---

## Tests

129 tests, tous verts.

| Suite          | Ce qu'elle couvre                                                                        |
| -------------- | ---------------------------------------------------------------------------------------- |
| `story-format` | schéma, cohérence du graphe, aller-retour JSON, cas d'erreur                              |
| `story-engine` | progression, conditions, effets, choix indisponibles, retour, sérialisation, événements   |
| `studio`       | opérations d'édition, projection vers React Flow, persistance, import                     |
| `reader`       | partie complète jusqu'à une fin, choix conditionnel, reprise, correspondance              |

---

## Ce qui n'est pas là

Voir [BACKLOG.md](BACKLOG.md). En résumé : pas de Tauri (les apps sont web autonomes et Tauri-ready, l'intégration viendra), pas de média, pas de compte, pas d'annulation dans le studio.

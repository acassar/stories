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
  "formatVersion": 2,
  "id": "clairiere-lucioles",
  "title": "La Clairière aux Lucioles",
  "version": "2.0.0",
  "theme": "fantasy", // teinte de reliure : fantasy | mystery | adventure | night
  "narrator": { "name": "Elara", "status": "la voix de la clairière" },
  "startSceneId": "start",
  "variables": { "prudent": false },
  "scenes": {
    "start": {
      "id": "start",
      "kind": "npc", // npc | player | choice
      "title": "Le sentier",
      "position": { "x": 400, "y": 0 }, // position du nœud dans le studio
      "blocks": [{ "text": "Le sentier s'enfonce sous les fougères." }],
      "next": [
        {
          "id": "vers-lucioles",
          "to": "c-lucioles",
          "condition": { "op": "eq", "variable": "prudent", "value": true },
          "effects": [{ "op": "addItem", "item": "lanterne" }],
        },
      ],
    },
    "c-lucioles": {
      "id": "c-lucioles",
      "kind": "choice",
      "title": "Suivre les lucioles",
      "label": "Suivre les lucioles", // le texte du bouton
      "blocks": [{ "text": "Je les suis." }], // ce que le joueur envoie vraiment
      "position": { "x": 190, "y": 160 },
      "next": [{ "id": "suite", "to": "lucioles" }],
    },
  },
}
```

### La règle qui remplace les choix

Un nœud a un **type**, et c'est le type de ce qu'il vise qui décide de tout :

| Type     | Qui parle        | Ce qui se passe après                          |
| -------- | ---------------- | ---------------------------------------------- |
| `npc`    | l'interlocuteur  | le récit enchaîne seul                         |
| `player` | le joueur        | le récit enchaîne seul                         |
| `choice` | le joueur        | **le seul type qui arrête la lecture**         |

> **Si les liens sortants visent des nœuds `choice`, on affiche des boutons ; sinon on enchaîne.**

Il n'y a rien d'autre à savoir. `npc → npc`, `player → player`, `player → npc` : tout est permis, et tout s'enchaîne sans que le joueur ait à agir. Un nœud joueur peut donc rejoindre directement un nœud personnage, y compris à l'autre bout du graphe, sans passer par un faux choix « Continuer ».

La contrepartie est une règle d'homogénéité, vérifiée par `validateStory` : un nœud ne mélange pas des liens vers des choix et des liens d'enchaînement — sinon le lecteur ne saurait pas s'il doit attendre le joueur.

Quelques décisions et leurs raisons :

- **Un bloc de texte = un message.** Le lecteur n'a qu'un format de lecture, la correspondance : chaque bloc arrive comme un message, avec un temps de frappe. C'est ce qui fait que `blocks` est une liste et pas une chaîne.
- **Un bloc ne dit pas qui parle — son nœud le dit.** Le format 1 avait un `speaker` par message ; deux sources de vérité pour la même question finissent par se contredire, et un nœud pouvait afficher ses messages du côté opposé à ce que sa couleur annonçait. Un changement de locuteur au milieu d'une scène s'écrit désormais avec ce que le format sait faire : un second nœud, enchaîné.
- **La transition est un objet, pas un champ de la scène source.** C'est le `Link` qui porte `condition` et `effects`, parce qu'une même scène peut désormais être atteinte par plusieurs chemins : ranger les conséquences sur la scène les appliquerait quel que soit le chemin suivi.
- **Le libellé du bouton et le message envoyé sont deux champs.** Un bouton peut annoncer « Mentir » quand la réplique partie est tout autre. Sans `blocks`, c'est le libellé qui part.
- **Plusieurs liens d'enchaînement = un aiguillage.** Le premier lien dont la condition est remplie l'emporte. Le nœud « condition » sort gratuitement du modèle, sans nouveau type.
- **Conditions et effets sont des données**, avec un vocabulaire fermé (`eq`, `gt`, `hasItem`, `visited`, `and`/`or`/`not`… et `set`, `inc`, `toggle`, `addItem`…). Aucun `eval`, aucun code arbitraire : un fichier d'histoire hostile ne peut rien exécuter.
- **La position des nœuds vit dans le format.** Ouvrir un JSON exporté remet le graphe exactement comme l'auteur l'avait posé.
- **Les champs média** (`backgroundImage`, `ambience`, `portrait`) sont déclarés mais **volontairement non exploités** — le contrat est figé, l'implémentation viendra.

### Migration depuis le format 1

`migrateStory` traduit un document d'hier, à chaque porte d'entrée (`parseStory`, la bibliothèque du lecteur, le rangement local du studio). Chaque ancienne scène devient un nœud `npc`, et chaque choix qu'elle portait devient un nœud `choice` intercalé :

```
[scène] --choix--> [cible]           (format 1)
[npc] --> [choice] --> [cible]       (format 2)
```

Le premier lien hérite de la condition et des effets du choix — c'est lui qu'on emprunte en appuyant sur le bouton. Aucun brouillon n'est perdu. Les **parties sauvegardées**, en revanche, ne survivent pas : l'historique est passé de `choiceId` à `linkId`.

Une scène qui alternait les locuteurs message par message (`speaker`) est **éclatée en autant de nœuds que de changements de voix**, enchaînés automatiquement — le rendu est identique, le modèle devient honnête. Les liens sortants et la fin passent au dernier fragment. `migrateStory` répare aussi, au passage, un document déjà en v2 qui traînerait encore ce champ ; l'opération est idempotente et laisse intact ce qui n'a rien à corriger.

### Validation

`validateStory` renvoie une liste d'anomalies typées, séparées en deux niveaux :

- **`error`** — le récit n'est pas jouable : scène de départ absente, lien vers une scène inexistante, identifiants dupliqués, choix sans libellé, nœud qui mélange choix et enchaînement, **boucle d'enchaînements automatiques** dont la lecture ne sortirait jamais. Le studio bloque le playtest, le lecteur refuse le fichier.
- **`warning`** — un problème d'écriture qui n'empêche pas de jouer : scène orpheline, cul-de-sac, fin qui garde des liens sortants, enchaînement dont tous les liens sont conditionnels, condition lisant une variable jamais écrite.

Le studio l'appelle à chaque frappe : les nœuds fautifs prennent un anneau rouge et la barre du bas liste les anomalies, cliquables.

---

## Le moteur

```ts
import { StoryEngine } from '@embranche/story-engine';

const engine = new StoryEngine(story);

engine.getCurrentScene(); // texte + SEULS les choix dont la condition est remplie
engine.choose('vers-lucioles'); // valide, applique les effets, avance
engine.advance(); // poursuit d'un nœud quand le récit enchaîne seul
engine.goBack(); // revient au choix précédent
engine.serialize(); // sauvegarde (à ranger où tu veux)

engine.on('story:ended', ({ ending }) => console.log(ending.name));
const unsubscribe = engine.subscribe(() => render()); // pour useSyncExternalStore
```

Trois points qui méritent d'être connus :

- **`advance` ne déroule qu'un nœud à la fois.** Le moteur pourrait dérouler toute la chaîne d'un coup ; il ne le fait pas, parce que chaque nœud traversé doit pouvoir s'afficher à son rythme dans la correspondance. C'est l'UI qui rappelle, une fois les messages arrivés.
- **`goBack` revient au dernier _choix_, pas au dernier nœud** — et il rejoue plutôt qu'il n'inverse. Reculer d'un seul cran reposerait le joueur devant une scène qui repartirait aussitôt toute seule. Quant à l'annulation d'un `toggle` ou d'un `set` qui a écrasé une valeur, elle est impossible par inversion : le moteur étant déterministe, il repart d'un état neuf et rejoue l'historique tronqué — c'est exact par construction.
- **L'instantané a une référence stable** tant que l'état ne change pas. C'est le contrat exact de `useSyncExternalStore`, d'où un pont React de trente lignes (`useStory`) sans état dupliqué à resynchroniser.

Le moteur ne persiste rien. `serialize()` rend une chaîne, l'appelant décide de sa destination — c'est l'app qui appelle `localStorage`.

---

## Le studio

Deux écrans : le tableau de bord (créer, ouvrir, dupliquer, importer, exporter, supprimer) et l'éditeur de graphe.

Sur le canvas, **la couleur d'un nœud est son type** — encre froide pour l'interlocuteur, vert pour la voix du joueur, prune pour une décision. C'est l'information la plus structurante du graphe, puisqu'elle dit si la lecture s'arrête là ou si elle continue seule ; elle doit donc se lire sans zoomer. Une étiquette la double en toutes lettres : la couleur ne porte jamais l'information toute seule.

Une arête du canvas est exactement un `Link` du récit — plus rien n'est caché dans le nœud source. Tirer une arête crée un lien vers n'importe quel nœud déjà écrit, ce qui est tout le geste « rejoindre un nœud lointain ». Une connexion qui mélangerait choix et enchaînement est refusée au moment de la tracer, plutôt que signalée après coup.

Trois boutons créent les trois types, colorés comme ce qu'ils produisent. Depuis un nœud sélectionné, ils créent la suite : le nœud **et** son lien, donc jamais de cible pendante.

Le panneau de droite édite le type, le texte (bloc par bloc) et les liens sortants. Sur un nœud `choice`, il affiche aussi la condition et les effets de son lien entrant — pour l'auteur, « ce bouton n'apparaît que si… » est une propriété du bouton, même si la donnée vit sur l'arête.

Les conditions se construisent ligne par ligne pour le cas courant — une liste de tests joints par ET ou OU. Une condition imbriquée, écrite à la main dans un JSON importé, bascule sur un champ JSON validé par le schéma : mieux vaut un champ austère qu'une réécriture qui perdrait de l'information.

Le **playtest** lance le récit courant dans `story-engine`, sans quitter l'éditeur, avec le même moteur que le lecteur. Les choix dont la condition n'est pas remplie y sont grisés plutôt que masqués — c'est un outil de relecture, pas une partie.

Le travail en cours est rangé dans `localStorage` (écriture différée de 400 ms, purgée avant fermeture d'onglet).

---

## Le lecteur

Mobile d'abord, puis élargi : cibles tactiles d'au moins 48 px, choix en boutons pleine largeur atteignables au pouce, `env(safe-area-inset-*)` respecté, aucun survol requis, texte lisible sans zoom. Au-delà de 720 px, la lecture est recentrée en colonne plutôt qu'étirée.

La lecture se fait en correspondance : les messages arrivent un à un avec un indicateur de frappe, la réponse choisie reste dans le fil. Taper dans la conversation saute l'attente. Une préférence système de mouvement réduit affiche la scène d'un bloc, sans rien changer au jeu.

Quand le nœud courant n'attend aucune décision, le récit poursuit de lui-même — mais seulement une fois ses messages arrivés, et après le même silence qu'entre deux messages. C'est ce qui fait qu'une réplique imposée du joueur, ou deux répliques d'affilée de l'interlocuteur, se lisent comme une vraie conversation plutôt que comme un bloc qui tombe d'un coup.

Sauvegarde, palmarès des fins vues et mode jour/nuit vivent dans `localStorage`, branchés depuis l'app.

### Aller du studio au lecteur

1. Studio → **Exporter JSON** (ou l'icône ⤓ du tableau de bord).
2. Lecteur → **＋** en haut de la bibliothèque → choisir le fichier.

Le lecteur revalide le document et refuse net un récit incohérent.

---

## Tests

162 tests, tous verts.

| Suite          | Ce qu'elle couvre                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `story-format` | schéma, cohérence du graphe, migration 1 → 2, aller-retour JSON, cas d'erreur                          |
| `story-engine` | progression, enchaînement automatique, conditions, effets, retour, sérialisation, événements           |
| `studio`       | opérations d'édition, projection vers React Flow, persistance, import                                  |
| `reader`       | partie complète jusqu'à une fin, choix conditionnel, reprise, correspondance                           |

---

## Ce qui n'est pas là

Voir [BACKLOG.md](BACKLOG.md). En résumé : pas de Tauri (les apps sont web autonomes et Tauri-ready, l'intégration viendra), pas de média, pas de compte, pas d'annulation dans le studio.

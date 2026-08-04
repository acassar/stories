# Backlog — Embranche

Backlog dérivé du cahier des charges initial. L'**itération 1** est livrée ; le reste est priorisé et prêt à être pris.

**Légende priorité** — P0 bloquant · P1 prochaine itération · P2 souhaitable · P3 un jour peut-être
**Taille** — S ≈ ½ j · M ≈ 1–2 j · L ≈ 3–5 j · XL ≈ > 1 semaine

---

## Itération 1 — Socle ✅ livrée

La définition de « terminé » du cahier des charges est atteinte : on crée une petite histoire dans le studio, on la valide, on la playteste, on l'exporte ; ce même JSON, chargé dans le lecteur sur mobile, est jouable du début à un embranchement, avec choix conditionnel, sauvegarde et reprise — moteur couvert par des tests et sans une ligne de React dans `story-engine`.

| ID       | Item                                                                       | Taille |
| -------- | -------------------------------------------------------------------------- | ------ |
| INFRA-1  | Monorepo pnpm, TS strict partagé, ESLint + Prettier, Vitest                 | M      |
| INFRA-2  | Garde-fou d'archi : le lint échoue si le cœur importe React ou touche au DOM | S      |
| TOKENS-1 | Palette Embranche (papier jour/nuit, 4 reliures, typographie) centralisée   | M      |
| FMT-1    | Types du format d'histoire                                                  | M      |
| FMT-2    | Validation Zod (forme) + cohérence du graphe (fond), en `error` / `warning` | M      |
| FMT-3    | Quatre récits d'exemple valides, dont un avec choix conditionnel            | S      |
| ENG-1    | API du moteur : scène résolue, choix, retour, reset, sérialisation          | L      |
| ENG-2    | Conditions et effets déclaratifs, sans `eval`                               | M      |
| ENG-3    | Émetteur d'événements typé + instantané stable pour `useSyncExternalStore`  | M      |
| ENG-4    | Suite de tests complète (80 tests)                                          | M      |
| STU-1    | Canvas React Flow, nœud personnalisé, poignée par choix                     | L      |
| STU-2    | Panneau d'édition : texte, choix, conditions, effets, fin, scène de départ  | L      |
| STU-3    | Validation en direct : anneau sur les nœuds + barre d'anomalies cliquable   | M      |
| STU-4    | Playtest intégré sur le vrai moteur                                         | M      |
| STU-5    | Import / export JSON + tableau de bord CRUD                                 | M      |
| STU-6    | Persistance locale du travail en cours                                      | S      |
| RD-1     | `useStory` — pont moteur ↔ React                                            | S      |
| RD-2     | Lecture en correspondance (messages, frappe, réponse dans le fil)           | L      |
| RD-3     | Écrans bibliothèque / fiche / lecture / fin, bascule jour-nuit              | L      |
| RD-4     | Sauvegarde, reprise, palmarès des fins                                      | M      |
| RD-5     | Mobile-first : cibles tactiles, safe-area, mouvement réduit                 | M      |

---

## Itération 2 — Rendre le studio agréable à vivre

Une fois qu'on écrit vraiment, ce sont ces manques-là qui font mal.

| ID     | Item                                     | Priorité | Taille | Détail                                                                                                                                        |
| ------ | ---------------------------------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| STU-7  | Annuler / rétablir                       | P0       | M      | Pile d'historique sur le document. Les opérations de `lib/storyDoc` sont déjà pures et immuables — le socle est là.                            |
| STU-8  | Renommer l'identifiant d'une scène depuis l'UI | P1  | S      | `renameSceneId` existe et repointe déjà tout ce qui visait la scène ; il manque le champ dans le panneau.                                       |
| STU-9  | Mise en page automatique du graphe       | P1       | M      | Un bouton « ranger » (dagre ou elk) pour les récits importés sans positions cohérentes.                                                        |
| STU-10 | Sélection multiple, copier / coller       | P2       | M      | Déplacer et dupliquer un morceau de récit d'un bloc.                                                                                            |
| STU-11 | Recherche plein texte dans les scènes     | P2       | S      | Retrouver une réplique dans un récit de cinquante nœuds.                                                                                        |
| STU-12 | Tableau des variables du récit            | P1       | M      | Vue dédiée : qui écrit quoi, qui lit quoi, quelles variables ne sont jamais lues. Les fonctions de collecte existent dans `story-format`.        |
| STU-13 | Playtest depuis la scène sélectionnée     | P2       | S      | Le paramètre `fromSceneId` est déjà câblé dans `Playtest`, il manque le point d'entrée dans la barre d'outils.                                  |
| STU-14 | Aperçu des chemins morts                  | P2       | M      | Surligner les scènes inatteignables *compte tenu des conditions*, pas seulement du graphe — un choix conditionné à l'impossible est un orphelin. |

---

## Itération 3 — Enrichir le récit

| ID    | Item                                     | Priorité | Taille | Détail                                                                                                                                     |
| ----- | ---------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FMT-4 | Média : image de fond, ambiance sonore    | P1       | L      | Les champs sont **déjà déclarés** dans le type `SceneMedia`. Reste : upload / référencement des fichiers, rendu dans le lecteur, préchargement. |
| FMT-5 | Interpolation de variables dans le texte  | P1       | M      | `Bonjour {{ nom }}`. Attention : à faire par substitution de jetons déclarés, jamais par exécution — la règle « pas d'`eval` » ne bouge pas.  |
| FMT-6 | Blocs typés autres que le texte           | P2       | M      | Pause, changement d'interlocuteur, didascalie. Le type `TextBlock` devient une union discriminée.                                            |
| FMT-7 | Migration de format (`formatVersion`)     | P1       | M      | Le champ existe et est vérifié. Il manque la chaîne de migrations quand la v2 arrivera.                                                      |
| ENG-5 | Effets sur l'entrée d'une scène           | P2       | M      | Aujourd'hui les effets sont portés par les choix. Une scène doit pouvoir en appliquer à l'arrivée.                                            |
| ENG-6 | Aléatoire déterministe                    | P3       | M      | Générateur à graine, rangé dans l'état, pour que le rejeu de `goBack` reste exact.                                                            |
| ENG-7 | Sauvegardes multiples par récit           | P2       | S      | L'état est déjà entièrement sérialisable ; c'est une affaire de clés côté app.                                                                |

---

## Itération 4 — Lecteur

| ID    | Item                                      | Priorité | Taille | Détail                                                                                                       |
| ----- | ----------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| RD-6  | Écran « fins découvertes »                 | P1       | M      | Le palmarès est déjà stocké ; il lui manque un écran, avec les fins non trouvées en silhouette.               |
| RD-7  | Étagère (2ᵉ disposition de bibliothèque)   | P2       | S      | Prévue dans la maquette : rayonnages horizontaux par genre, en alternative aux cartes.                        |
| RD-8  | Sons                                      | P2       | M      | La maquette prévoit un clic discret à chaque choix et un interrupteur son.                                     |
| RD-9  | Passe d'accessibilité                      | P0       | M      | Audit lecteur d'écran sur le fil `aria-live`, ordre de tabulation, contrastes AA dans les deux modes.          |
| RD-10 | Reprise de lecture à la bonne position     | P2       | S      | Rouvrir une partie en cours doit rendre le fil déjà déroulé, pas rejouer l'animation de frappe.                |
| RD-11 | Hors-ligne (service worker)                | P2       | M      | Une histoire ouverte doit rester lisible dans le métro.                                                        |

---

## Plateforme et exploitation

| ID     | Item                                | Priorité | Taille | Détail                                                                                                                             |
| ------ | ----------------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| PLAT-1 | Empaquetage Tauri                    | P2       | L      | Volontairement **hors périmètre** de l'itération 1. Les deux apps sont des sites statiques autonomes : rien ne bloque.               |
| PLAT-2 | Persistance par fichiers             | P2       | M      | Sous Tauri, remplacer `lib/storage` (studio) et `lib/library` (lecteur) par un accès disque. Aucun autre fichier à toucher.          |
| PLAT-3 | CI (lint + typecheck + tests)        | P0       | S      | `pnpm verify` existe déjà ; il manque le workflow.                                                                                  |
| PLAT-4 | Publication des deux apps            | P1       | S      | Deux `vite build`, deux sites statiques.                                                                                            |
| PLAT-5 | Couverture de tests mesurée          | P1       | S      | Seuil sur `story-engine` et `story-format`, qui doivent rester au plus haut.                                                        |
| PLAT-6 | Test bout-en-bout studio → lecteur   | P1       | M      | Un test qui exporte depuis le studio et rejoue le fichier dans le lecteur : c'est le contrat entre les deux apps, il mérite un garde-fou. |

---

## Dette assumée

Ce n'est pas de l'oubli, ce sont des choix.

| Sujet                                                     | Pourquoi c'est comme ça aujourd'hui                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le playtest du studio redessine sa propre vue de lecture   | Partager des composants React entre les deux apps demanderait un `packages/ui`, donc du React dans un paquet partagé. Le playtest est un outil de relecture, pas le lecteur : la duplication reste petite et honnête. Si elle grossit, extraire `packages/ui` — le cœur, lui, ne bouge pas. |
| Les conditions imbriquées s'éditent en JSON brut           | L'éditeur structuré couvre le cas courant. Plutôt que de réécrire une forme riche en la simplifiant — donc en perdant de l'information — on montre le JSON, validé par le schéma.                                                                                     |
| Pas d'annulation dans le studio                            | STU-7. Les opérations d'édition sont déjà pures et immuables, exprès pour que la pile d'historique soit une addition, pas une réécriture.                              |
| Le tableau de bord n'a pas de compteur de lectures         | La maquette en montre un. Il suppose un backend ; sans compte ni serveur, l'afficher serait mentir.                                                                    |
| Le format ne gère qu'une langue                            | Aucune demande de traduction pour l'instant. Le jour venu : `blocks[].text` devient une carte langue → texte, avec migration `formatVersion`.                          |

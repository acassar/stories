# Backlog — Embranche

Backlog dérivé du cahier des charges initial. Les **itérations 1 et 2** sont livrées ; le reste est priorisé et prêt à être pris.

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
| STU-1    | Canvas React Flow, nœud personnalisé coloré par type, liens tirables        | L      |
| STU-2    | Panneau d'édition : type, texte, liens, conditions, effets, fin, départ     | L      |
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

## Itération 2 — Rendre le studio agréable à vivre ✅ livrée

Une fois qu'on écrit vraiment, ce sont ces manques-là qui faisaient mal. Le studio se pilote maintenant au clavier, se range tout seul, se relit et s'explique.

| ID     | Item                                           | Taille | Où ça vit                                                                                                                    |
| ------ | ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| STU-7  | Annuler / rétablir                             | M      | `lib/history` (pile pure) + `hooks/useStoryHistory`. Les frappes et les déplacements se regroupent en une étape.               |
| STU-8  | Renommer l'identifiant d'une scène depuis l'UI | S      | Champ dans le panneau, adossé à `renameSceneId` qui repointait déjà tout ce qui visait la scène.                              |
| STU-9  | Mise en page automatique du graphe             | M      | `lib/layout` — mise en couches maison, sans dépendance : rang, ordre barycentrique, coordonnées.                              |
| STU-10 | Sélection multiple, copier / coller             | M      | `copyScenes` / `pasteScenes` dans `lib/storyDoc` : un fragment recopié reste branché sur le reste du récit.                    |
| STU-11 | Recherche plein texte dans les scènes           | S      | `lib/search` (insensible à la casse et aux accents) + surlignage des nœuds trouvés sur le canevas.                             |
| STU-12 | Tableau des variables du récit                  | M      | `analyzeStory` dans `story-format`, rendu par `VariablesPanel` : qui écrit, qui lit, ce qui ne sert plus.                      |
| STU-13 | Playtest depuis la scène sélectionnée           | S      | Bouton « ▶ D'ici » ; le playtest annonce que l'état de départ est celui du récit, pas celui du chemin.                        |
| STU-14 | Aperçu des chemins morts                        | M      | `exploreReachable` dans `story-engine` : parcours borné de l'espace d'états, qui dit franchement quand il n'a pas pu conclure. |

Livré avec, sur le même canevas : mise en relief de l'amont et de l'aval du nœud sélectionné, arêtes fléchées, légende, sélection multiple à la souris, raccourcis clavier, barre d'anomalies repliable et panneau d'édition qui ne déborde plus.

---

## Itération 3 — Enrichir le récit

| ID    | Item                                     | Priorité | Taille | Détail                                                                                                                                     |
| ----- | ---------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FMT-4 | Média : image de fond, ambiance sonore    | P1       | L      | Les champs sont **déjà déclarés** dans le type `SceneMedia`. Reste : upload / référencement des fichiers, rendu dans le lecteur, préchargement. |
| FMT-5 | Interpolation de variables dans le texte  | P1       | M      | `Bonjour {{ nom }}`. Attention : à faire par substitution de jetons déclarés, jamais par exécution — la règle « pas d'`eval` » ne bouge pas.  |
| FMT-6 | Blocs typés autres que le texte           | P2       | M      | Pause, changement d'interlocuteur, didascalie. Le type `TextBlock` devient une union discriminée.                                            |
| ENG-5 | Effets sur l'entrée d'un nœud             | P2       | M      | Les effets sont portés par les liens — c'est le chemin qui a des conséquences. Reste le cas « quel que soit le chemin », qui appartient au nœud. |
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
| L'analyse des chemins morts est bornée                     | Elle explore l'espace des états atteignables, qui est exponentiel dans le pire des cas. Au-delà de son plafond, elle le dit et ne conclut pas, plutôt que de présenter une réponse partielle comme un verdict. |
| Le presse-papiers du studio vit en mémoire                 | Copier un fragment dans un onglet et le coller dans un autre demanderait de sérialiser vers le presse-papiers système, donc de gérer un format d'échange et du texte hostile. Le geste courant — dupliquer une branche dans le même récit — n'en a pas besoin. |
| Le tableau de bord n'a pas de compteur de lectures         | La maquette en montre un. Il suppose un backend ; sans compte ni serveur, l'afficher serait mentir.                                                                    |
| Le format ne gère qu'une langue                            | Aucune demande de traduction pour l'instant. Le jour venu : `blocks[].text` devient une carte langue → texte, avec migration `formatVersion`.                          |
| Les parties sauvegardées ne survivent pas au passage en format 2 | Les récits, eux, sont migrés (`migrateStory`). Mais l'historique d'une partie est passé de `choiceId` à `linkId` : le traduire demanderait de rejouer chaque partie contre l'ancien graphe pour retrouver le lien correspondant. Pour des sauvegardes locales de quelques minutes de lecture, le coût dépassait le service rendu. |

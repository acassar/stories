# Embranche

An interactive story game: a **studio** to write branching narratives as a graph, and a mobile-first **reader** to play them. Both share the same core.

> Designed like an old book still warm in your hands, woven into a correspondence you read with one thumb. A sober palette, a single reading mode — the conversation — and a light / dark toggle.

---

## Architecture

```
apps/
  studio/          Author tool — visual graph editor (React Flow). Desktop / tablet.
  reader/          Reader — mobile-first, reading as a conversation.
packages/
  story-format/    Schema, types, validation and analysis of the story format (JSON).
  story-engine/    Story engine and reachability analysis. Pure TypeScript.
  design-tokens/   Palette, typography, radii — the skin of both apps.
```

### The rule that structures everything

`story-engine` and `story-format` are **agnostic of the UI framework**: no React, no DOM, no I/O, no `localStorage`. They know only data and events.

This is not an intention, it is enforced:

- an ESLint rule (`no-restricted-imports` + `no-restricted-globals`) **fails the lint** if a core file imports React or touches `window`;
- their `tsconfig.json` declare `"types": []` and `"lib": ["ES2022"]` — without `DOM`, `document` does not even exist for the compiler;
- their tests run in Vitest's `node` environment.

Practical consequence: moving from a web app to Tauri or Capacitor, or replacing React, does not touch a single line of the core.

### Allowed dependencies

| Package         | Depends on                                      |
| --------------- | ----------------------------------------------- |
| `story-format`  | `zod` only                                      |
| `story-engine`  | `story-format`                                  |
| `design-tokens` | nothing                                         |
| `apps/*`        | `story-format`, `story-engine`, `design-tokens` |

---

## Online

Both apps are published as one static site, from `main`, once CI is green:

| | |
| --- | --- |
| Reader | <https://acassar.github.io/stories/> |
| Studio | <https://acassar.github.io/stories/studio/> |

Everything is stored in the browser of whoever opens them — there is no server and no account.

---

## Getting started

```bash
pnpm install

pnpm dev:studio    # http://localhost:5174 — the author tool
pnpm dev:reader    # http://localhost:5173 — the reader
```

The reader is mobile-first: open it in your browser inspector in phone mode, or from your phone — `vite` listens on the local network (`host: true`).

### Checks

```bash
pnpm verify        # lint + typecheck + tests
pnpm test          # 281 tests
pnpm test:coverage # the same, with the thresholds on the core
pnpm lint
pnpm typecheck
pnpm format
```

---

## The story format

This is **the contract** between the two apps: the studio writes, the reader reads, no schema divergence.

```jsonc
{
  "formatVersion": 2,
  "id": "clairiere-lucioles",
  "title": "La Clairière aux Lucioles",
  "version": "2.0.0",
  "theme": "fantasy", // binding tint: fantasy | mystery | adventure | night
  "narrator": { "name": "Elara", "status": "la voix de la clairière" },
  "startSceneId": "start",
  "variables": { "prudent": false },
  "scenes": {
    "start": {
      "id": "start",
      "kind": "npc", // npc | player | choice
      "title": "Le sentier",
      "position": { "x": 400, "y": 0 }, // node position in the studio
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
      "label": "Suivre les lucioles", // the button text
      "blocks": [{ "text": "Je les suis." }], // what the player actually sends
      "position": { "x": 190, "y": 160 },
      "next": [{ "id": "suite", "to": "lucioles" }],
    },
  },
}
```

### The rule that replaces choices

A node has a **kind**, and the kind of what it points at decides everything:

| Kind     | Who speaks        | What happens next                    |
| -------- | ----------------- | ------------------------------------ |
| `npc`    | the correspondent | the story chains on by itself        |
| `player` | the player        | the story chains on by itself        |
| `choice` | the player        | **the only kind that stops reading** |

> **If the outgoing links point at `choice` nodes, buttons are displayed; otherwise the story chains on.**

There is nothing else to know. `npc → npc`, `player → player`, `player → npc`: all are allowed, and all chain on without the player having to act. A player node can therefore reach a character node directly, including at the other end of the graph, without a fake "Continue" choice.

The counterpart is a homogeneity rule, enforced by `validateStory`: a node does not mix links to choices with chaining links — otherwise the reader would not know whether to wait for the player.

A few decisions and their reasons:

- **One text block = one message.** The reader has a single reading format, the conversation: each block arrives as a message, with a typing delay. That is why `blocks` is a list and not a string.
- **A block does not say who speaks — its node does.** The node kind is the single source of truth for the speaker, so a node can never display its messages on the side opposite to what its color announces. A change of speaker in the middle of a scene is written as a second, chained node.
- **A transition is an object, not a field of the source scene.** The `Link` carries `condition` and `effects`, because one scene can be reached through several paths: storing the consequences on the scene would apply them whichever path was taken.
- **The button label and the message sent are two fields.** A button can read "Mentir" while the line that goes out says something else entirely. Without `blocks`, the label is what goes out.
- **Several chaining links = a switch.** The first link whose condition holds wins. A "condition" node comes for free from the model, without a new kind.
- **Conditions and effects are data**, with a closed vocabulary (`eq`, `gt`, `hasItem`, `visited`, `and`/`or`/`not`… and `set`, `inc`, `toggle`, `addItem`…). No `eval`, no arbitrary code: a hostile story file cannot execute anything.
- **Node positions live in the format.** Opening an exported JSON puts the graph back exactly where the author left it.
- **Media fields** (`backgroundImage`, `ambience`, `portrait`) are declared but **deliberately unused** — the contract is frozen, the implementation comes later.

### Migration from format 1

`migrateStory` translates an older document at every entry point (`parseStory`, the reader library, the studio local storage). Each legacy scene becomes an `npc` node, and each choice it carried becomes a `choice` node inserted in between:

```
[scene] --choice--> [target]         (format 1)
[npc] --> [choice] --> [target]      (format 2)
```

The first link inherits the condition and the effects of the choice — it is the one taken when the button is pressed. No draft is lost. **Saved runs**, on the other hand, do not survive: the history moved from `choiceId` to `linkId`.

A scene that alternated speakers message by message (`speaker`) is **split into as many nodes as there are voice changes**, chained automatically — the rendering is identical. `migrateStory` also repairs a document already in v2 that still carries that field; the operation is idempotent and leaves untouched whatever needs no fixing.

### The shipped library

`exampleStories` holds the five stories both apps start with — the studio seeds them into its dashboard, the reader into its library. Four are short and each isolates one shape of the graph.

The fifth, **« La Fréquence Kerlaven »**, is the long one: 229 nodes, 9 endings, five acts, in [`stories/kerlaven.ts`](packages/story-format/src/stories/kerlaven.ts). It lives in its own module because of its size, and it is what the format is stress-tested against — item gates (`hasItem` / `lacksItem` on the links that open a button), chaining switches that pick a node from the state, hub nodes several acts fall back into, and an ending gated on a `visited` scene. A seeded walk in the `story-engine` suite reaches each of its nine endings and asserts no run ever stalls.

### Validation

`validateStory` returns a list of typed issues, split into two levels:

- **`error`** — the story is not playable: missing start scene, link to a nonexistent scene, duplicate ids, choice without a label, node mixing choices and chaining, **automatic chaining loop** the reading would never leave. The studio blocks the playtest, the reader refuses the file.
- **`warning`** — a writing problem that does not prevent playing: orphan scene, dead end, ending that keeps outgoing links, chaining whose links are all conditional, condition reading a variable that is never written.

The studio calls it on every keystroke: offending nodes get a red ring, and the bottom bar lists the issues, clickable.

---

## The engine

```ts
import { StoryEngine } from '@embranche/story-engine';

const engine = new StoryEngine(story);

engine.getCurrentScene(); // text + ONLY the choices whose condition holds
engine.choose('vers-lucioles'); // validates, applies the effects, moves on
engine.advance(); // moves on one node when the story chains by itself
engine.goBack(); // returns to the previous choice
engine.serialize(); // save (store it wherever you like)

engine.on('story:ended', ({ ending }) => console.log(ending.name));
const unsubscribe = engine.subscribe(() => render()); // for useSyncExternalStore
```

Three points worth knowing:

- **`advance` unrolls one node at a time.** The engine could unroll the whole chain at once; it does not, because each node walked through must be able to appear at its own pace in the conversation. The UI calls back once the messages have arrived.
- **`goBack` returns to the last _choice_, not to the last node** — and it replays rather than inverts. Stepping back a single node would put the player in front of a scene that immediately moves on again. Undoing a `toggle` or a `set` that overwrote a value is impossible by inversion: the engine being deterministic, it starts from a fresh state and replays the truncated history — exact by construction.
- **The snapshot has a stable reference** as long as the state does not change. That is exactly the contract of `useSyncExternalStore`, hence a thirty-line React bridge (`useStory`) with no duplicated state to resynchronize.

The engine persists nothing. `serialize()` returns a string and the caller decides where it goes — the app is what calls `localStorage`.

---

## The studio

Two screens: the dashboard (create, open, duplicate, import, export, delete) and the graph editor.

On the canvas, **the color of a node is its kind** — cold ink for the correspondent, green for the player's voice, plum for a decision. It is the most structuring information in the graph, since it says whether the reading stops there or carries on by itself; it must therefore read without zooming. A label spells it out as well: color never carries the information alone.

An edge on the canvas is exactly a `Link` of the story — nothing is hidden in the source node. Dragging an edge creates a link to any node already written, which is the whole "reach a distant node" gesture. A connection that would mix choices and chaining is refused as it is drawn, rather than reported afterwards.

A link is selected and cut on the canvas like a node is: clicking it turns it the selection colour, and **Suppr** removes it. React Flow is controlled here, so an edge is selected because the projection says so — an editor that drops the selection change leaves the delete key with nothing to remove.

Three buttons create the three kinds, colored like what they produce. From a selected node, they create the continuation: the node **and** its link, so never a dangling target. They obey the same rule as the drag, and go out when the kind they produce could not be linked — a toolbar that offers what the canvas will refuse teaches the wrong thing about the format.

The badge next to the title carries the state of health of the story, in three states because there are three: **injouable** (blocking errors), **jouable, à revoir** (warnings only — a draft is allowed to be halfway), **cohérent**. Pressing it unfolds the list of what is left. Only the first state blocks the playtest.

The right-hand panel edits the kind, the text (block by block) and the outgoing links. On a `choice` node it also shows the condition and the effects of its incoming link — for the author, "this button only appears if…" is a property of the button, even though the data lives on the edge — and lets it be cut from there, since reading a link from one end and having to go find its other end to remove it is a detour the panel can spare.

Conditions are built row by row for the common case — a list of tests joined by AND or OR. A nested condition, hand-written in an imported JSON, falls back to a JSON field validated by the schema: an austere field beats a rewrite that would lose information.

The **playtest** runs the current story through `story-engine`, without leaving the editor, with the same engine as the reader. Choices whose condition does not hold are greyed out rather than hidden — this is a proofreading tool, not a run. It can start from the selected node instead of the beginning, and says so: the run then begins with the initial state of the story, not with what the path there would have set.

Work in progress is stored in `localStorage` (deferred write of 400 ms, flushed before the tab closes).

### Reading the graph

A story is read as a path, so the canvas answers "what leads here" and "what follows" rather than merely "what is selected". Selecting a node lights its whole upstream in one tint and its whole downstream in another, and fades the rest — faded, not hidden: the shape of the story must stay legible while one branch is being looked at. The **Focus** button turns it off.

Every edge is arrowed. A conditional link is dashed and animated; a broken one turns red; and when the dead-path analysis is on, a link no run can follow goes grey and still. The links touching the selected node are drawn heavier than the rest of its cone: on a long story that cone covers nearly the whole graph, and lighting it evenly would say little more than "everything is connected".

Following one path among hundreds is a matter of what covers what. The wiring is drawn **behind** the cards — React Flow lifts an edge above them as soon as its z-index passes theirs, and a line across the text of a scene is what turns a dense graph into a scribble — and the edge under the cursor comes out full, whatever the focus is dimming.

Where a link leaves and enters a node depends on the two positions. Falling from the bottom edge into the top one means going forward; a link that climbs back up, or runs across a rank, leaves through a side and brackets around the cards instead of being drawn over them. Those side ports are anchors, not affordances: they are invisible and cannot be grabbed, since only one gesture draws a link.

**Chemins morts** answers a question the graph cannot: `findUnreachableScenes` looks for an arrow leading to a node, `exploreReachable` looks for a *run*. A choice conditioned on a variable no effect ever sets is an arrow that is never followed, and the scene behind it is an orphan only a state-space search reveals. That search is bounded — beyond its budget it says it could not conclude rather than passing a partial answer off as a verdict.

**Ranger** lays the graph out in layers: rank by longest path, order by barycentric sweeps, then coordinates. Written in `lib/layout` rather than pulled from `dagre` or `elk` — a story graph is small and almost a tree, and the studio would gain a dependency for a hundred lines it can own and test.

A link that skips ranks — the merge back to a crossroads, the shortcut to an ending — is cut into one virtual node per crossed rank so the ordering hears about it, since a barycentric sweep only ever looks at the rank above and the rank below. Those lanes are dropped before the coordinates: reserving a real corridor for them was tried and made the graph both wider and more tangled, every lane pushing its whole rank rightwards. Ordering alone takes a fifth off the links drawn over a card on the long sample story, which `layout.test` holds as a budget.

### Editing gestures

Undo and redo hold whole documents rather than inverse operations: `lib/storyDoc` is pure and immutable, so a version of the story is a reference to keep. Granularity is the only subtlety — consecutive changes of the same nature and close in time merge into one, so undoing a title is undoing the title and not one letter of it, and a drag is one step whatever its length.

| Geste                 | Raccourci                        |
| --------------------- | -------------------------------- |
| Annuler / rétablir    | `Ctrl+Z` / `Ctrl+Maj+Z`, `Ctrl+Y` |
| Copier / coller       | `Ctrl+C` / `Ctrl+V`               |
| Dupliquer la sélection | `Ctrl+D`                         |
| Supprimer             | `Suppr` / `Retour arrière`        |
| Sélection multiple    | `Maj` + tracé, `Ctrl` + clic      |

They all stand down while the author is typing: a text field has its own undo, and stealing `Ctrl+Z` from it would be worse than not offering the shortcut.

A copied fragment keeps its internal wiring *and* stays plugged into the rest of the story: a link inside the fragment follows the copy, a link pointing outside it is kept as long as its target still exists, and anything else is dropped — never a dangling target.

The **variables table** answers what scattering conditions and effects across the links makes hard to see: who writes `prudent`, and does anyone still read it. Variables and items sit side by side, every row leads back to the node it comes from, and a variable nobody reads is flagged without being called an error — a draft is allowed to be halfway.

---

## The reader

Mobile first, then widened: touch targets of at least 48 px, choices as full-width buttons reachable with the thumb, `env(safe-area-inset-*)` respected, no hover required, text readable without zooming. Beyond 720 px, the reading is recentered as a column rather than stretched.

Reading happens as a conversation: messages arrive one by one with a typing indicator, and the chosen answer stays in the thread. Tapping the conversation skips the wait. A system reduced-motion preference displays the scene in one block, changing nothing to the game.

When the current node awaits no decision, the story carries on by itself — but only once its messages have arrived, and after the same silence as between two messages. That is what makes a forced player line, or two lines in a row from the correspondent, read as a real conversation rather than as a block dropping all at once.

Saves, the record of seen endings and the light/dark mode live in `localStorage`, wired from the app.

### From the studio to the reader

1. Studio → **Exporter JSON** (or the ⤓ icon on the dashboard).
2. Reader → **＋** at the top of the library → pick the file.

The reader revalidates the document and flatly refuses an inconsistent story.

---

## Tests

254 tests, all green.

| Suite          | What it covers                                                                   |
| -------------- | -------------------------------------------------------------------------------- |
| `story-format` | schema, graph coherence, migration 1 → 2, JSON round-trip, error cases, inventory of the variables and items a story reads and writes |
| `story-engine` | progression, automatic chaining, conditions, effects, going back, serialization, events, condition-aware reachability, seeded walks of the long sample story down to each of its endings |
| `studio`       | editing operations, copy / paste of a fragment, undo granularity, automatic layout, full-text search, projection to React Flow, persistence, import, and the editor itself end to end |
| `reader`       | full run to an ending, conditional choice, resume, conversation                   |

---

## What is not here

See [BACKLOG.md](BACKLOG.md). In short: no Tauri (the apps are standalone web apps and Tauri-ready, the integration comes later), no media, no accounts, and no variable interpolation in the text.

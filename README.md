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
  story-format/    Schema, types and validation of the story format (JSON).
  story-engine/    Story engine. Pure TypeScript.
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
pnpm test          # 166 tests
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

Three buttons create the three kinds, colored like what they produce. From a selected node, they create the continuation: the node **and** its link, so never a dangling target.

The right-hand panel edits the kind, the text (block by block) and the outgoing links. On a `choice` node it also shows the condition and the effects of its incoming link — for the author, "this button only appears if…" is a property of the button, even though the data lives on the edge.

Conditions are built row by row for the common case — a list of tests joined by AND or OR. A nested condition, hand-written in an imported JSON, falls back to a JSON field validated by the schema: an austere field beats a rewrite that would lose information.

The **playtest** runs the current story through `story-engine`, without leaving the editor, with the same engine as the reader. Choices whose condition does not hold are greyed out rather than hidden — this is a proofreading tool, not a run.

Work in progress is stored in `localStorage` (deferred write of 400 ms, flushed before the tab closes).

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

166 tests, all green.

| Suite          | What it covers                                                                   |
| -------------- | -------------------------------------------------------------------------------- |
| `story-format` | schema, graph coherence, migration 1 → 2, JSON round-trip, error cases            |
| `story-engine` | progression, automatic chaining, conditions, effects, going back, serialization, events |
| `studio`       | editing operations, projection to React Flow, persistence, import                 |
| `reader`       | full run to an ending, conditional choice, resume, conversation                   |

---

## What is not here

See [BACKLOG.md](BACKLOG.md). In short: no Tauri (the apps are standalone web apps and Tauri-ready, the integration comes later), no media, no accounts, no undo in the studio.

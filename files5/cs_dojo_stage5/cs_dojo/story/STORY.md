# story/ — node map ("bomj simulator")

A survival arc: you start on the street with nothing and climb back to papers,
a lease and a car. It **shares the Arcade screen as a tab** — no lobby slot of
its own — but stays a separate folder, so it is still a one-folder session.

```js
Dojo.Arcade.registerTab({ id: "story", label: "📖 Story", render: renderStory });
```

`renderStory(body)` takes the container it should draw into and must not call
`showScreen` itself; the Arcade owns the screen.

## The Life shop lives here
The Story tab renders, in order: the framing line, **the whole life shop**
(`Dojo.renderLifeTab`), then the node map. Survival and the arc run on the
same coin and tell the same story, so they share a surface — you see what
state you're in, what you can do about it, and where you're trying to get,
without changing screens.

`shop/life.js` still owns that panel. Story only hands it a container.

**Skeleton. The graph and unlock logic work; no scene is written.**

Stylesheet: `styles/story.css`.

## Files

| File | Role |
|---|---|
| `scenes.js` | **Pure data.** The whole graph. Stage 6 touches this file only. |
| `story.js` | The engine: state, resolution, map and scene rendering. |

Stylesheet: `styles/story.css`.

## Scene shape

```js
{
  id, act, title,
  requires: [nodeId],       every one must be complete to unlock
  needFlags: [flag],        narrative facts a scene depends on
  cost: { money },          charged when a choice is taken
  body: null | ["paragraph", ...],        // <-- stage 6 fills this in
  choices: [{
    id, label,
    need: { money, item, vital: { key, min } },   // shown, gates the button
    roll: 0.65,             // chance of `win`; omit for a certain outcome
    win:  { text, money, vitals: {}, shelter, item, flag,
            unlock: [nodeId], complete: true },
    lose: { text, money, vitals: {}, demote: true, flag }
  }]
}
```

Node states the engine derives: `locked` → `open` → (`failed`) → `done`.

## Scenes can be failed — and that was the open question

An arc where the only question is whether you can afford the next fee is a
shopping list with narration. So:

- A choice may carry a `roll`. Losing applies the `lose` branch and, because
  that branch omits `complete`, leaves the scene to be tried again — **and the
  entry fee is charged again.** That is what failing costs.
- `demote: true` knocks you one rung down the shelter ladder
  (apartment → car → hostel → street). It is the only way to lose ground, and
  it is the real teeth in the arc.
- **Money raises your odds; it never buys the outcome.** The expensive branch
  of a scene is the 85–90% one, the desperate branch is the 50% one.
- Every roll in the graph is at least 50/50. This is a study app's side
  activity, not a punishment engine. Verified by harness.

What failing never does: touch course progress, charge, completed topics, or
the Library. The worst outcome in the story costs money, vitals and a rung.

## Gates
Both live in `resolveChoice`, not in the renderer, so a future scene view can't
skip them:

1. **Vitals** — any vital ≤15 and nothing resolves.
2. **Requirements** — `need.money`, `need.item`, `need.vital` are checked
   before the fee is taken; a blocked choice renders disabled with the reason.

Resolving a scene then costs −8 thirst, −8 hunger, −6 hygiene, win or lose.

## Rules
- Vitals move **only** through `Dojo.LifeShop` (`effect`, `demoteShelter`).
  Never call `DB.patchVitals` from here.
- `resolveChoice` is the single place money leaves the wallet in this branch.
- Story reads `DB.getStoryProgress()` and nothing else about the player. It
  must not import from `library/`.
- Costs are in **$**, never charge.

## The Life shop lives here
The Story tab renders, in order: the framing line, **the whole life shop**
(`Dojo.renderLifeTab`), then the map or the open scene. Survival and the arc
run on the same coin and tell the same story.

## Stage 6 — what's left
Writing `body` for all 12 scenes, and the `text` line on every win/lose branch.
The engine reads both already; a scene with `body: null` renders a placeholder
and its choices still work. Nothing in `story.js` should need to change.

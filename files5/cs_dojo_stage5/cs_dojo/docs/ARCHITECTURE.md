# CS Dojo — Architecture

**Read this before touching any folder. It is short on purpose.**

The app is split into *branches*. A branch is a folder that owns one feature
end to end: its logic, its stylesheet, its screen, its docs. The point of the
split is that you can open a single folder in a fresh chat, hand over that
folder plus this file, and work on it without the other 5,000 lines.

---

## 1. The rule

> A branch may talk to **DB**, **Dojo.Bus**, **Dojo.Router** and the documented
> `Dojo.*` seam of another branch. It may not read another branch's internals,
> its DOM, or its private state.

Everything else follows from that.

---

## 2. The four seams

### `DB` — persistence (`data/db.js`)
The only thing that touches localStorage. Storage only: no prices, no odds, no
payouts, no growth thresholds. Those belong to the branch that owns them.

### `Dojo.Bus` — events
Branches announce **facts**, not instructions.

```js
Bus.emit("topic:completed", { topicId });   // a fact
Bus.on("topic:completed", () => renderGarden());  // whoever cares, reacts
```

Never emit `"renderGarden"`. If you find yourself calling another branch's
render function directly, publish an event instead.

Current events: `screen:changed`, `profile:changed`, `progress:changed`,
`wallet:changed`, `vitals:changed`, `arcade:round`, `story:node`.

### `Dojo.Router` — navigation
```js
Router.register("garden", { render: renderGarden });   // at load
Router.go("garden");                                    // from anywhere
```
A branch that isn't loaded isn't registered, and its lobby tile hides itself.
That is what makes a folder droppable.

### Tabs — sharing a screen
A branch can take a tab on another branch's screen instead of a lobby slot:
```js
Dojo.Arcade.registerTab({ id: "story", label: "📖 Story", render(body) {...} });
```
The host owns the screen and calls `showScreen`; the guest only fills the body
it is handed. `story/` sits inside the Arcade this way, and `shop/life.js` sits inside the
Story tab. Sharing a surface is not merging the code — every one of them keeps
its own folder, doc and stylesheet.

### `Dojo.<fn>` — the export seam
Every branch ends with:
```js
Object.assign(Dojo, { renderGarden, gardenSummary, ... });
```
and begins with a **shim block** of the things it borrows:
```js
const renderCharge = (...a) => Dojo.renderCharge(...a);
```
Those shims are late-bound on purpose — resolved at *call* time, not load
time — so branch load order doesn't matter and there are no circular imports.

---

## 3. Load order (`index.html`)

Four bands. Order *between* bands is load-bearing; order *within* band 3 is not.

```
1. core/core.js      kernel: state, Bus, Router, utils
   data/db.js        persistence
2. library/content/  pure course data (quotes, modules, then data.js)
3. branches          each registers itself on window.Dojo
4. core/boot.js      LAST — registers screens, wires cross-branch buttons, starts
```

`data.js` still has to come after `data_m*.js` — it references the `MODULE_N`
constants directly.

---

## 4. Working one branch at a time

To pick up a branch in a fresh chat, send:

1. this file,
2. the branch folder (its `.js`, its `.md`, its stylesheet),
3. `data/db.js` only if the change needs a new stored field.

You do **not** need `library/content/` unless you are writing course content —
it is ~3,000 lines of pure data and will eat the session for nothing.

If a change needs something a branch doesn't have, the answer is almost always
"add an export to the seam", not "reach into the other folder".

---

## 5. Two currencies, kept apart

| | earned by | spends on |
|---|---|---|
| ⚡ charge | studying — chunks and exams | cosmetic themes only |
| $ money | Garden dividends, Arcade | life goods, story scenes, game unlocks |

**Neither buys the other, ever.** The moment charge buys survival, the fastest
route to a passing score is grinding, and the whole learning argument in
PROJECT.md §5 collapses.

---

## 6. Invariants that must not drift

- `db.js` stores; branches decide. No tuning numbers in `db.js`.
- Migrations are additive. Never drop a field — see PROJECT.md §4.
- Money leaves the wallet in exactly one place per branch (`buy`, `beginRound`).
  Never call `DB.addMoney` from game logic; go through `Games.settle`.
- Vitals change in exactly one place: `LifeShop.cost(kind)` and `LifeShop.buy`.
  Never call `DB.patchVitals` from outside `shop/life.js`.
- **Low vitals gate the Arcade and Story. They never gate the Library.**
  Studying is always available, whatever state the character is in.
- Nothing decays on a wall clock. Being away from the app must stay free.
- No build step, no dependencies, no network. `index.html` opens and runs.

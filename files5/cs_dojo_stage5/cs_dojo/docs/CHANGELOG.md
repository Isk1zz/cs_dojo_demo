# Changelog

## Stage 5 — the story engine

**Tickets 2 → 7 per 6 hours.** Worth knowing which limit now binds: 7 tickets
is more than a full energy bar allows, so **energy caps a sitting** (10 rounds)
and **tickets cap the day**. Raising tickets alone doesn't open the floodgates;
raising energy would.

**Story split into engine + content**
- `story/scenes.js` — pure data, the whole graph. Stage 6 touches this only.
- `story/story.js` — state, resolution, map and scene rendering.

**The graph** — 12 scenes across 4 acts, each with 1–2 choices, requirements,
odds and outcomes. Harness walks the full arc: every `requires` and `unlock`
resolves, every roll has a lose branch, all odds land between 50% and 90%.

**Scenes can be failed** (the open question from stage 4, answered)
- A choice may carry a `roll`. Losing applies the lose branch and leaves the
  scene incomplete — so the entry fee is charged again on the retry.
- `demote: true` knocks you a rung down the shelter ladder. It's the only way
  to lose ground, and every act has one.
- **Money raises your odds, it never buys the outcome.** The expensive branch
  of a scene is the 85–90% one; the desperate branch is the 50% one.
- Failing never touches course progress, charge or the Library.

**DB** — `storyProgress` gains `attempts: { nodeId: { tries, lastOutcome } }`
and `flags: []`. Both additive with defaults; v4 profiles are unaffected.

**Seams added** — `LifeShop.effect(patch)` and `LifeShop.demoteShelter()`, so
story outcomes change vitals without any branch but `shop/life.js` calling
`DB.patchVitals`.

## Stage 4 — Hi-Lo, Blackjack, night theft

**Night theft — the sink the economy was missing**
On the daily tick, a chance that cash is stolen overnight. Street 1-in-3 for
20–50%; hostel 1-in-12 for 10–25%; car 1-in-20 for 10–20%; apartment never.
A **percentage**, so it bites the same at any wealth level. Measured over 60k
nights: fires 33.1% of the time on the street, takes 20–50%, average 35%.

This is now the main reason to buy shelter and the main reason the wallet
can't run away. Same rule as decay — daily tick only, never a wall clock, so
being away from the app stays free.

**Hi-Lo** — a tie loses, `payout = 0.96 x 13 / w`. Flat 96% for every card and
both directions (measured 95.6–96.2% across all 24 valid calls), so no card is
a better bet than another. The push-on-tie version was tried and discarded:
"higher" on an ace can never lose, so the house could only take a cut by
paying under 1x on a win.

**Blackjack** — six-deck shoe, dealer stands on 17, 3:2 naturals, push
returns, double down in, splits out for v1. It's the $300 unlock because it's
the one game where playing well matters (~99% vs ~96% flat elsewhere) — the
expensive unlock buys a better game, not a better rake.

**Codes** — all cheats now sit in one `CODES` table in `settings.js`:
`admin613` (unlock all topics) and `parnasa100` (+$100).

**Also** — `raise(round, amount)` added to `games.js` so a double down takes
extra money through the seam rather than touching `DB.spendMoney` directly.

## Stage 3 — Crash, game unlocks, and the money side gathered in one place

**Story and the Life shop are one surface**
- The Life shop moved off the Shop screen and onto the **Story tab**: framing
  line, vitals + goods, then the node map, in that order.
- The Shop screen is charge-only again, no tabs.
- The split is now by coin, not by folder: ⚡ buys themes on the Shop screen,
  $ buys everything else on the Story tab. `shop/life.js` still owns the panel
  and renders as a guest into whatever container it's handed.

**Game unlocks** — one-off, bought with money, stored as `game_<id>`
| Crash | Hi-Lo | Blackjack |
|---|---|---|
| $75 | $150 | $300 |

`beginRound(stake, gameId)` refuses a locked game, so the gate holds even if a
card renders wrong. Charge can never buy an unlock.

**Crash — built**
```
crash = 1 / (1 - u)   plus a 4% forced bust at 1.00x
```
`P(crash >= m) = 1/m` makes the raw game exactly fair, so the forced bust is
what creates the edge — and it makes expected return **96% at every target**.
There is no clever multiplier to aim for. Verified at 1.5x/2x/5x/10x over
200k rounds each.

- Doubles every 4s; crash point rolled once up front so waiting can't nudge it.
- `MAX_MULT` 25x caps the tail — 25 x the $50 stake cap is $1,250, already the
  biggest number in the app. Without a cap one round would trivialise the Garden.
- One round live at a time; leaving the panel kills the frame loop.

## Stage 2 — life shop, vitals, and two structural merges

**Story merged into the Arcade**
- The Arcade screen now has Games and Story tabs. `story/` registers itself via
  `Arcade.registerTab` — one call, one line. Both keep their own folder, doc
  and stylesheet, so each is still a one-folder session.
- The standalone Story screen and its lobby tile are gone.
- Story is framed as the survival arc it was always described as: street →
  papers → lease → car.

**Review moved into the Garden**
- The "Review what's due" lobby tile is gone. A topic due for review is now a
  **plant that needs watering**: 💧 marker on the cell, a count panel at the
  top of the Garden, and a button that starts the first one.
- `gardenSummary()` leads with the watering count — it's the part with a
  deadline — and puts dividends second.

**Life shop + vitals (stage 2 proper)**
- Shop screen split into Themes (charge) and Life (money) tabs.
- Vitals strip added under the charge bar: hunger, thirst, hygiene, shelter,
  wallet. Repaints on `vitals:changed` and `wallet:changed`.
- 10 goods across food/water, hygiene, and shelter & papers.
- Shelter tiers change the daily upkeep multiplier: street ×1.0, hostel ×0.7,
  car ×0.55, apartment ×0.35.

**The decay rule — the decision that needed making**
Decay is **per activity, not per clock**. Vitals fall when you do things
(chunk, exam, arcade round, story scene) plus one tick per *day the app is
opened*, softened by shelter. Two weeks away costs one tick, not fourteen.

A real-time drain would have punished taking days off, which is what spacing is
for — PROJECT.md §5 rejected streaks for that exact reason and clock decay is
the same mechanic in a different coat.

**Consequences of running empty (≤15 on any vital)**
Arcade shut, story scenes shut. **The Library is never gated** — studying is
always available. Upkeep runs roughly $9/day at ~10 chunks/day; a three-plant
Garden pays $9/day and a full one pays $78.

**Fixed**
- `fmtWait` could render "23h 60m" — it ceil'd the minute remainder after
  splitting the hours. Now rounds to whole minutes first.

**Verified** by harness: story tab registers inside the Arcade, both tab sets
render, 10 chunks cost −30/−20/−10, a 6-year absence fires exactly one daily
tick, a second tick the same day is skipped, weak state blocks `beginRound`
while `startTopic` stays reachable, and buying recovers.

## Stage 1 — restructure into branches + DB v5 (this session)

**Structure**
- `app.js` (1,561 lines) split into 13 branch modules. The code was *sliced*,
  not retyped — logic is byte-identical apart from the shim/export blocks and
  the specific changes listed below.
- `style.css` (1,180 lines) split into `styles/base.css` plus one stylesheet
  per branch. `base.css` still holds the design system and core screens; it
  can be thinned further later.
- Course content moved to `library/content/`.
- New: `core/core.js` (Bus + Router), `core/boot.js`, `docs/`.
- Every folder has its own `.md`.

**db.js → v5** (migration is additive; v4 profiles keep everything)
- `wallet`, `energy` + `energyUpdatedAt`, `tickets` + `ticketsUpdatedAt`,
  `lastDividendClaim`, `inventory`, `storyProgress`, `vitals`
- from the in-flight work before the spec: `chargeEarned`, `chargeSpent`,
  `ownedThemes`
- `CHARGE_CAP` 150 → 400. It is now a *wallet* cap, not a lifetime cap:
  spending frees room to earn. This retires the "charge goes dead 4 topics
  into a 26-topic course" issue in PROJECT.md §6.
- Energy and tickets regenerate **lazily** — computed from a timestamp on
  read, so nothing breaks when the tab has been shut for three days.

**Themes / charge bar** (the original ask)
- The charge bar hardcoded an indigo strip and a sky-blue fill, so it looked
  pasted in under every theme but Indigo Night. It now reads
  `--bg-deep-rgb` and `--bolt-1/2/3`, set per theme.
- Each free theme got a matching bolt palette.
- 6 premium themes added with a `bg` background layer: Sakura Midnight (90),
  Sumi Ink (110), Amber Terminal (120), Koi Pond (150), Neon Ronin (180),
  Fuji Dawn (220). A premium theme the profile doesn't own falls back to
  Indigo rather than applying silently.

**Features landed**
- Shop screen + lobby tile. Charge sink, cosmetic only.
- Garden: v5 growth thresholds (7/21/30/60d) and daily dividends
  ($1/3/5/7/13/17 by stage, once per 24h).
- Settings: `admin613` unlock code, ToS/Privacy placeholder blocks.

**Skeletons registered but not implemented**
- `games/` — arcade shell, ticket + energy gate, `beginRound`/`settle` seam.
  Crash, Hi-Lo and Blackjack are *not* written.
- `story/` — 4-act node map, unlock logic, placeholder spine of 8 nodes.
  No narrative text.
- `shop/life.js` — life-goods catalogue and `buy()`. No screen, no vitals HUD.

**Bugs found and fixed while restructuring**
- `showScreen` called `closeDropdown`, which after the split lived inside
  another branch's closure — would have thrown on *every* screen change.
  Now guarded through the seam.
- `library.js` called `updateProfileBadge`, `stats.js` called `selectUnit`
  and `startTopic`, all without shims. Fixed.

**Verified** with a stub-DOM harness: 23 files load in order, all 30 seam
exports present, 9 screens render, charge caps, premium purchase and
fallback, dividend claim + 24h block, ticket exhaustion blocks a third round.

# data/ — persistence

`db.js` is the only file that touches `localStorage`. Key: `unit6-dojo-db`
(historical name, kept — renaming it would orphan every saved profile).

**db.js stores. Branches decide.** No prices, odds, payout tables, growth
thresholds or decay rates in this file, ever. If you are adding a tuning
number here, it belongs in the branch that owns the feature.

## Version 5

```js
{
  name, createdAt,
  completedTopics: [topicId],
  completedChunks: { topicId: [chunkIdx] },
  reviews: { topicId: { due, interval, ease, lapses, reps } },
  seenQuotes: [idx],

  // charge (⚡) — study currency
  charge, chargeEarned, chargeSpent, ownedThemes: [themeId],

  theme, lastPosition: { unitId, topicId, chunkIdx } | null,

  // v5 — money ($), energy, arcade tickets, life sim
  wallet,
  energy, energyUpdatedAt,
  tickets, ticketsUpdatedAt,
  lastDividendClaim,
  inventory: [itemId],
  storyProgress: { unlockedNodes: [], completedNodes: [] },
  vitals: { hunger, thirst, hygiene, shelterTier },

  stats: { miniQuizTotal, miniQuizCorrect, examQuestionsTotal,
           examQuestionsCorrect, examsTaken, examsPassed, topicStats }
}
```

### Migrations
`DB_VERSION` is 5; `migrate()` upgrades in place on load.

- v1→v2 legacy key folded into profiles
- v2→v3 `reviews` added, completed topics seeded due today
- v3→v4 `charge`, `theme`, `lastPosition`
- v4→v5 `chargeEarned`/`chargeSpent`/`ownedThemes`, then `wallet`, `energy`,
  `tickets`, `lastDividendClaim`, `inventory`, `storyProgress`, `vitals`

**Every migration is additive with a safe default. Never drop a field.**
`miniQuiz*` keys are historical — the UI says "Questions". Change labels in
the branch, never keys here.

## Lazy regeneration
Energy and tickets are **not** on a timer. `regen()` works out how much time
passed since the stored timestamp and credits that on read. This is what keeps
the numbers correct after the tab has been closed for three days.

- Energy: 100 max, full refill in 5h
- Tickets: 2 max, 2 per 6h

## All-or-nothing spends
`spendCharge`, `spendMoney`, `spendEnergy`, `spendTicket` return a boolean and
change nothing on failure, so a caller can never half-buy something.
`addCharge` returns what was *actually* added (0 at the cap).

## Gotchas
- `CHARGE_CAP` (400) is a **wallet** cap. It must stay ≥ the dearest shop item
  or that item is unreachable.
- `completedChunks` powers resume. It went unread for a long time. Don't
  "clean it up".
- `unlockAllTopics` (the admin code) deliberately does not touch reviews,
  stats or the wallet — a cheated profile should still look cheated in Stats.

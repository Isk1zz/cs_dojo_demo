# CS Dojo — Project Reference

Everything about how this app works, why it's built this way, and what's still open.
**Read this first if you're picking the project up cold.**

Last updated: August 2026

---

## 1. What it is

An offline, dependency-free study app. Content is broken into small chunks; each chunk
teaches one idea, shows a worked example, and asks a question. Passing a topic's mastery
exam schedules it for spaced review rather than marking it finished forever.

Open `index.html` in a browser. No build step, no server, no npm. That constraint is
deliberate — it means the app works offline, forever, with no maintenance surface.
**Don't add a build step or a dependency without a very good reason.**

Live at `Isk1zz.github.io/cs_dojo_demo` (GitHub Pages, branch `main`, root).

---

## 2. Files

| File | Role |
|---|---|
| `index.html` | All screens as `<section class="screen">`. Script order matters — see §3. |
| `style.css` | Everything visual. CSS variables at `:root` drive theming. |
| `app.js` | One IIFE. Navigation, rendering, all game logic. |
| `db.js` | localStorage persistence, profiles, spaced-review scheduling. Versioned with migrations. |
| `data.js` | Combines modules into `MODULES`, `UNITS`, `COURSES` and flattened topic lists. |
| `data_m1.js` … `data_m5.js` | Content. One module each. Pure data, no logic. |
| `quotes.js` | The wisdom pool shown on topic completion. |

**Script order in `index.html` is load-bearing:**
```
quotes.js → data_m1..N.js → data.js → db.js → app.js
```
`data.js` references `MODULE_N` constants, so every module file must load before it.
`app.js` references everything, so it loads last.

---

## 3. Adding content

### A new module
1. Create `data_mN.js` defining `const MODULE_N = {...}` with a `unit` field.
2. Add `<script src="data_mN.js"></script>` in `index.html` **before** `data.js`.
3. Add `MODULE_N` to the `MODULES` array in `data.js`.
4. Add it to an existing `UNITS` entry, or create a new one.

The app, DB and stats pick it up automatically. No other changes needed.

### A new course
Add an entry to `COURSES` in `data.js` listing the unit ids it contains. Set
`available: false` to render it as a "coming soon" card.

---

## 4. Data schemas

### Module (`data_m*.js`)

```js
const MODULE_N = {
  id: "slug", unit: 8, title: "...", icon: "🧠",
  topics: [{
    id: "slug", title: "...", desc: "...", icon: "🌱",
    wisdomTags: [],            // optional, on chunks — biases quote selection
    chunks: [{
      title: "...",
      explain: {
        blocks: [{ heading: "...", text: "HTML" }],   // modules 5+
        text: "HTML",                                 // legacy, modules 1–4
        analogy: "...",
        sources: [{ ref: "HTML citation", note: "..." }]
      },
      example: { label: "...", steps: ["HTML", "..."] },
      quiz: { question, options: [4], correct: 0-3, explanation }
    }],
    examQuestions: [{ question, options: [4], correct: 0-3 }]   // 5 per topic
  }]
};
```

`renderExplain` handles both `blocks` and legacy `text`, so modules 1–4 still work
untouched. Always use `blocks` for new content.

### Quote (`quotes.js`)

```js
{ text, author, source, tags: [], verified: bool, note?, rights? }
```

### Profile (`db.js`, version 4)

```js
{
  name, createdAt,
  completedTopics: [topicId],
  completedChunks: { topicId: [chunkIdx] },
  reviews: { topicId: { due, interval, ease, lapses, reps } },
  seenQuotes: [idx],
  charge: 0,
  theme: "indigo",
  lastPosition: { unitId, topicId, chunkIdx } | null,
  stats: { miniQuizTotal, miniQuizCorrect, examQuestionsTotal,
           examQuestionsCorrect, examsTaken, examsPassed,
           topicStats: { topicId: { attempts, bestScore, lastScore,
                                    completedAt, chunkResults } } }
}
```

**The `miniQuiz*` field names are historical.** The UI calls these "Questions" now.
Renaming the fields would invalidate every saved profile, so they stay. Change labels
in `app.js`, not keys in `db.js`.

### DB migrations
`DB_VERSION` is 4. `migrate()` runs on load and upgrades in place.
- **v1→v2** — legacy `unit6-dojo-progress` key folded into profiles
- **v2→v3** — added `reviews`; already-completed topics seeded as due today
- **v3→v4** — added `charge`, `theme`, `lastPosition`

Bump `DB_VERSION` and add a branch when the profile shape changes. Never drop existing
fields in a migration.

---

## 5. How the learning system works

The design follows a small number of well-evidenced findings. Each is noted so future
changes don't undo them by accident.

### Spaced review (SM-2)
Passing an exam schedules the topic forward: 1 day, then 6, then `interval × ease`.
Failing resets to 1 day and lowers ease (floored at 1.3). Due topics surface on the unit
map and in the lobby.

Practice testing and distributed practice are the only two techniques rated **high
utility** in Dunlosky et al. (2013)'s review of ten study methods. The app now does both.

**SM-2, not FSRS, deliberately.** FSRS needs hundreds of reviews before its model fits,
so it performs *worse* at small scale. Revisit only with real usage data.

### Question shuffling
Exam questions and their options are shuffled on **every** attempt. Before this, a failed
exam could be retried with byte-identical questions and passed by remembering positions.
`shuffleQuestion` pairs each option with a `wasCorrect` flag before shuffling, then
recomputes `correct`.

### Missed questions come back
A wrong chunk answer queues that chunk to be re-asked before the exam — straight to the
question, no re-reading. Re-reading is one of the *lowest*-rated techniques in the same
review.

### No hard locks
Every topic is reachable. Order is a `→ Recommended next` badge and a
`⤴ Jumping ahead` marker, not a gate. Hard sequencing enforced blocked practice
(interleaving beats it) and removed learner autonomy — the motivational need that
actually predicts engagement.

### What was deliberately NOT added
- **No points, badges, streaks or leaderboards.** Meta-analyses find small and unstable
  motivational effects; Hanus & Fox (2015) found badges and leaderboards *reduced*
  motivation. Researchers call the shallow version "racing stripes on a bicycle."
- **Streaks specifically** punish taking days off, which is exactly what spacing is for.
- **No AI features** — they'd break the offline/no-build property.

The lightning charge (§6) is a progress visualisation with a cap, not a scoring system.
Keep it that way.

---

## 6. Lightning charge

- **+5 to 7 per chunk** completed. Retries pay nothing — otherwise failing on purpose
  would be the fastest way to farm charge.
- **Topic bonus** = accumulated chunk charge × multiplier, where multiplier runs
  `0.7 + (examPct/100 × 0.8)` — so ×0.7 at 0%, ×1.5 at 100%.
- **Capped at `CHARGE_CAP` in `db.js`, currently 150.**
- `addCharge()` returns what was *actually* granted, so the UI never animates a gain
  that didn't happen.

> ⚠ **Known issue.** The 150 cap is reached roughly 4 topics into a 26-topic course.
> For the remaining 22 topics the system is dead. Either raise the cap or add the
> planned rewards sink so charge can be spent.

---

## 7. Garden

Growth stage is driven by the **review interval**, not by how many topics are finished:

| Stage | Trigger |
|---|---|
| 🌑 Fallow | Never attempted |
| 🌰 Seed | Attempted, not mastered |
| 🌱 Sprout | Just mastered (interval 1d) |
| 🌿 Seedling | Interval ≥ 6d |
| 🌾 Growing | Interval ≥ 16d |
| 🌳 Tree | Interval ≥ 45d |
| 🌸 Blossom | Interval ≥ 120d |

Lapsing a review drops the plant back. This makes the garden a picture of **retention**
rather than coverage — which is the app's whole argument.

> The Garden was requested without a spec. This is one interpretation. If it should be
> something else — a spendable space, a decorative reward for charge, a social feature —
> it's self-contained in `renderGarden()` and `GROWTH` in `app.js`.

---

## 8. Themes

Eight themes in Settings. Each repaints `--accent`, `--accent-light`, the glow variables,
**and** `--bg-deep`, `--bg-card`, `--bg-card-hover`, `--bg-surface`. Changing only the
accent barely registers — the background is most of what you see.

Text colours are intentionally *not* themed, so contrast stays readable everywhere.

Adding a theme: one entry in the `THEMES` array in `app.js`.

---

## 9. Content standards

These were set deliberately and shouldn't drift.

**Answer keys use the full A–D spread.** Modules 1–4 shipped with 88% of answers on B or
C — guessable without reading anything. Check any new module with:

```bash
grep -ho "correct: [0-3]" data_mN.js | sort | uniq -c
```

**Questions test application, not restatement.** "Which of these is overfitting?" is
recognition. "This model scores 98% on training and 61% on new data — what happened?"
requires running the idea on an unseen case.

**Distractors should be real misconceptions**, so choosing correctly requires
discriminating rather than eliminating nonsense.

**Every explanation block carries citations** in `explain.sources`, rendered in a
collapsible box, so a reader can verify any claim.

**Quotes must be source-checked.** Every entry in `quotes.js` carries a `verified` flag.
Famous quotes are fabricated far more often than people expect — "If you can't explain it
simply, you don't understand it well enough" is **not** Einstein, and "We are what we
repeatedly do" is Will Durant, not Aristotle. Don't add anything without finding the
primary source. Entries marked `verified: false` still need checking before public
release.

---

## 10. Licensing — unresolved, and it matters

The app is intended for eventual commercial release. That creates a real constraint on
where content comes from.

- Course textbooks used for research are **all rights reserved**, and one (Huawei's
  *Cloud Computing Technology*) is **CC BY-NC-ND** — non-commercial, no derivatives.
- Facts and concepts are **not** copyrightable. Particular expression is.

**So the rule for all new content:** teach the concepts, cite authoritative or
public-domain sources, and write original analogies and examples. `data_m5.js` was built
this way — it cites Mitchell, Sutton & Barto, Goodfellow, Hastie, Russell & Norvig, and
uses no textbook's analogies.

For cloud computing specifically, cite **NIST SP 800-145** rather than the Huawei book —
it's the origin of the five characteristics anyway and is US government work in the
public domain.

Quotes: avoid Coleman Barks' Rumi renderings and Tzvi Freeman's Chabad.org renderings.
Both are interpretive paraphrases still in copyright.

**The repo currently has no LICENSE file.** Decide this before adding more content.

*Not legal advice. Worth an hour with a lawyer if real money is involved.*

---

## 11. Current state

**Built:** Units 6 (Networks, Internet, Security), 7 (Programming Fundamentals),
8 (Machine Learning). 26 topics total. One course, "Intro to CS."

**Screens:** Landing → Lobby → Courses → Units → Topics → Lesson → Exam → Result.
Plus Garden, Settings, and the Stats modal.

**Not built:**
- Four more Unit 8 modules — Cloud Computing, Big Data, Blockchain, IoT & Sensors, VR
- The five-phase chunk flow: `predict → explain → example → apply → recall`.
  Adding a **predict** question before instruction exploits the pretesting effect;
  a **recall** prompt with no options at the end exploits the generation effect, which is
  stronger than recognition. Both need new content written per chunk — the schema should
  be frozen with optional `predict` and `recall` fields *before* the remaining modules
  are written, or all five will need retrofitting.
- A rewards sink for lightning charge (see §6)
- Launcher / desktop packaging
- Books section

**Open decisions:**
1. Does Unit 8 stay one entry, or split? Five modules ≈ 75 chunks in one track.
2. Raise `CHARGE_CAP` or add the sink?
3. What should the Garden actually be?
4. Licence for the repo and the content.

---

## 12. Gotchas

- **`renderExamQuestion` needs `const topic = getTopic()`.** It was once removed during a
  refactor while `topic.icon` and `topic.title` were still referenced two lines below —
  ReferenceError, blank exam screen, every exam broken. Easy to reintroduce.
- **`startExam` must reset `state.examSubmitted = []`**, or retries render with answers
  already revealed.
- **Exams grade against `state.examQuestions`, not `topic.examQuestions`** — the former is
  the shuffled copy. Grading against the original scores the wrong answers.
- **`completedChunks` is what powers resume.** It was written from v1 and read by nothing
  for a long time. Don't "clean it up."
- **Charge cap** — always use `addCharge`'s return value, not the requested amount.
- The README's clone command historically had both the username and repo name wrong.
  Correct: `git clone https://github.com/Isk1zz/cs_dojo_demo.git`

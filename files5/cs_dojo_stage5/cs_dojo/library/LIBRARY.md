# library/ — courses (was: "Courses")

The study half of the app. Courses → Units → Topics → Lesson chunks → Mastery
exam, plus the Stats modal. This is the **only** branch that touches course
content.

| File | Role |
|---|---|
| `library.js` | All course navigation, lesson rendering, exam logic |
| `stats.js` | The Stats modal (read-only over everyone's data) |
| `content/` | Pure data: `quotes.js`, `data_m1..m5.js`, `data.js` |

Stylesheet: currently in `styles/base.css` (not yet extracted — see below).

## Exports
`renderCourseSelect`, `renderUnitSelect`, `selectUnit`, `renderTopicMap`,
`updateGlobalProgress`, `startTopic`, `getTopic`, `startExam`, `libraryTotals`,
`resumeAt`, `startNextDueReview`, `showStatsModal`, `renderStats`

`resumeAt(pos)` and `startNextDueReview()` exist because the **lobby** owns the
Resume and Review tiles but must not know how to walk a course. It hands the
request over instead.

## Emits
`chunk:completed`, `topic:completed`, `exam:finished`, `progress:changed`

## Content schema
See PROJECT.md §4. Unchanged by the restructure. `renderExplain` still handles
both `blocks` (modules 5+) and legacy `text` (modules 1–4).

## Adding a course
`content/` holds the data; `data.js` combines it. Steps in PROJECT.md §3.
The plan for keeping this cheap in future sessions is one folder per course
under `content/` with its own manifest — **not yet done**, see below.

## Learning-design decisions that must not be undone
Full reasoning in PROJECT.md §5. Short version:

- Exam questions **and** their options are shuffled every attempt. Before this
  a failed exam could be retried and passed from position memory.
- Wrong chunk answers re-ask that chunk before the exam, straight to the
  question — no re-reading.
- No hard locks. Order is a recommendation badge, not a gate.
- No points, badges, streaks or leaderboards.
- **Nothing in the Shop or Arcade may buy progress, hints, retries or exam
  advantage.** That is the line the whole design rests on.

## Gotchas
- `renderExamQuestion` needs `const topic = getTopic()`. It was once removed
  during a refactor while `topic.icon` was still referenced two lines below —
  ReferenceError, blank exam screen, every exam broken.
- `startExam` must reset `state.examSubmitted = []` or retries render with
  answers pre-revealed.
- Exams grade against `state.examQuestions` (the shuffled copy), never
  `topic.examQuestions`.
- `content/data.js` must load after every `data_m*.js` — it references the
  `MODULE_N` constants directly.

## Not done
- Library-specific CSS is still inside `styles/base.css`.
- The five-phase chunk flow (`predict → explain → example → apply → recall`).
  Freeze the schema with optional `predict`/`recall` fields **before** writing
  the remaining modules or all of them need retrofitting.
- Per-course content folders + manifest, so a new course doesn't require
  loading the whole branch.

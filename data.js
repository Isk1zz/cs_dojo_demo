// ================================================
// Dojo — Data Combiner
//
// ARCHITECTURE NOTE (future expansion):
// ──────────────────────────────────────
// To add new modules, create a data file (e.g., data_m5.js)
// that defines a const (e.g., MODULE_5) with a `unit` field,
// then:
//   1. Add a <script src="data_m5.js"></script> in index.html
//      BEFORE this file's <script> tag.
//   2. Add MODULE_5 to the MODULES array below.
//   3. Add it to an existing UNITS entry, or create a new
//      UNITS entry if it belongs to a new unit.
//
// The app, DB, and stats will automatically pick up
// new modules — no other code changes needed.
// ================================================

const MODULES = [
  MODULE_1,   // Computer Networks (Unit 6)
  MODULE_2,   // The Internet (Unit 6)
  MODULE_3,   // Security (Unit 6)
  MODULE_4,   // Programming Fundamentals (Unit 7)

  // ── Following modules go here ──
  // MODULE_5,  // e.g., "Databases" (Unit 8 topics)
];

// Units group modules into independent, separately-unlocked tracks.
// Each unit has its own sequential progression — finishing Unit 6
// is NOT required to start Unit 7.
const UNITS = [
  {
    id: 6,
    title: "Unit 6",
    subtitle: "Networks, Internet & Security",
    icon: "🖧",
    modules: [MODULE_1, MODULE_2, MODULE_3]
  },
  {
    id: 7,
    title: "Unit 7",
    subtitle: "Programming Fundamentals",
    icon: "💻",
    modules: [MODULE_4]
  }
];

// Flatten ALL topics across every unit — used for grand-total stats
// (the Stats modal shows progress across everything, all units combined).
const ALL_TOPICS = MODULES.flatMap(m =>
  m.topics.map(t => ({
    ...t,
    moduleId: m.id,
    moduleTitle: m.title,
    moduleIcon: m.icon,
    unit: m.unit
  }))
);

// Per-unit flattened topic lists — used for scoped rendering and
// INDEPENDENT sequential unlock within each unit.
const UNIT_TOPICS = {};
UNITS.forEach(u => {
  UNIT_TOPICS[u.id] = u.modules.flatMap(m =>
    m.topics.map(t => ({
      ...t,
      moduleId: m.id,
      moduleTitle: m.title,
      moduleIcon: m.icon,
      unit: m.unit
    }))
  );
});

// ================================================
// CS Dojo — STORY / content
// ------------------------------------------------
// PURE DATA. No DOM, no DB, no logic. story/story.js is the engine
// that reads this; stage 6 (writing the narrative) should touch this
// file and nothing else.
//
// ---- Scene shape ----
//
// {
//   id, act, title,
//   requires: [nodeId],        every one must be complete to unlock
//   needFlags: [flag],         narrative facts a scene depends on
//   cost: { money },           charged on OPENING the scene
//   body: null | [ "paragraph", ... ],       <-- stage 6 fills this in
//   choices: [{
//     id, label,
//     need:   { money, item, vital: { key, min } },   shown but not charged
//     roll:   0.65,            chance of `win`; omit for a certain outcome
//     win:  { text, money, vitals: {}, shelter, item, flag,
//             unlock: [nodeId], complete: true },
//     lose: { text, money, vitals: {}, demote: true, flag }
//   }]
// }
//
// ---- The rules the engine enforces ----
//
// * `complete: true` is what marks a node done and opens what follows.
//   A losing branch normally omits it, so the node can be retried —
//   and the entry `cost` is charged again. That is the price of failing.
// * `demote: true` knocks you one rung down the shelter ladder. This is
//   the only way to LOSE GROUND, and every act has at least one.
// * A scene never touches course progress, charge, or the Library.
//
// ---- Why scenes can be failed ----
// An arc where the only question is whether you can afford the next fee
// is a shopping list with narration. Rolls give the money a stake:
// buying a better option raises the odds, it doesn't buy the outcome.
// Every roll here is at least 50/50 — this is a study app's side
// activity, not a punishment engine.
// ================================================

const STORY_ACTS = [
  { id: 1, title: "The Fall",               sub: "Street survival, loss of identity" },
  { id: 2, title: "The Grind",              sub: "Street economy, illness, medicine" },
  { id: 3, title: "The Bureaucratic Climb", sub: "Hostel, reclaiming your documents" },
  { id: 4, title: "Reclaiming Life",        sub: "A lease, a licence, a road out" }
];

const STORY_SCENES = [
  // ---------- Act I — The Fall ----------
  {
    id: "act1_node1", act: 1, title: "First night out",
    requires: [], cost: null, body: null,
    choices: [
      { id: "doorway", label: "Sleep in a shop doorway",
        win: { text: null, vitals: { hygiene: -10 }, complete: true, unlock: ["act1_node2"], flag: "slept_rough" } },
      { id: "station", label: "Try the station waiting room",
        roll: 0.6,
        win:  { text: null, vitals: { hygiene: -4 }, complete: true, unlock: ["act1_node2"], flag: "knows_station" },
        lose: { text: null, vitals: { hygiene: -12, thirst: -10 } } }
    ]
  },
  {
    id: "act1_node2", act: 1, title: "Nothing in the bag",
    requires: ["act1_node1"], cost: null, body: null,
    choices: [
      { id: "ask", label: "Ask someone for change", roll: 0.55,
        win:  { text: null, money: 12, complete: true, unlock: ["act1_node3"] },
        lose: { text: null, vitals: { hunger: -8 } } },
      { id: "bins", label: "Work the bins behind the bakery",
        win: { text: null, vitals: { hunger: 20, hygiene: -15 }, complete: true, unlock: ["act1_node3"] } }
    ]
  },
  {
    id: "act1_node3", act: 1, title: "Somebody wants the spot",
    requires: ["act1_node2"], cost: null, body: null,
    choices: [
      { id: "move", label: "Move on without arguing",
        win: { text: null, vitals: { hunger: -5 }, complete: true, unlock: ["act2_node1"] } },
      { id: "hold", label: "Hold your ground", roll: 0.5,
        win:  { text: null, flag: "stood_ground", complete: true, unlock: ["act2_node1"] },
        lose: { text: null, money: -15, vitals: { hygiene: -20, hunger: -10 } } }
    ]
  },

  // ---------- Act II — The Grind ----------
  {
    id: "act2_node1", act: 2, title: "A day's work, cash only",
    requires: ["act1_node3"], cost: null, body: null,
    choices: [
      { id: "shift", label: "Take the shift", roll: 0.75,
        win:  { text: null, money: 45, vitals: { hunger: -15, thirst: -15 }, complete: true, unlock: ["act2_node2"] },
        lose: { text: null, vitals: { hunger: -15, thirst: -15 } } },
      { id: "wait", label: "Wait for something better",
        win: { text: null, money: 10, complete: true, unlock: ["act2_node2"] } }
    ]
  },
  {
    id: "act2_node2", act: 2, title: "The cough",
    requires: ["act2_node1"], cost: { money: 20 }, body: null,
    choices: [
      { id: "clinic", label: "Walk-in clinic", need: { money: 20 }, roll: 0.85,
        win:  { text: null, vitals: { hunger: -5 }, complete: true, unlock: ["act2_node3"], flag: "seen_a_doctor" },
        lose: { text: null, vitals: { hunger: -15, thirst: -15 } } },
      { id: "ride", label: "Ride it out", roll: 0.5,
        win:  { text: null, complete: true, unlock: ["act2_node3"] },
        lose: { text: null, vitals: { hunger: -25, thirst: -25, hygiene: -15 }, demote: true } }
    ]
  },
  {
    id: "act2_node3", act: 2, title: "Everything you own, in one bag",
    requires: ["act2_node2"], cost: null, body: null,
    choices: [
      { id: "carry", label: "Carry it everywhere",
        win: { text: null, vitals: { hunger: -8 }, complete: true, unlock: ["act3_node1"] } },
      { id: "stash", label: "Stash it and hope", roll: 0.55,
        win:  { text: null, complete: true, unlock: ["act3_node1"] },
        lose: { text: null, money: -40, complete: true, unlock: ["act3_node1"] } }
    ]
  },

  // ---------- Act III — The Bureaucratic Climb ----------
  {
    id: "act3_node1", act: 3, title: "A bed with a number on it",
    requires: ["act2_node3"], cost: { money: 25 }, body: null,
    choices: [
      { id: "book", label: "Pay for the bed", need: { money: 25 },
        win: { text: null, shelter: "hostel", vitals: { hygiene: 25 }, complete: true,
               unlock: ["act3_node2"], flag: "has_bed" } }
    ]
  },
  {
    id: "act3_node2", act: 3, title: "Proof that you exist",
    requires: ["act3_node1"], cost: { money: 60 }, body: null,
    choices: [
      { id: "apply", label: "Apply with the hostel's address", need: { item: "hostel", money: 60 }, roll: 0.8,
        win:  { text: null, item: "id_card", complete: true, unlock: ["act3_node3"], flag: "has_id" },
        lose: { text: null, vitals: { hunger: -10 } } },
      { id: "queue", label: "Queue at the counter and argue", roll: 0.5,
        win:  { text: null, item: "id_card", complete: true, unlock: ["act3_node3"], flag: "has_id" },
        lose: { text: null, vitals: { hunger: -20, thirst: -20 } } }
    ]
  },
  {
    id: "act3_node3", act: 3, title: "An address they'll accept",
    requires: ["act3_node2"], needFlags: ["has_id"], cost: null, body: null,
    choices: [
      { id: "bank", label: "Open an account",
        win: { text: null, flag: "has_account", complete: true, unlock: ["act4_node1"] } },
      { id: "job", label: "Go after a job on the books", roll: 0.7,
        win:  { text: null, money: 80, flag: "has_payslip", complete: true, unlock: ["act4_node1"] },
        lose: { text: null, vitals: { hunger: -10, thirst: -10 } } }
    ]
  },

  // ---------- Act IV — Reclaiming Life ----------
  {
    id: "act4_node1", act: 4, title: "A door of your own",
    requires: ["act3_node3"], cost: { money: 250 }, body: null,
    choices: [
      { id: "sign", label: "Sign the lease", need: { money: 250, item: "id_card" },
        win: { text: null, shelter: "apartment", vitals: { hygiene: 30 }, complete: true,
               unlock: ["act4_node2"], flag: "has_lease" } }
    ]
  },
  {
    id: "act4_node2", act: 4, title: "Keys and a road",
    requires: ["act4_node1"], cost: { money: 150 }, body: null,
    choices: [
      { id: "test", label: "Sit the test", need: { money: 150 }, roll: 0.7,
        win:  { text: null, item: "licence", complete: true, unlock: ["act4_node3"], flag: "can_drive" },
        lose: { text: null } },
      { id: "lessons", label: "Pay for lessons first", need: { money: 220 }, roll: 0.9,
        win:  { text: null, money: -70, item: "licence", complete: true, unlock: ["act4_node3"], flag: "can_drive" },
        lose: { text: null, money: -70 } }
    ]
  },
  {
    id: "act4_node3", act: 4, title: "Somewhere to be in the morning",
    requires: ["act4_node2"], needFlags: ["can_drive"], cost: null, body: null,
    choices: [
      { id: "stay", label: "Stay where you are and keep at it",
        win: { text: null, complete: true, flag: "arc_complete" } },
      { id: "leave", label: "Pack the car and go",
        need: { item: "car" },
        win: { text: null, complete: true, flag: "arc_complete" } }
    ]
  }
];

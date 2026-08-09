// ================================================
// Unit6 Dojo — Local Database (db.js)
// Manages profiles, progress, and statistics
// using localStorage as a persistent store.
//
// FUTURE-PROOFING:
// - All data is keyed by topic ID, not index
// - DB version field allows migrations
// - Profiles are independent — no cross-contamination
// - Adding new modules/topics requires zero DB changes
// ================================================

const DB = (() => {
  const STORAGE_KEY = "unit6-dojo-db";
  const DB_VERSION = 4;

  // ---- Default structures ----
  function defaultDB() {
    return {
      version: DB_VERSION,
      activeProfileId: null,
      profiles: {}
    };
  }

  function defaultProfile(name) {
    return {
      name: name || "Student",
      createdAt: new Date().toISOString(),
      completedTopics: [],
      completedChunks: {},   // { topicId: [0, 1, 2] }
      reviews: {},           // { topicId: { due, interval, ease, lapses, reps } }
      seenQuotes: [],        // recent quote indices, so they don't repeat
      charge: 0,             // lightning charge, capped at CHARGE_CAP
      theme: "indigo",       // colour theme id
      lastPosition: null,    // { unitId, topicId, chunkIdx } — resume point
      stats: {
        miniQuizTotal: 0,
        miniQuizCorrect: 0,
        examQuestionsTotal: 0,
        examQuestionsCorrect: 0,
        examsTaken: 0,
        examsPassed: 0,
        topicStats: {}
        // topicStats[topicId] = { attempts, bestScore, lastScore, completedAt, chunkResults: [bool] }
      }
    };
  }

  // ---- Core I/O ----
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db.version === DB_VERSION) return db;
        return migrate(db);
      }
    } catch (e) { /* corrupt data, start fresh */ }
    // Check for legacy progress (v1 format)
    return migrateFromLegacy();
  }

  function save(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function migrateFromLegacy() {
    const db = defaultDB();
    try {
      const legacy = localStorage.getItem("unit6-dojo-progress");
      if (legacy) {
        const d = JSON.parse(legacy);
        const profileId = generateId();
        const profile = defaultProfile("Student");
        profile.completedTopics = d.completedTopics || [];
        profile.completedChunks = {};
        for (const [k, v] of Object.entries(d.completedChunks || {})) {
          profile.completedChunks[k] = Array.isArray(v) ? v : [...v];
        }
        db.profiles[profileId] = profile;
        db.activeProfileId = profileId;
        localStorage.removeItem("unit6-dojo-progress");
      }
    } catch (e) { /* ignore */ }
    save(db);
    return db;
  }

  function migrate(db) {
    // v2 -> v3: introduce spaced review scheduling.
    // Topics already completed are given a review due today, so an
    // existing user immediately sees their back catalogue rather than
    // an empty queue. Nothing is lost.
    if (db.version < 3) {
      const today = new Date().toISOString().slice(0, 10);
      for (const p of Object.values(db.profiles || {})) {
        if (!p.reviews) {
          p.reviews = {};
          (p.completedTopics || []).forEach(id => {
            p.reviews[id] = { due: today, interval: 1, ease: 2.5, lapses: 0, reps: 1 };
          });
        }
        if (!p.seenQuotes) p.seenQuotes = [];
      }
    }
    // v3 -> v4: charge, theme and resume position.
    if (db.version < 4) {
      for (const p of Object.values(db.profiles || {})) {
        if (typeof p.charge !== "number") p.charge = 0;
        if (!p.theme) p.theme = "indigo";
        if (p.lastPosition === undefined) p.lastPosition = null;
      }
    }
    db.version = DB_VERSION;
    save(db);
    return db;
  }

  function generateId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---- Profile management ----
  function init() {
    return load();
  }

  function getActiveProfile() {
    const db = load();
    if (!db.activeProfileId || !db.profiles[db.activeProfileId]) return null;
    return { id: db.activeProfileId, ...db.profiles[db.activeProfileId] };
  }

  function createProfile(name) {
    const db = load();
    const id = generateId();
    db.profiles[id] = defaultProfile(name);
    db.activeProfileId = id;
    save(db);
    return id;
  }

  function setActiveProfile(id) {
    const db = load();
    if (db.profiles[id]) {
      db.activeProfileId = id;
      save(db);
    }
  }

  function updateProfileName(name) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (p) {
      p.name = name;
      save(db);
    }
  }

  function deleteProfile(id) {
    const db = load();
    delete db.profiles[id];
    if (db.activeProfileId === id) {
      const remaining = Object.keys(db.profiles);
      db.activeProfileId = remaining.length > 0 ? remaining[0] : null;
    }
    save(db);
  }

  function listProfiles() {
    const db = load();
    return Object.entries(db.profiles).map(([id, p]) => ({
      id,
      name: p.name,
      createdAt: p.createdAt,
      topicsCompleted: (p.completedTopics || []).length
    }));
  }

  // ---- Progress ----
  function getCompletedTopics() {
    const p = getActiveProfile();
    return p ? new Set(p.completedTopics || []) : new Set();
  }

  function getCompletedChunks() {
    const p = getActiveProfile();
    if (!p) return {};
    const result = {};
    for (const [k, v] of Object.entries(p.completedChunks || {})) {
      result[k] = new Set(Array.isArray(v) ? v : []);
    }
    return result;
  }

  function markChunkComplete(topicId, chunkIdx) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    if (!p.completedChunks[topicId]) p.completedChunks[topicId] = [];
    if (!p.completedChunks[topicId].includes(chunkIdx)) {
      p.completedChunks[topicId].push(chunkIdx);
    }
    save(db);
  }

  function markTopicComplete(topicId) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    if (!p.completedTopics.includes(topicId)) {
      p.completedTopics.push(topicId);
    }
    save(db);
  }

  // ---- Stats recording ----
  function recordQuizAnswer(topicId, chunkIdx, isCorrect) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    p.stats.miniQuizTotal++;
    if (isCorrect) p.stats.miniQuizCorrect++;
    // Per-topic chunk results
    if (!p.stats.topicStats[topicId]) {
      p.stats.topicStats[topicId] = { attempts: 0, bestScore: 0, lastScore: 0, completedAt: null, chunkResults: [] };
    }
    const ts = p.stats.topicStats[topicId];
    ts.chunkResults[chunkIdx] = isCorrect;
    save(db);
  }

  function recordExamResult(topicId, correct, total, passed) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    const pct = Math.round((correct / total) * 100);
    p.stats.examQuestionsTotal += total;
    p.stats.examQuestionsCorrect += correct;
    p.stats.examsTaken++;
    if (passed) p.stats.examsPassed++;
    if (!p.stats.topicStats[topicId]) {
      p.stats.topicStats[topicId] = { attempts: 0, bestScore: 0, lastScore: 0, completedAt: null, chunkResults: [] };
    }
    const ts = p.stats.topicStats[topicId];
    ts.attempts++;
    ts.lastScore = pct;
    if (pct > ts.bestScore) ts.bestScore = pct;
    if (passed) ts.completedAt = new Date().toISOString();
    save(db);
  }

  // ---- Stats retrieval ----
  function getStats() {
    const p = getActiveProfile();
    if (!p) return null;
    const s = p.stats;
    const totalTopics = typeof ALL_TOPICS !== 'undefined' ? ALL_TOPICS.length : 0;
    const topicsCompleted = (p.completedTopics || []).length;

    return {
      profileName: p.name,
      createdAt: p.createdAt,
      topicsCompleted,
      totalTopics,
      completionPct: totalTopics > 0 ? Math.round((topicsCompleted / totalTopics) * 100) : 0,
      miniQuizTotal: s.miniQuizTotal,
      miniQuizCorrect: s.miniQuizCorrect,
      miniQuizAccuracy: s.miniQuizTotal > 0 ? Math.round((s.miniQuizCorrect / s.miniQuizTotal) * 100) : 0,
      examQuestionsTotal: s.examQuestionsTotal,
      examQuestionsCorrect: s.examQuestionsCorrect,
      examAccuracy: s.examQuestionsTotal > 0 ? Math.round((s.examQuestionsCorrect / s.examQuestionsTotal) * 100) : 0,
      examsTaken: s.examsTaken,
      examsPassed: s.examsPassed,
      examPassRate: s.examsTaken > 0 ? Math.round((s.examsPassed / s.examsTaken) * 100) : 0,
      topicStats: s.topicStats
    };
  }

  // ---- Spaced review (SM-2) ----
  // Woźniak's 1987 algorithm. Deliberately NOT FSRS: FSRS needs hundreds
  // of reviews before its model fits, so it performs worse than SM-2 at
  // small scale. Revisit once there is real usage data.
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // quality: 0-5. Derived from exam percentage.
  function scheduleReview(topicId, quality) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    if (!p.reviews) p.reviews = {};

    const r = p.reviews[topicId] || { interval: 0, ease: 2.5, lapses: 0, reps: 0 };

    if (quality < 3) {
      // Failed. Back to tomorrow, and the card gets easier to trigger.
      r.reps = 0;
      r.interval = 1;
      r.lapses = (r.lapses || 0) + 1;
    } else {
      r.reps = (r.reps || 0) + 1;
      if (r.reps === 1) r.interval = 1;
      else if (r.reps === 2) r.interval = 6;
      else r.interval = Math.round(r.interval * r.ease);
    }

    // Ease adjustment, floored at 1.3 to avoid SM-2's "ease hell".
    r.ease = Math.max(1.3, r.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    r.due = addDays(r.interval);
    p.reviews[topicId] = r;
    save(db);
  }

  function getReviews() {
    const p = getActiveProfile();
    return p ? (p.reviews || {}) : {};
  }

  function getDueTopicIds() {
    const reviews = getReviews();
    const today = todayStr();
    return Object.keys(reviews).filter(id => reviews[id].due && reviews[id].due <= today);
  }

  function daysUntilDue(topicId) {
    const r = getReviews()[topicId];
    if (!r || !r.due) return null;
    const diff = Math.ceil((new Date(r.due) - new Date(todayStr())) / 86400000);
    return diff;
  }

  // ---- Weak spots ----
  // Answers "what should I study now?" — the only question a learner has.
  // Everything here is already recorded; it was just never surfaced.
  function getWeakSpots(limit) {
    const p = getActiveProfile();
    if (!p) return [];
    const reviews = p.reviews || {};
    const ts = p.stats.topicStats || {};
    return Object.keys(ts)
      .map(id => ({
        topicId: id,
        lastScore: ts[id].lastScore || 0,
        bestScore: ts[id].bestScore || 0,
        attempts: ts[id].attempts || 0,
        lapses: (reviews[id] && reviews[id].lapses) || 0
      }))
      .filter(t => t.attempts > 0)
      // Composite weakness: recent score dominates, each lapse costs
      // 10 points. Sorting by lapses first would rank a topic scoring
      // 100% above one scoring 40%, which is not what "weak" means.
      .map(t => ({ ...t, weakness: t.lastScore - (t.lapses * 10) }))
      .filter(t => t.weakness < 80)
      .sort((a, b) => a.weakness - b.weakness)
      .slice(0, limit || 3);
  }

  // ---- Quote rotation ----
  function getSeenQuotes() {
    const p = getActiveProfile();
    return p ? (p.seenQuotes || []) : [];
  }

  function pushSeenQuote(idx, keep) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    if (!p.seenQuotes) p.seenQuotes = [];
    p.seenQuotes.push(idx);
    const max = keep || 12;
    if (p.seenQuotes.length > max) p.seenQuotes = p.seenQuotes.slice(-max);
    save(db);
  }

  // ---- Lightning charge ----
  // Capped so it can't inflate forever. NOTE: a cap with no way to
  // spend charge means it stops meaning anything once full — the
  // planned rewards list is what gives it a sink.
  const CHARGE_CAP = 150;

  function getCharge() {
    const p = getActiveProfile();
    return p ? (p.charge || 0) : 0;
  }

  // Returns how much was ACTUALLY added, which may be less than
  // requested if the cap was hit — the UI needs the real number.
  function addCharge(amount) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return 0;
    const before = p.charge || 0;
    const after = Math.min(CHARGE_CAP, before + amount);
    p.charge = after;
    save(db);
    return after - before;
  }

  function chargeCap() { return CHARGE_CAP; }

  // ---- Theme ----
  function getTheme() {
    const p = getActiveProfile();
    return (p && p.theme) || "indigo";
  }

  function setTheme(id) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    p.theme = id;
    save(db);
  }

  // ---- Resume position ----
  // completedChunks was written from the very first version and never
  // read by anything. This is what it was always for.
  function setPosition(unitId, topicId, chunkIdx) {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    p.lastPosition = { unitId, topicId, chunkIdx };
    save(db);
  }

  function getPosition() {
    const p = getActiveProfile();
    return p ? (p.lastPosition || null) : null;
  }

  function clearPosition() {
    const db = load();
    const p = db.profiles[db.activeProfileId];
    if (!p) return;
    p.lastPosition = null;
    save(db);
  }

  // Furthest chunk completed in a topic, so returning resumes there
  // rather than restarting from chunk 1.
  function resumeChunkFor(topicId, chunkCount) {
    const done = getCompletedChunks()[topicId];
    if (!done || !done.size) return 0;
    for (let i = 0; i < chunkCount; i++) {
      if (!done.has(i)) return i;
    }
    return 0; // every chunk done — topic gets replayed from the top
  }

  // ---- Export / Import ----
  function exportData() {
    const db = load();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unit6-dojo-${db.profiles[db.activeProfileId]?.name || 'backup'}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const db = JSON.parse(e.target.result);
          if (!db.profiles || typeof db.profiles !== 'object') {
            reject(new Error('Invalid database file'));
            return;
          }
          save(db);
          resolve(db);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // ---- Public API ----
  return {
    init,
    getActiveProfile,
    createProfile,
    setActiveProfile,
    updateProfileName,
    deleteProfile,
    listProfiles,
    getCompletedTopics,
    getCompletedChunks,
    markChunkComplete,
    markTopicComplete,
    recordQuizAnswer,
    recordExamResult,
    getStats,
    scheduleReview,
    getReviews,
    getDueTopicIds,
    daysUntilDue,
    getWeakSpots,
    getSeenQuotes,
    pushSeenQuote,
    getCharge,
    addCharge,
    chargeCap,
    getTheme,
    setTheme,
    setPosition,
    getPosition,
    clearPosition,
    resumeChunkFor,
    exportData,
    importData
  };
})();

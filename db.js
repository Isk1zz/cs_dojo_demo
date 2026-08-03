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
  const DB_VERSION = 2;

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
    // Future migrations go here
    // e.g. if (db.version === 1) { ... upgrade to 2 ... }
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
    exportData,
    importData
  };
})();

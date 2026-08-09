// ================================================
// Dojo — Application Logic
// Integrates with DB for profile & stats persistence
// Units (6, 7, ...) are independent, separately-unlocked tracks.
// ================================================

(() => {
  // ---- State ----
  const state = {
    currentCourse: null,
    missedChunks: [],   // chunk indices answered wrong — re-asked before the exam
    inRetry: false,
    reviewMode: false,
    currentUnit: null,       // which unit (6, 7, ...) is currently selected
    currentTopics: [],       // the flattened, decorated topic list for currentUnit
    currentTopicIdx: null,
    currentChunk: 0,
    chunkPhase: "explain",
    quizAnswer: null,
    quizSubmitted: false,
    examIndex: 0,
    examAnswers: [],
    examSubmitted: [],
    dropdownOpen: false,
  };

  // ---- Screen management ----
  // ---- Themes ----
  // Each theme overrides only the accent family; backgrounds and text
  // stay put so contrast stays readable whichever one is picked.
  // Each theme repaints the whole surface, not just the accent — the
  // background is most of what you actually see, so changing only
  // --accent barely registers.
  const THEMES = [
    { id: "indigo", name: "Indigo Night", swatch: "#6366f1",
      accent: "#6366f1", light: "#818cf8",
      deep: "#0a0e1a", card: "#111827", hover: "#1a2235", surface: "#151c2e" },
    { id: "ember", name: "Ember", swatch: "#f97316",
      accent: "#f97316", light: "#fb923c",
      deep: "#140d08", card: "#1f1510", hover: "#2b1d15", surface: "#241a13" },
    { id: "jade", name: "Jade", swatch: "#10b981",
      accent: "#10b981", light: "#34d399",
      deep: "#06120f", card: "#0d1f1a", hover: "#132b24", surface: "#0f251f" },
    { id: "rose", name: "Rose", swatch: "#ec4899",
      accent: "#ec4899", light: "#f472b6",
      deep: "#150a11", card: "#20111a", hover: "#2c1824", surface: "#26141f" },
    { id: "ice", name: "Ice", swatch: "#06b6d4",
      accent: "#06b6d4", light: "#22d3ee",
      deep: "#07131a", card: "#0e1f28", hover: "#152a35", surface: "#11242e" },
    { id: "sepia", name: "Sepia", swatch: "#f59e0b",
      accent: "#f59e0b", light: "#fbbf24",
      deep: "#14100a", card: "#1e1811", hover: "#2a2118", surface: "#231c14" },
    { id: "violet", name: "Violet", swatch: "#a855f7",
      accent: "#a855f7", light: "#c084fc",
      deep: "#100a17", card: "#191022", hover: "#23172f", surface: "#1d1329" },
    { id: "slate", name: "Slate", swatch: "#64748b",
      accent: "#64748b", light: "#94a3b8",
      deep: "#0c0f14", card: "#151a21", hover: "#1e242d", surface: "#191f27" }
  ];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function applyTheme(id) {
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    const [r, g, b] = hexToRgb(t.accent);
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-light", t.light);
    root.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.25)`);
    root.setProperty("--accent-glow-strong", `rgba(${r}, ${g}, ${b}, 0.5)`);
    root.setProperty("--border-accent", `rgba(${r}, ${g}, ${b}, 0.3)`);
    root.setProperty("--bg-deep", t.deep);
    root.setProperty("--bg-card", t.card);
    root.setProperty("--bg-card-hover", t.hover);
    root.setProperty("--bg-surface", t.surface);
  }

  // ---- Lightning charge ----
  function renderCharge() {
    const bar = document.getElementById("charge-bar");
    if (!bar) return;
    if (!DB.getActiveProfile()) { bar.style.display = "none"; return; }
    bar.style.display = "flex";
    const charge = DB.getCharge();
    const cap = DB.chargeCap();
    document.getElementById("charge-fill").style.width = `${(charge / cap) * 100}%`;
    document.getElementById("charge-value").textContent = `${charge}/${cap}`;
    bar.classList.toggle("full", charge >= cap);
  }

  // Awards charge and flies a bolt up to the bar. Returns what was
  // actually granted — at the cap that's 0, and the UI shouldn't
  // animate a gain that didn't happen.
  function awardCharge(amount, originEl) {
    const gained = DB.addCharge(amount);
    if (gained > 0) flyBolt(originEl, gained);
    renderCharge();
    return gained;
  }

  function flyBolt(originEl, amount) {
    const layer = document.getElementById("bolt-layer");
    const bar = document.getElementById("charge-bar");
    if (!layer || !bar) return;

    const from = originEl && originEl.getBoundingClientRect
      ? originEl.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight * 0.7, width: 0, height: 0 };
    const to = bar.getBoundingClientRect();

    const bolt = document.createElement("div");
    bolt.className = "flying-bolt";
    bolt.innerHTML = `<span class="fb-icon">\u26A1</span><span class="fb-amount">+${amount}</span>`;
    bolt.style.left = `${from.left + from.width / 2}px`;
    bolt.style.top = `${from.top + from.height / 2}px`;
    layer.appendChild(bolt);

    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    requestAnimationFrame(() => {
      bolt.style.transform = `translate(${dx}px, ${dy}px) scale(0.55)`;
      bolt.style.opacity = "0";
    });

    setTimeout(() => {
      bolt.remove();
      bar.classList.add("pulse");
      setTimeout(() => bar.classList.remove("pulse"), 420);
    }, 900);
  }

  // ---- Utilities ----

  // Fisher-Yates. Modules 1-4 shipped with every exam in fixed order
  // with options in fixed positions, so a failed exam could be passed
  // on retry by remembering "it was the third one". This closes that.
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Shuffles a question's options and returns the new index of the
  // correct answer, so `correct` stays meaningful after reordering.
  function shuffleQuestion(q) {
    const paired = q.options.map((text, i) => ({ text, wasCorrect: i === q.correct }));
    const mixed = shuffled(paired);
    return {
      ...q,
      options: mixed.map(o => o.text),
      correct: mixed.findIndex(o => o.wasCorrect)
    };
  }

  // Draws from the whole pool rather than a per-chunk list, so the
  // quotes don't run out. Quotes tagged to the chunk's concept are
  // preferred when available; recently shown ones are excluded.
  function pickQuote(tags) {
    if (typeof WISDOM === "undefined" || !WISDOM.length) return null;
    const seen = DB.getSeenQuotes();
    let pool = WISDOM.map((q, i) => ({ q, i })).filter(x => !seen.includes(x.i));
    if (!pool.length) pool = WISDOM.map((q, i) => ({ q, i }));

    if (tags && tags.length) {
      const matching = pool.filter(x => x.q.tags && x.q.tags.some(t => tags.includes(t)));
      if (matching.length) pool = matching;
    }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    DB.pushSeenQuote(chosen.i);
    return chosen.q;
  }

  function quoteHtml(q) {
    if (!q) return "";
    return `
      <div class="wisdom-card">
        <div class="wisdom-mark">&ldquo;</div>
        <blockquote class="wisdom-text">${q.text}</blockquote>
        <div class="wisdom-author">— ${q.author}</div>
        <div class="wisdom-source">${q.source}</div>
      </div>`;
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    window.scrollTo(0, 0);
    closeDropdown();
  }

  // ---- Profile Setup ----
  function checkProfile() {
    const profile = DB.getActiveProfile();
    if (!profile) {
      showProfileModal();
    }
  }

  function showProfileModal() {
    const modal = document.getElementById("profile-modal");
    const input = document.getElementById("profile-name-input");
    modal.style.display = "flex";
    input.value = "";
    setTimeout(() => input.focus(), 100);
  }

  function hideProfileModal() {
    document.getElementById("profile-modal").style.display = "none";
  }

  document.getElementById("btn-profile-save").addEventListener("click", () => {
    const name = document.getElementById("profile-name-input").value.trim() || "Student";
    DB.createProfile(name);
    hideProfileModal();
    updateProfileBadge();
  });

  document.getElementById("profile-name-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-profile-save").click();
  });

  // ---- Profile Badge & Dropdown ----
  function updateProfileBadge() {
    const profile = DB.getActiveProfile();
    if (!profile) return;
    const name = profile.name || "Student";
    document.getElementById("profile-avatar").textContent = name.charAt(0).toUpperCase();
    document.getElementById("profile-name-display").textContent = name;
  }

  function toggleDropdown() {
    state.dropdownOpen = !state.dropdownOpen;
    const dd = document.getElementById("profile-dropdown");
    if (state.dropdownOpen) {
      dd.style.display = "block";
      renderDropdown();
    } else {
      dd.style.display = "none";
    }
  }

  function closeDropdown() {
    state.dropdownOpen = false;
    document.getElementById("profile-dropdown").style.display = "none";
  }

  document.getElementById("profile-badge").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener("click", (e) => {
    if (state.dropdownOpen && !document.getElementById("profile-dropdown").contains(e.target)) {
      closeDropdown();
    }
  });

  function renderDropdown() {
    const profile = DB.getActiveProfile();
    const nameInput = document.getElementById("pd-name-edit");
    nameInput.value = profile ? profile.name : "";

    const profiles = DB.listProfiles();
    const list = document.getElementById("pd-profiles-list");
    list.innerHTML = "";

    if (profiles.length > 1) {
      profiles.forEach(p => {
        const item = document.createElement("div");
        item.className = `pd-profile-item${p.id === profile?.id ? " active" : ""}`;
        item.innerHTML = `
          <span>${p.name}</span>
          <span class="pd-topics-done">${p.topicsCompleted}/${ALL_TOPICS.length}</span>
        `;
        item.addEventListener("click", () => {
          DB.setActiveProfile(p.id);
          updateProfileBadge();
          renderDropdown();
          if (state.currentUnit) renderTopicMap();
        });
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<div style="padding:0.3rem 0.5rem;font-size:0.78rem;color:var(--text-muted);">Only one profile</div>';
    }
  }

  document.getElementById("pd-name-save").addEventListener("click", () => {
    const name = document.getElementById("pd-name-edit").value.trim();
    if (name) {
      DB.updateProfileName(name);
      updateProfileBadge();
    }
  });

  document.getElementById("pd-name-edit").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("pd-name-save").click();
  });

  document.getElementById("pd-new-profile").addEventListener("click", () => {
    closeDropdown();
    showProfileModal();
  });

  document.getElementById("pd-stats").addEventListener("click", () => {
    closeDropdown();
    showStatsModal();
  });

  // ---- Stats Modal ----
  function showStatsModal() {
    const modal = document.getElementById("stats-modal");
    modal.style.display = "flex";
    renderStats();
  }

  function hideStatsModal() {
    document.getElementById("stats-modal").style.display = "none";
  }

  document.getElementById("btn-stats-close").addEventListener("click", hideStatsModal);
  document.getElementById("stats-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideStatsModal();
  });

  function renderStats() {
    const stats = DB.getStats();
    if (!stats) return;

    const body = document.getElementById("stats-body");

    // Build topic rows, grouped by unit
    let topicRowsHtml = "";
    ALL_TOPICS.forEach(t => {
      const ts = stats.topicStats[t.id];
      let scoreHtml;
      if (ts && ts.bestScore > 0) {
        const cls = ts.bestScore >= 80 ? "pass" : "fail";
        scoreHtml = `<span class="stats-topic-score ${cls}">${ts.bestScore}% (${ts.attempts} attempt${ts.attempts !== 1 ? "s" : ""})</span>`;
      } else {
        scoreHtml = `<span class="stats-topic-score none">—</span>`;
      }
      topicRowsHtml += `
        <div class="stats-topic-row">
          <span class="stats-topic-name">U${t.unit} · ${t.icon} ${t.title}</span>
          ${scoreHtml}
        </div>`;
    });

    // "What should I study now?" is the only question a learner
    // actually has, and none of the numbers above answer it. All of
    // this was already being recorded and simply never surfaced.
    const byId = {};
    ALL_TOPICS.forEach(t => { byId[t.id] = t; });
    const weak = DB.getWeakSpots(3);
    let weakHtml = "";
    if (weak.length) {
      const rows = weak.map(w => {
        const t = byId[w.topicId];
        if (!t) return "";
        return `<button class="weak-row" data-topic="${w.topicId}">
            <span class="weak-name">${t.icon} ${t.title}</span>
            <span class="weak-score ${w.lastScore >= 80 ? "pass" : "fail"}">${w.lastScore}%</span>
          </button>`;
      }).join("");
      weakHtml = `
        <div class="weak-section">
          <div class="stats-section-title">🎯 Your weak spots</div>
          <div class="weak-hint">Lowest recent scores. Tap one to start there.</div>
          ${rows}
        </div>`;
    }

    // How much is waiting, so the review queue isn't invisible.
    const dueCount = DB.getDueTopicIds().length;
    const dueHtml = dueCount
      ? `<div class="due-banner">🔁 ${dueCount} topic${dueCount === 1 ? "" : "s"} due for review</div>`
      : "";

    body.innerHTML = `
      ${dueHtml}
      ${weakHtml}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value accent">${stats.completionPct}%</div>
          <div class="stat-label">Overall Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-value green">${stats.topicsCompleted}/${stats.totalTopics}</div>
          <div class="stat-label">Topics Mastered</div>
        </div>
        <div class="stat-card">
          <div class="stat-value cyan">${stats.miniQuizAccuracy}%</div>
          <div class="stat-label">Question Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value yellow">${stats.examAccuracy}%</div>
          <div class="stat-label">Exam Accuracy</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value accent">${stats.miniQuizCorrect}/${stats.miniQuizTotal}</div>
          <div class="stat-label">Question Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value green">${stats.examsPassed}/${stats.examsTaken}</div>
          <div class="stat-label">Exams Passed</div>
        </div>
      </div>

      <div class="stats-section-title">Topic Exam Scores (All Units)</div>
      <div class="stats-topic-list">
        ${topicRowsHtml}
      </div>
    `;

    body.querySelectorAll(".weak-row").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-topic");
        const unit = UNITS.find(u => u.modules.some(m => m.topics.some(t => t.id === id)));
        if (!unit) return;
        hideStatsModal();
        selectUnit(unit.id);
        const idx = state.currentTopics.findIndex(t => t.id === id);
        if (idx >= 0) startTopic(idx);
      });
    });
  }

  // Export / Import
  document.getElementById("btn-export").addEventListener("click", () => {
    DB.exportData();
  });

  document.getElementById("btn-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await DB.importData(file);
      updateProfileBadge();
      renderStats();
      renderUnitSelect();
      if (state.currentUnit) renderTopicMap();
      alert("Data imported successfully!");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
    e.target.value = "";
  });

  // ---- Unit Select ----
  function showLobby() {
    state.currentCourse = null;
    const p = DB.getActiveProfile();
    document.getElementById("lobby-welcome").textContent =
      p ? `Welcome back, ${p.name}.` : "Welcome.";

    // Resume tile — only offered when there's somewhere to resume to.
    const pos = DB.getPosition();
    const resumeBtn = document.getElementById("btn-lobby-resume");
    if (pos) {
      const topic = ALL_TOPICS.find(t => t.id === pos.topicId);
      if (topic) {
        resumeBtn.style.display = "flex";
        document.getElementById("lobby-resume-sub").textContent =
          `${topic.icon} ${topic.title} — chunk ${pos.chunkIdx + 1}`;
      } else {
        resumeBtn.style.display = "none";
      }
    } else {
      resumeBtn.style.display = "none";
    }

    const due = DB.getDueTopicIds().length;
    const reviewBtn = document.getElementById("btn-lobby-review");
    if (due) {
      reviewBtn.style.display = "flex";
      document.getElementById("lobby-review-sub").textContent =
        `${due} topic${due === 1 ? "" : "s"} ready to come back to`;
    } else {
      reviewBtn.style.display = "none";
    }

    const grownCount = ALL_TOPICS.filter(t => growthFor(t.id) !== GROWTH[0]).length;
    const gsub = document.getElementById("lobby-garden-sub");
    if (gsub) {
      gsub.textContent = grownCount
        ? `${grownCount} of ${ALL_TOPICS.length} topics planted`
        : "Nothing planted yet — finish a topic to grow something";
    }

    renderCharge();
    showScreen("lobby");
  }

  // ---- Garden ----
  // Growth stage is driven by the SPACED REVIEW interval, not by
  // whether a topic was passed once. A topic you've held on to for
  // months is a tree; one you passed yesterday is a sprout. That makes
  // the garden a picture of retention rather than of coverage — which
  // is the whole point of the review system.
  const GROWTH = [
    { min: -1, icon: "\u{1F311}", name: "Fallow",   hint: "Not started" },
    { min: 0,  icon: "\u{1F330}", name: "Seed",     hint: "Attempted, not yet mastered" },
    { min: 1,  icon: "\u{1F331}", name: "Sprout",   hint: "Just mastered" },
    { min: 6,  icon: "\u{1F33F}", name: "Seedling", hint: "Held for about a week" },
    { min: 16, icon: "\u{1F33E}", name: "Growing",  hint: "Held for a couple of weeks" },
    { min: 45, icon: "\u{1F333}", name: "Tree",     hint: "Held for over a month" },
    { min: 120,icon: "\u{1F338}", name: "Blossom",  hint: "Held for months" }
  ];

  function growthFor(topicId) {
    const completed = DB.getCompletedTopics();
    const reviews = DB.getReviews();
    const r = reviews[topicId];
    if (!completed.has(topicId)) {
      const stats = DB.getStats();
      const attempted = stats && stats.topicStats[topicId] && stats.topicStats[topicId].attempts > 0;
      return attempted ? GROWTH[1] : GROWTH[0];
    }
    const interval = (r && r.interval) || 1;
    let stage = GROWTH[2];
    GROWTH.forEach(g => { if (g.min >= 1 && interval >= g.min) stage = g; });
    return stage;
  }

  function renderGarden() {
    const body = document.getElementById("garden-body");
    body.innerHTML = "";

    const grown = ALL_TOPICS.filter(t => growthFor(t.id) !== GROWTH[0]).length;
    const mature = ALL_TOPICS.filter(t => {
      const g = growthFor(t.id);
      return g === GROWTH[5] || g === GROWTH[6];
    }).length;

    const header = document.createElement("div");
    header.className = "garden-header";
    header.innerHTML = `
      <div class="garden-summary">
        <span class="gs-num">${grown}</span> of ${ALL_TOPICS.length} planted
        ${mature ? `<span class="gs-mature">\u00b7 ${mature} fully grown</span>` : ""}
      </div>
      <p class="garden-note">
        Plants grow with the <strong>review interval</strong>, not with how many topics
        you've finished. Something you passed once is a sprout; something you've held
        on to for months is a tree. Skip reviews and a plant drops back.
      </p>`;
    body.appendChild(header);

    UNITS.forEach(u => {
      const topics = UNIT_TOPICS[u.id] || [];
      if (!topics.length) return;
      const plot = document.createElement("div");
      plot.className = "garden-plot";
      plot.innerHTML = `<div class="plot-title">${u.icon} ${u.title} — ${u.subtitle}</div>`;
      const bed = document.createElement("div");
      bed.className = "garden-bed";
      topics.forEach(t => {
        const g = growthFor(t.id);
        const cell = document.createElement("div");
        cell.className = `garden-cell${g === GROWTH[0] ? " fallow" : ""}`;
        cell.setAttribute("title", `${t.title} — ${g.name}: ${g.hint}`);
        cell.innerHTML = `
          <span class="gc-plant">${g.icon}</span>
          <span class="gc-label">${t.title}</span>
          <span class="gc-stage">${g.name}</span>`;
        bed.appendChild(cell);
      });
      plot.appendChild(bed);
      body.appendChild(plot);
    });

    const legend = document.createElement("div");
    legend.className = "garden-legend";
    legend.innerHTML = GROWTH.slice(1).map(g =>
      `<span class="gl-item">${g.icon} ${g.name}</span>`).join("");
    body.appendChild(legend);

    showScreen("garden");
  }

  // ---- Settings ----
  function renderSettings() {
    const body = document.getElementById("settings-body");
    const current = DB.getTheme();
    body.innerHTML = `
      <div class="settings-section">
        <div class="stats-section-title">\u{1F3A8} Colour theme</div>
        <p class="settings-hint">Changes the whole app, not just the accent.</p>
        <div class="theme-grid">
          ${THEMES.map(t => `
            <button class="theme-swatch${t.id === current ? " active" : ""}"
                    data-theme="${t.id}" style="--sw:${t.swatch};--sw-bg:${t.card}">
              <span class="sw-preview"><span class="sw-dot"></span></span>
              <span class="sw-name">${t.name}</span>
            </button>`).join("")}
        </div>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u{1F4BE} Your data</div>
        <p class="settings-hint">Progress is stored in this browser only. Export before clearing browser data or switching machines.</p>
        <div class="stats-actions">
          <button id="btn-export-2" class="btn-ghost">\u{1F4E5} Export Data</button>
          <label class="btn-ghost import-label">
            \u{1F4E4} Import Data
            <input type="file" id="btn-import-2" accept=".json" style="display:none;" />
          </label>
        </div>
      </div>`;

    body.querySelectorAll(".theme-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-theme");
        DB.setTheme(id);
        applyTheme(id);
        body.querySelectorAll(".theme-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const exp = document.getElementById("btn-export-2");
    if (exp) exp.addEventListener("click", () => DB.exportData());
    const imp = document.getElementById("btn-import-2");
    if (imp) imp.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      DB.importData(file).then(() => {
        applyTheme(DB.getTheme());
        renderCharge();
        updateProfileBadge();
        showLobby();
      }).catch(() => alert("Could not read that file."));
    });

    showScreen("settings");
  }

  function renderCourseSelect() {
    const body = document.getElementById("course-select-body");
    body.innerHTML = "";
    const completedTopics = DB.getCompletedTopics();

    const grid = document.createElement("div");
    grid.className = "topic-grid";

    COURSES.forEach(c => {
      const topics = c.units.flatMap(id => UNIT_TOPICS[id] || []);
      const done = topics.filter(t => completedTopics.has(t.id)).length;
      const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;

      const card = document.createElement("div");
      card.className = `topic-card course-card${c.available ? "" : " ahead"}`;
      card.innerHTML = `
        <div class="topic-num">${c.icon}</div>
        <div class="topic-title">${c.title}</div>
        <div class="topic-desc">${c.subtitle}</div>
        <div class="topic-meta">
          <span>${c.units.length} units</span>
          <span>·</span>
          <span>${topics.length} topics</span>
          <span>·</span>
          <span>${pct}% complete</span>
          ${c.available ? "" : '<span class="topic-badge ahead-badge">Coming soon</span>'}
        </div>
        <div class="course-progress"><div class="course-progress-fill" style="width:${pct}%"></div></div>
      `;
      if (c.available) {
        card.addEventListener("click", () => {
          state.currentCourse = c.id;
          renderUnitSelect();
          showScreen("unit-select");
        });
      }
      grid.appendChild(card);
    });

    body.appendChild(grid);
    showScreen("course-select");
  }

  function renderUnitSelect() {
    const body = document.getElementById("unit-select-body");
    body.innerHTML = "";
    const completedTopics = DB.getCompletedTopics();
    const course = COURSES.find(c => c.id === state.currentCourse);
    const unitsToShow = course ? UNITS.filter(u => course.units.includes(u.id)) : UNITS;

    const grid = document.createElement("div");
    grid.className = "topic-grid";

    unitsToShow.forEach(u => {
      const topics = UNIT_TOPICS[u.id];
      const done = topics.filter(t => completedTopics.has(t.id)).length;
      const pct = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0;

      const card = document.createElement("div");
      card.className = "topic-card";
      card.innerHTML = `
        <div class="topic-num">${u.icon}</div>
        <div class="topic-title">${u.title} — ${u.subtitle}</div>
        <div class="topic-desc">${topics.length} topics across ${u.modules.length} module${u.modules.length !== 1 ? "s" : ""}.</div>
        <div class="topic-meta">
          <span>${done}/${topics.length} mastered</span>
          <span>·</span>
          <span>${pct}% complete</span>
          ${pct === 100 ? '<span class="topic-badge mastered">✓ Mastered</span>' : ""}
        </div>
      `;
      card.addEventListener("click", () => selectUnit(u.id));
      grid.appendChild(card);
    });

    body.appendChild(grid);
    updateProfileBadge();
  }

  function selectUnit(unitId) {
    state.currentUnit = unitId;
    state.currentTopics = UNIT_TOPICS[unitId];
    showScreen("topic-map");
    renderTopicMap();
  }

  // ---- Topic Map (scoped to state.currentUnit) ----
  function renderTopicMap() {
    const unit = UNITS.find(u => u.id === state.currentUnit);
    const body = document.getElementById("topic-map-body");
    document.getElementById("topic-map-unit-label").textContent = `${unit.title} · ${unit.subtitle}`;
    body.innerHTML = "";

    const completedTopics = DB.getCompletedTopics();
    const dueIds = DB.getDueTopicIds();
    let globalIdx = 0;

    // Anything due for review is surfaced above the modules. Without
    // this the app is a course you finish once; with it, it's a study
    // system. Spacing is one of only two techniques rated high-utility
    // in the literature, and it needs no new content.
    if (dueIds.length) {
      const dueTopics = state.currentTopics.filter(t => dueIds.includes(t.id));
      if (dueTopics.length) {
        const due = document.createElement("div");
        due.className = "due-section";
        due.innerHTML = `
          <div class="due-header">
            <span class="due-icon">🔁</span>
            <span class="due-title">Due for review</span>
            <span class="due-count">${dueTopics.length}</span>
          </div>
          <div class="due-hint">Coming back to these now is worth more than new material.</div>
          <div class="due-grid"></div>`;
        body.appendChild(due);
        const dueGrid = due.querySelector(".due-grid");
        dueTopics.forEach(t => {
          const idx = state.currentTopics.findIndex(x => x.id === t.id);
          const chip = document.createElement("button");
          chip.className = "due-chip";
          chip.innerHTML = `<span>${t.icon}</span> ${t.title}`;
          chip.addEventListener("click", () => startTopic(idx));
          dueGrid.appendChild(chip);
        });
      }
    }

    unit.modules.forEach((mod) => {
      const section = document.createElement("div");
      section.className = "module-section";

      const modDone = mod.topics.filter(t => completedTopics.has(t.id)).length;
      const modPct = Math.round((modDone / mod.topics.length) * 100);

      section.innerHTML = `
        <div class="module-header">
          <span class="module-icon">${mod.icon}</span>
          <span class="module-title">${mod.title}</span>
          <div class="module-progress">
            <div class="module-progress-bar">
              <div class="module-progress-fill" style="width:${modPct}%"></div>
            </div>
            <span>${modDone}/${mod.topics.length}</span>
          </div>
        </div>
        <div class="topic-grid"></div>
      `;

      body.appendChild(section);
      const grid = section.querySelector(".topic-grid");

      mod.topics.forEach((topic) => {
        const flatIdx = globalIdx;
        const isCompleted = completedTopics.has(topic.id);
        const isDue = dueIds.includes(topic.id);
        // Everything is open. The old hard lock enforced blocked
        // practice (the thing interleaving beats) and removed choice
        // (the autonomy need that actually drives motivation). Order
        // is now a recommendation, not a gate.
        const isAvailable = true;
        const prereqDone = flatIdx === 0 || completedTopics.has(state.currentTopics[flatIdx - 1].id);
        const isRecommended = prereqDone && !isCompleted;
        const isAhead = !prereqDone && !isCompleted;
        const isCurrent = isRecommended;
        const dueIn = isCompleted ? DB.daysUntilDue(topic.id) : null;

        const card = document.createElement("div");
        card.className = `topic-card${isCompleted ? " completed" : ""}${isCurrent ? " current" : ""}${isDue ? " due" : ""}${isAhead ? " ahead" : ""}`;
        card.innerHTML = `
          <div class="topic-num">${isCompleted ? "✓" : flatIdx + 1}</div>
          <div class="topic-title">${topic.icon} ${topic.title}</div>
          <div class="topic-desc">${topic.desc}</div>
          <div class="topic-meta">
            <span>${topic.chunks.length} chunks</span>
            <span>·</span>
            <span>${topic.examQuestions.length}-q exam</span>
            ${isDue ? '<span class="topic-badge due-badge">🔁 Due now</span>'
              : isCompleted ? `<span class="topic-badge mastered">✓ Review in ${dueIn}d</span>` : ""}
            ${isRecommended ? '<span class="topic-badge recommended">→ Recommended next</span>' : ""}
            ${isAhead ? '<span class="topic-badge ahead-badge">⤴ Jumping ahead</span>' : ""}
          </div>
        `;

        card.addEventListener("click", () => startTopic(flatIdx));
        grid.appendChild(card);
        globalIdx++;
      });
    });

    updateGlobalProgress();
    updateProfileBadge();
  }

  function updateGlobalProgress() {
    // Ring reflects progress within the CURRENTLY SELECTED unit only.
    const completedTopics = DB.getCompletedTopics();
    const total = state.currentTopics.length;
    const done = state.currentTopics.filter(t => completedTopics.has(t.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById("global-pct").textContent = pct + "%";
    const circle = document.getElementById("global-progress");
    const circumference = 2 * Math.PI * 20;
    circle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }

  // ---- Lesson ----
  function startTopic(flatIdx, forceChunk) {
    state.missedChunks = [];
    state.inRetry = false;
    state.topicCharge = 0;
    state.currentTopicIdx = flatIdx;
    const topic = state.currentTopics[flatIdx];
    // completedChunks has been recorded since the first version and was
    // never read by anything. This is what it was for: come back to the
    // first chunk you haven't finished, not to the start of the topic.
    state.currentChunk = (typeof forceChunk === "number")
      ? forceChunk
      : DB.resumeChunkFor(topic.id, topic.chunks.length);
    state.chunkPhase = "explain";
    state.quizAnswer = null;
    state.quizSubmitted = false;
    DB.setPosition(state.currentUnit, topic.id, state.currentChunk);
    showScreen("lesson");
    renderChunk();
  }

  function getTopic() {
    return state.currentTopics[state.currentTopicIdx];
  }

  function renderChunk() {
    const topic = getTopic();
    const chunk = topic.chunks[state.currentChunk];
    const body = document.getElementById("lesson-body");

    const totalPhases = topic.chunks.length * 3;
    const currentPhase = state.currentChunk * 3 + ["explain", "example", "quiz"].indexOf(state.chunkPhase) + 1;
    document.getElementById("lesson-progress-fill").style.width = (currentPhase / totalPhases * 100) + "%";
    document.getElementById("chunk-counter").textContent = `${state.currentChunk + 1}/${topic.chunks.length}`;

    if (state.chunkPhase === "explain") renderExplain(body, chunk);
    else if (state.chunkPhase === "example") renderExample(body, chunk);
    else if (state.chunkPhase === "quiz") renderQuiz(body, chunk);
  }

  function renderExplain(body, chunk) {
    // Explanations may be a single `text` string (legacy, modules 1-4) or an
    // array of `blocks` (modules 5+). Blocks let one concept run across several
    // passages with their own sub-headings instead of a single wall of text.
    const blocks = chunk.explain.blocks
      || (chunk.explain.text ? [{ text: chunk.explain.text }] : []);

    const blocksHtml = blocks.map(b => `
      ${b.heading ? `<h3 class="chunk-subhead">${b.heading}</h3>` : ""}
      <div class="chunk-text">${b.text}</div>
    `).join("");

    let analogyHtml = "";
    if (chunk.explain.analogy) {
      analogyHtml = `
        <div class="analogy-box">
          <div class="analogy-label">💡 Analogy</div>
          <div class="analogy-text">${chunk.explain.analogy}</div>
        </div>`;
    }

    // Citations let a reader verify any claim in the chunk against a real,
    // findable source rather than taking the app's word for it.
    let sourcesHtml = "";
    if (chunk.explain.sources && chunk.explain.sources.length) {
      const items = chunk.explain.sources.map(src => `
        <li class="source-item">
          <span class="source-ref">${src.ref}</span>
          ${src.note ? `<span class="source-note">${src.note}</span>` : ""}
        </li>`).join("");
      sourcesHtml = `
        <details class="sources-box">
          <summary class="sources-label">📚 Sources &amp; further reading</summary>
          <ul class="sources-list">${items}</ul>
        </details>`;
    }

    body.innerHTML = `
      <div class="chunk-section">
        <div class="chunk-phase explain">📖 Explanation</div>
        <h2 class="chunk-title">${chunk.title}</h2>
        ${blocksHtml}
        ${analogyHtml}
        ${sourcesHtml}
        <div class="btn-row">
          <button id="btn-next-phase" class="btn-primary">See Example <span class="arrow">→</span></button>
        </div>
      </div>
    `;
    document.getElementById("btn-next-phase").addEventListener("click", () => {
      state.chunkPhase = "example";
      renderChunk();
    });
  }

  function renderExample(body, chunk) {
    const stepsHtml = chunk.example.steps.map((s, i) =>
      `<div class="flow-step"><span class="flow-num">${i + 1}</span><span>${s}</span></div>`
    ).join("");

    body.innerHTML = `
      <div class="chunk-section">
        <div class="chunk-phase example">🧪 Example</div>
        <h2 class="chunk-title">${chunk.title}</h2>
        <div class="example-box">
          <div class="example-label">${chunk.example.label}</div>
          <div class="example-flow">${stepsHtml}</div>
        </div>
        <div class="btn-row">
          <button id="btn-prev-phase" class="btn-ghost">← Back to explanation</button>
          <button id="btn-next-phase" class="btn-primary">Answer Question <span class="arrow">→</span></button>
        </div>
      </div>
    `;
    document.getElementById("btn-prev-phase").addEventListener("click", () => {
      state.chunkPhase = "explain";
      renderChunk();
    });
    document.getElementById("btn-next-phase").addEventListener("click", () => {
      state.chunkPhase = "quiz";
      state.quizAnswer = null;
      state.quizSubmitted = false;
      renderChunk();
    });
  }

  function renderQuiz(body, chunk) {
    const q = chunk.quiz;
    const letters = ["A", "B", "C", "D", "E", "F"];
    const topic = getTopic();

    const optionsHtml = q.options.map((opt, i) => {
      let cls = "quiz-opt";
      if (state.quizSubmitted) {
        if (i === q.correct) cls += " correct";
        else if (i === state.quizAnswer && i !== q.correct) cls += " wrong";
      } else if (state.quizAnswer === i) {
        cls += " selected";
      }
      return `<div class="${cls}" data-idx="${i}">
        <span class="quiz-letter">${letters[i]}</span>
        <span>${opt}</span>
      </div>`;
    }).join("");

    let feedbackHtml = "";
    if (state.quizSubmitted) {
      const isCorrect = state.quizAnswer === q.correct;
      feedbackHtml = `
        <div class="quiz-feedback ${isCorrect ? "correct" : "wrong"}">
          <div class="fb-title">${isCorrect ? "✅ Correct!" : "❌ Not quite."}</div>
          <div>${q.explanation}</div>
        </div>`;
    }

    const isLastChunk = state.currentChunk >= topic.chunks.length - 1;
    const nextBtnText = isLastChunk ? "Take Mastery Exam 🏆" : "Next Chunk →";

    body.innerHTML = `
      <div class="chunk-section">
        <div class="chunk-phase quiz">❓ Question</div>
        <h2 class="chunk-title">${chunk.title}</h2>
        <div class="quiz-question">${q.question}</div>
        <div class="quiz-options">${optionsHtml}</div>
        ${feedbackHtml}
        <div class="btn-row">
          <button id="btn-prev-phase" class="btn-ghost">← Back to example</button>
          ${!state.quizSubmitted ? `<button id="btn-submit-quiz" class="btn-primary" ${state.quizAnswer === null ? "disabled" : ""}>Check Answer</button>` : ""}
          ${state.quizSubmitted ? `<button id="btn-next-chunk" class="btn-primary">${nextBtnText}</button>` : ""}
        </div>
      </div>
    `;

    if (!state.quizSubmitted) {
      body.querySelectorAll(".quiz-opt").forEach(opt => {
        opt.addEventListener("click", () => {
          state.quizAnswer = parseInt(opt.dataset.idx);
          renderChunk();
        });
      });
    }

    const submitBtn = document.getElementById("btn-submit-quiz");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (state.quizAnswer === null) return;
        state.quizSubmitted = true;
        // Record quiz result in DB
        const isCorrect = state.quizAnswer === q.correct;
        DB.recordQuizAnswer(topic.id, state.currentChunk, isCorrect);
        // A wrong answer used to have no consequence at all. Now the
        // chunk is queued to be re-asked before the exam, which turns
        // the question from decoration into practice testing.
        if (!isCorrect && !state.inRetry && !state.missedChunks.includes(state.currentChunk)) {
          state.missedChunks.push(state.currentChunk);
        }
        renderChunk();
      });
    }

    document.getElementById("btn-prev-phase").addEventListener("click", () => {
      state.chunkPhase = "example";
      renderChunk();
    });

    const nextBtn = document.getElementById("btn-next-chunk");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        DB.markChunkComplete(topic.id, state.currentChunk);
        // 5-7 charge per chunk. Retries don't pay again — otherwise
        // deliberately failing would be the fastest way to farm it.
        if (!state.inRetry) {
          const gain = 5 + Math.floor(Math.random() * 3);
          state.topicCharge = (state.topicCharge || 0) + gain;
          awardCharge(gain, nextBtn);
        }
        if (state.inRetry) {
          if (state.missedChunks.length) { startMissedRetry(); } else { startExam(); }
          return;
        }
        if (isLastChunk) {
          if (state.missedChunks.length) {
            startMissedRetry();
          } else {
            startExam();
          }
        } else {
          state.currentChunk++;
          state.chunkPhase = "explain";
          state.quizAnswer = null;
          state.quizSubmitted = false;
          DB.setPosition(state.currentUnit, topic.id, state.currentChunk);
          renderChunk();
        }
      });
    }
  }

  // Re-ask the questions that were answered wrong, straight to the
  // quiz phase — no re-reading, which is the technique the research
  // rates near the bottom.
  function startMissedRetry() {
    state.inRetry = true;
    state.currentChunk = state.missedChunks.shift();
    state.chunkPhase = "quiz";
    state.quizAnswer = null;
    state.quizSubmitted = false;
    renderChunk();
  }

  // ---- Mastery Exam ----
  function startExam() {
    const topic = getTopic();
    // Fresh shuffle on every attempt, including retries.
    state.examQuestions = shuffled(topic.examQuestions).map(shuffleQuestion);
    state.examIndex = 0;
    state.examAnswers = [];
    state.examSubmitted = [];
    state.quizAnswer = null;
    state.quizSubmitted = false;
    showScreen("exam");
    renderExamQuestion();
  }

  function renderExamQuestion() {
    const topic = getTopic();
    const total = state.examQuestions.length;
    const idx = state.examIndex;
    const q = state.examQuestions[idx];
    const body = document.getElementById("exam-body");
    const letters = ["A", "B", "C", "D", "E", "F"];

    document.getElementById("exam-score-display").textContent = `${idx + 1}/${total}`;

    const optionsHtml = q.options.map((opt, i) => {
      let cls = "quiz-opt";
      if (state.examSubmitted[idx]) {
        if (i === q.correct) cls += " correct";
        else if (i === state.examAnswers[idx] && i !== q.correct) cls += " wrong";
      } else if (state.examAnswers[idx] === i) {
        cls += " selected";
      }
      return `<div class="${cls}" data-idx="${i}">
        <span class="quiz-letter">${letters[i]}</span>
        <span>${opt}</span>
      </div>`;
    }).join("");

    let feedbackHtml = "";
    if (state.examSubmitted[idx]) {
      const isCorrect = state.examAnswers[idx] === q.correct;
      feedbackHtml = `
        <div class="quiz-feedback ${isCorrect ? "correct" : "wrong"}">
          <div class="fb-title">${isCorrect ? "✅ Correct!" : `❌ Wrong — the answer is ${letters[q.correct]}.`}</div>
        </div>`;
    }

    const isLast = idx === total - 1;

    body.innerHTML = `
      <div class="exam-header">
        <h2>${topic.icon} ${topic.title} — Mastery Exam</h2>
        <p>Score 80% or higher to master this topic and start its review schedule.</p>
      </div>
      <div class="exam-q-counter">Question ${idx + 1} of ${total}</div>
      <div class="exam-question-card">
        <div class="quiz-question">${q.question}</div>
        <div class="quiz-options">${optionsHtml}</div>
        ${feedbackHtml}
        <div class="btn-row">
          ${!state.examSubmitted[idx] ? `<button id="btn-exam-submit" class="btn-primary" ${state.examAnswers[idx] === null ? "disabled" : ""}>Check Answer</button>` : ""}
          ${state.examSubmitted[idx] && !isLast ? `<button id="btn-exam-next" class="btn-primary">Next Question <span class="arrow">→</span></button>` : ""}
          ${state.examSubmitted[idx] && isLast ? `<button id="btn-exam-finish" class="btn-primary">See Results 🏆</button>` : ""}
        </div>
      </div>
    `;

    if (!state.examSubmitted[idx]) {
      body.querySelectorAll(".quiz-opt").forEach(opt => {
        opt.addEventListener("click", () => {
          state.examAnswers[idx] = parseInt(opt.dataset.idx);
          renderExamQuestion();
        });
      });
    }

    const submitBtn = document.getElementById("btn-exam-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (state.examAnswers[idx] === null) return;
        state.examSubmitted[idx] = true;
        renderExamQuestion();
      });
    }

    const nextBtn = document.getElementById("btn-exam-next");
    if (nextBtn) nextBtn.addEventListener("click", () => { state.examIndex++; renderExamQuestion(); });

    const finishBtn = document.getElementById("btn-exam-finish");
    if (finishBtn) finishBtn.addEventListener("click", () => showExamResults());
  }

  function showExamResults() {
    const topic = getTopic();
    const total = state.examQuestions.length;
    let correct = 0;
    state.examQuestions.forEach((q, i) => {
      if (state.examAnswers[i] === q.correct) correct++;
    });
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= 80;

    // Record exam result in DB
    DB.recordExamResult(topic.id, correct, total, passed);
    // Map percentage onto SM-2's 0-5 quality scale.
    DB.scheduleReview(topic.id, Math.max(0, Math.min(5, Math.round(pct / 20))));
    if (passed) {
      DB.markTopicComplete(topic.id);
    }
    const nextIn = DB.daysUntilDue(topic.id);

    document.getElementById("result-icon").textContent = passed ? "🎉" : "📚";
    document.getElementById("result-title").textContent = passed ? "Topic Mastered!" : "Not Quite Yet";
    document.getElementById("result-desc").textContent = passed
      ? `You scored ${correct}/${total} on "${topic.title}". It'll come back for review in ${nextIn} day${nextIn === 1 ? "" : "s"} — that's when it does the most good.`
      : `You scored ${correct}/${total}, and 80% masters the topic. Rather than re-reading, go straight back to the questions you missed — that's what actually moves the needle.`;
    const scoreEl = document.getElementById("result-score");
    scoreEl.textContent = `${pct}%`;
    scoreEl.className = `result-score ${passed ? "pass" : "fail"}`;

    // The reward lands on finishing a TOPIC, not a chunk. One quote per
    // topic means ~6 per module against a pool of 57, so nothing repeats
    // and finishing a topic stays worth something.
    // Topic bonus: what the chunks earned, multiplied by how the exam
    // went. 0% -> x0.7, 100% -> x1.5. Rewards finishing well without
    // making a bad run worthless.
    const mult = 0.7 + (pct / 100) * 0.8;
    const bonus = Math.round((state.topicCharge || 0) * mult);
    const bonusEl = document.getElementById("result-charge");
    if (bonusEl) {
      if (bonus > 0) {
        const scoreCard = document.getElementById("result-score");
        const granted = awardCharge(bonus, scoreCard);
        bonusEl.innerHTML = granted > 0
          ? `<span class="charge-award">\u26A1 +${granted} charge <span class="ca-mult">(&times;${mult.toFixed(2)} for ${pct}%)</span></span>`
          : `<span class="charge-award full">\u26A1 Charge full at ${DB.chargeCap()}</span>`;
      } else {
        bonusEl.innerHTML = "";
      }
    }
    state.topicCharge = 0;

    // Topic finished — there's no half-done chunk to come back to.
    if (passed) DB.clearPosition();

    const wisdomEl = document.getElementById("result-wisdom");
    if (wisdomEl) {
      if (passed) {
        // Pool the wisdomTags of every chunk in the topic, so the quote
        // can speak to anything the topic covered.
        const tags = topic.chunks.flatMap(c => c.wisdomTags || []);
        wisdomEl.innerHTML = quoteHtml(pickQuote(tags));
      } else {
        wisdomEl.innerHTML = "";
      }
    }

    showScreen("exam-result");
  }

  // ---- Navigation ----
  document.getElementById("btn-start").addEventListener("click", () => {
    checkProfile();
    showLobby();
  });

  document.getElementById("btn-lobby-courses").addEventListener("click", renderCourseSelect);
  document.getElementById("btn-back-lobby").addEventListener("click", showLobby);
  document.getElementById("btn-back-courses").addEventListener("click", renderCourseSelect);
  document.getElementById("btn-lobby-stats").addEventListener("click", showStatsModal);
  document.getElementById("btn-lobby-garden").addEventListener("click", renderGarden);
  document.getElementById("btn-lobby-settings").addEventListener("click", renderSettings);
  document.getElementById("btn-back-lobby2").addEventListener("click", showLobby);
  document.getElementById("btn-back-lobby3").addEventListener("click", showLobby);

  // Resume: jump straight back into the exact chunk they left.
  document.getElementById("btn-lobby-resume").addEventListener("click", () => {
    const pos = DB.getPosition();
    if (!pos) return showLobby();
    const course = COURSES.find(c => c.units.includes(pos.unitId));
    state.currentCourse = course ? course.id : null;
    selectUnit(pos.unitId);
    const idx = state.currentTopics.findIndex(t => t.id === pos.topicId);
    if (idx >= 0) startTopic(idx, pos.chunkIdx);
  });

  document.getElementById("btn-lobby-review").addEventListener("click", () => {
    const due = DB.getDueTopicIds();
    if (!due.length) return;
    const topic = ALL_TOPICS.find(t => due.includes(t.id));
    if (!topic) return;
    const course = COURSES.find(c => c.units.includes(topic.unit));
    state.currentCourse = course ? course.id : null;
    selectUnit(topic.unit);
    const idx = state.currentTopics.findIndex(t => t.id === topic.id);
    if (idx >= 0) startTopic(idx);
  });

  document.getElementById("btn-back-units").addEventListener("click", () => {
    showScreen("unit-select");
    renderUnitSelect();
  });

  document.getElementById("btn-back-topics").addEventListener("click", () => {
    showScreen("topic-map");
    renderTopicMap();
  });

  document.getElementById("btn-back-topics2").addEventListener("click", () => {
    showScreen("topic-map");
    renderTopicMap();
  });

  document.getElementById("btn-retry").addEventListener("click", () => startExam());

  document.getElementById("btn-to-topics").addEventListener("click", () => {
    showScreen("topic-map");
    renderTopicMap();
  });

  // ---- Init ----
  DB.init();
  applyTheme(DB.getTheme());
  renderCharge();
  updateProfileBadge();

})();

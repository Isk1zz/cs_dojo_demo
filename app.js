// ================================================
// Dojo — Application Logic
// Integrates with DB for profile & stats persistence
// Units (6, 7, ...) are independent, separately-unlocked tracks.
// ================================================

(() => {
  // ---- State ----
  const state = {
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

    body.innerHTML = `
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
          <div class="stat-label">Mini Quiz Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value yellow">${stats.examAccuracy}%</div>
          <div class="stat-label">Exam Accuracy</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value accent">${stats.miniQuizCorrect}/${stats.miniQuizTotal}</div>
          <div class="stat-label">Mini Quiz Score</div>
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
  function renderUnitSelect() {
    const body = document.getElementById("unit-select-body");
    body.innerHTML = "";
    const completedTopics = DB.getCompletedTopics();

    const grid = document.createElement("div");
    grid.className = "topic-grid";

    UNITS.forEach(u => {
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
    let globalIdx = 0;

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
        // Unlock sequencing is scoped to THIS unit's topic list only —
        // completing Unit 6 has no bearing on Unit 7's unlock order.
        const isAvailable = flatIdx === 0 || completedTopics.has(state.currentTopics[flatIdx - 1].id);
        const isCurrent = isAvailable && !isCompleted;

        const card = document.createElement("div");
        card.className = `topic-card${isCompleted ? " completed" : ""}${isCurrent ? " current" : ""}${!isAvailable ? " locked" : ""}`;
        card.innerHTML = `
          <div class="topic-num">${isCompleted ? "✓" : flatIdx + 1}</div>
          <div class="topic-title">${topic.icon} ${topic.title}</div>
          <div class="topic-desc">${topic.desc}</div>
          <div class="topic-meta">
            <span>${topic.chunks.length} chunks</span>
            <span>·</span>
            <span>${topic.examQuestions.length}-q exam</span>
            ${isCompleted ? '<span class="topic-badge mastered">✓ Mastered</span>' : ""}
            ${!isAvailable ? '<span class="topic-badge">🔒 Locked</span>' : ""}
          </div>
        `;

        if (isAvailable) {
          card.addEventListener("click", () => startTopic(flatIdx));
        }
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
  function startTopic(flatIdx) {
    state.currentTopicIdx = flatIdx;
    state.currentChunk = 0;
    state.chunkPhase = "explain";
    state.quizAnswer = null;
    state.quizSubmitted = false;
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
    let analogyHtml = "";
    if (chunk.explain.analogy) {
      analogyHtml = `
        <div class="analogy-box">
          <div class="analogy-label">💡 Analogy</div>
          <div class="analogy-text">${chunk.explain.analogy}</div>
        </div>`;
    }
    body.innerHTML = `
      <div class="chunk-section">
        <div class="chunk-phase explain">📖 Explanation</div>
        <h2 class="chunk-title">${chunk.title}</h2>
        <div class="chunk-text">${chunk.explain.text}</div>
        ${analogyHtml}
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
          <button id="btn-next-phase" class="btn-primary">Take Mini Quiz <span class="arrow">→</span></button>
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
        <div class="chunk-phase quiz">❓ Mini Quiz</div>
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
        if (isLastChunk) {
          startExam();
        } else {
          state.currentChunk++;
          state.chunkPhase = "explain";
          state.quizAnswer = null;
          state.quizSubmitted = false;
          renderChunk();
        }
      });
    }
  }

  // ---- Mastery Exam ----
  function startExam() {
    const topic = getTopic();
    state.examIndex = 0;
    state.examAnswers = new Array(topic.examQuestions.length).fill(null);
    state.examSubmitted = new Array(topic.examQuestions.length).fill(false);
    showScreen("exam");
    renderExamQuestion();
  }

  function renderExamQuestion() {
    const topic = getTopic();
    const total = topic.examQuestions.length;
    const idx = state.examIndex;
    const q = topic.examQuestions[idx];
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
        <p>Score 80% or higher to master this topic and unlock the next one.</p>
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
    const total = topic.examQuestions.length;
    let correct = 0;
    topic.examQuestions.forEach((q, i) => {
      if (state.examAnswers[i] === q.correct) correct++;
    });
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= 80;

    // Record exam result in DB
    DB.recordExamResult(topic.id, correct, total, passed);
    if (passed) {
      DB.markTopicComplete(topic.id);
    }

    document.getElementById("result-icon").textContent = passed ? "🎉" : "📚";
    document.getElementById("result-title").textContent = passed ? "Topic Mastered!" : "Not Quite Yet";
    document.getElementById("result-desc").textContent = passed
      ? `You nailed "${topic.title}"! You scored ${correct}/${total}. The next topic is now unlocked.`
      : `You scored ${correct}/${total}. You need 80% to master this topic. Review the chunks and try again — you got this!`;
    const scoreEl = document.getElementById("result-score");
    scoreEl.textContent = `${pct}%`;
    scoreEl.className = `result-score ${passed ? "pass" : "fail"}`;

    showScreen("exam-result");
  }

  // ---- Navigation ----
  document.getElementById("btn-start").addEventListener("click", () => {
    checkProfile();
    showScreen("unit-select");
    renderUnitSelect();
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
  updateProfileBadge();

})();

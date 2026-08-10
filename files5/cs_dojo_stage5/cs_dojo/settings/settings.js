// ================================================
// CS Dojo — SETTINGS
// ------------------------------------------------
// Theme picking (owned themes only), data export/import, the admin
// code box, and the legal placeholders. Owns no game data.
// ================================================

(() => {
  // ---- seam: everything this branch borrows from elsewhere ----
  // Late-bound on purpose. A branch may be loaded before the branch
  // it calls into, so these resolve at call time, not at load time.
  const THEMES = Dojo.THEMES;
  const PREMIUM_THEMES = Dojo.PREMIUM_THEMES;
  const showScreen = Dojo.showScreen;
  const Router = Dojo.Router;
  const Bus = Dojo.Bus;
  const applyTheme = (...a) => Dojo.applyTheme(...a);
  const renderShop = (...a) => Dojo.renderShop(...a);
  const renderCharge = (...a) => Dojo.renderCharge(...a);
  const updateProfileBadge = (...a) => Dojo.updateProfileBadge(...a);
  const showLobby = (...a) => Dojo.showLobby(...a);

  // ---- Settings ----
  function renderSettings() {
    const body = document.getElementById("settings-body");
    const current = DB.getTheme();
    const owned = PREMIUM_THEMES.filter(t => DB.ownsTheme(t.id));
    const locked = PREMIUM_THEMES.length - owned.length;

    const swatch = t => `
      <button class="theme-swatch${t.id === current ? " active" : ""}"
              data-theme="${t.id}" style="--sw:${t.swatch};--sw-bg:${t.card}">
        <span class="sw-preview"><span class="sw-dot"></span></span>
        <span class="sw-name">${t.name}</span>
      </button>`;

    body.innerHTML = `
      <div class="settings-section">
        <div class="stats-section-title">\u{1F3A8} Colour theme</div>
        <p class="settings-hint">Changes the whole app, not just the accent.</p>
        <div class="theme-grid">
          ${THEMES.map(swatch).join("")}
        </div>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u2728 Premium themes</div>
        <p class="settings-hint">
          ${owned.length
            ? `${owned.length} unlocked.`
            : "None unlocked yet."}
          ${locked ? `${locked} more available in the Shop for lightning charge.` : "You own them all."}
        </p>
        ${owned.length ? `<div class="theme-grid">${owned.map(swatch).join("")}</div>` : ""}
        <button id="btn-settings-shop" class="btn-ghost" style="margin-top:0.9rem;">\u26A1 Open the Shop</button>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u{1F511} Unlock code</div>
        <p class="settings-hint">For testing and demos.</p>
        <div class="admin-row">
          <input id="admin-code-input" class="modal-input admin-input" type="text"
                 placeholder="Enter code..." autocomplete="off" spellcheck="false" />
          <button id="btn-admin-apply" class="btn-ghost">Apply</button>
        </div>
        <div id="admin-msg" class="settings-hint" style="margin-top:0.5rem;"></div>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u{1F4C4} Legal</div>
        <details class="legal-block">
          <summary>Terms of Service</summary>
          <p>PLACEHOLDER \u2014 not written yet. Needed before any public or paid
          release. See docs/LEGAL.md for what still has to be decided.</p>
        </details>
        <details class="legal-block">
          <summary>Privacy Policy</summary>
          <p>PLACEHOLDER \u2014 not written yet. Current factual position: all data is
          stored in this browser's localStorage. Nothing is transmitted anywhere,
          there is no account, no server and no analytics.</p>
        </details>
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


    // Codes. Every cheat lives in this one table and nowhere else, so
    // there is a single place to strip them for a public build.
    const CODES = {
      admin613: () => {
        const ids = (typeof ALL_TOPICS !== "undefined" ? ALL_TOPICS : []).map(t => t.id);
        const n = DB.unlockAllTopics(ids);
        Bus.emit("progress:changed", { reason: "admin" });
        return `Unlocked. ${n} topics marked complete.`;
      },
      parnasa100: () => {
        DB.addMoney(100);
        Bus.emit("wallet:changed", { delta: 100, reason: "code" });
        return `+$100. Wallet is now $${DB.getWallet()}.`;
      }
    };

    const applyBtn = document.getElementById("btn-admin-apply");
    const codeInput = document.getElementById("admin-code-input");
    const msg = document.getElementById("admin-msg");
    function applyCode() {
      const val = (codeInput.value || "").trim();
      const fn = CODES[val];
      if (!fn) { msg.textContent = "Not a valid code."; return; }
      const result = fn();
      codeInput.value = "";
      msg.textContent = result;
      if (Dojo.renderVitals) Dojo.renderVitals();
    }
    if (applyBtn) applyBtn.addEventListener("click", applyCode);
    if (codeInput) codeInput.addEventListener("keydown", e => { if (e.key === "Enter") applyCode(); });

    const shopBtn = document.getElementById("btn-settings-shop");
    if (shopBtn) shopBtn.addEventListener("click", renderShop);

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

  // ---- seam: what this branch offers to everyone else ----
  Object.assign(Dojo, { renderSettings });
})();

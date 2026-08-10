// ================================================
// CS Dojo — SHOP
// ------------------------------------------------
// The sink for lightning charge. Cosmetic goods only — nothing here
// buys progress, hints, retries or exam advantage, because the whole
// learning argument falls over if grinding is the shortest path to a
// passing score. Life-shop consumables (v5) live in shop/life.js.
// ================================================

(() => {
  // ---- seam: everything this branch borrows from elsewhere ----
  // Late-bound on purpose. A branch may be loaded before the branch
  // it calls into, so these resolve at call time, not at load time.
  const PREMIUM_THEMES = Dojo.PREMIUM_THEMES;
  const showScreen = Dojo.showScreen;
  const Router = Dojo.Router;
  const Bus = Dojo.Bus;
  const applyTheme = (...a) => Dojo.applyTheme(...a);
  const renderCharge = (...a) => Dojo.renderCharge(...a);

  // ---- Shop ----
  // This is the sink the charge system was missing. Before it, the cap
  // was reached about four topics into a 26-topic course and the bar
  // stopped meaning anything for the remaining 22. Spending frees room
  // to earn again, so the bar keeps moving for the whole course.
  //
  // Deliberately cosmetic only. Nothing here buys progress, hints,
  // retries or exam advantages — that would turn a study app into a
  // game where the shortest path to a passing score is grinding, and
  // the whole design argument (§5 of PROJECT.md) is against that.
  // What the lobby tile shows.
  function shopSummary() {
    const bal = DB.getCharge();
    const affordable = PREMIUM_THEMES.filter(t => !DB.ownsTheme(t.id) && bal >= t.price).length;
    return affordable
      ? `\u26A1 ${bal} \u00b7 ${affordable} item${affordable === 1 ? "" : "s"} you can afford`
      : `\u26A1 ${bal} \u00b7 spend it on themes`;
  }

  // This screen is the CHARGE side only. Money — vitals, food, shelter,
  // game unlocks — lives on the Story tab of the Arcade, because it is
  // all one coin and one fiction. See shop/life.js and story/story.js.
  function renderShop() {
    const body = document.getElementById("shop-body");
    renderThemesTab(body);
    showScreen("shop");
  }

  function renderThemesTab(body) {
    const balance = DB.getCharge();
    const totals = DB.getChargeTotals();
    const current = DB.getTheme();

    body.innerHTML = `
      <div class="shop-wallet">
        <div class="sw-balance"><span class="sw-bolt">\u26A1</span>${balance}<span class="sw-cap">/${DB.chargeCap()}</span></div>
        <div class="sw-meta">${totals.earned} earned all-time \u00b7 ${totals.spent} spent</div>
        <p class="settings-hint" style="margin:0.6rem 0 0;">
          Charge comes from finishing chunks and passing exams. Spending it here
          frees room on the bar to earn more. Everything in the shop is cosmetic.
        </p>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u{1F3A8} Premium themes</div>
        <div class="shop-grid" id="shop-grid"></div>
      </div>
      <div class="settings-section">
        <div class="stats-section-title">\u{1F512} Coming later</div>
        <div class="shop-grid">
          <div class="shop-card soon">
            <div class="shop-card-preview" style="background:linear-gradient(135deg,#1f2937,#111827)"></div>
            <div class="shop-card-body">
              <div class="shop-name">Garden decorations</div>
              <div class="shop-tagline">Lanterns, stones and paths for the Garden</div>
              <div class="shop-price soon-tag">Not built yet</div>
            </div>
          </div>
          <div class="shop-card soon">
            <div class="shop-card-preview" style="background:linear-gradient(135deg,#0f172a,#1e293b)"></div>
            <div class="shop-card-body">
              <div class="shop-name">Quote packs</div>
              <div class="shop-tagline">Extra source-checked wisdom pools</div>
              <div class="shop-price soon-tag">Not built yet</div>
            </div>
          </div>
        </div>
      </div>`;

    const grid = body.querySelector("#shop-grid");

    PREMIUM_THEMES.forEach(t => {
      const ownedIt = DB.ownsTheme(t.id);
      const equipped = ownedIt && current === t.id;
      const afford = balance >= t.price;

      const card = document.createElement("div");
      card.className = `shop-card${ownedIt ? " owned" : ""}`;
      card.innerHTML = `
        <div class="shop-card-preview" style="background:${t.deep};">
          <div class="scp-bg" style="background:${t.bg};"></div>
          <div class="scp-chip" style="background:${t.card};border-color:${t.accent};">
            <span class="scp-dot" style="background:${t.accent};box-shadow:0 0 10px ${t.accent};"></span>
            <span class="scp-line" style="background:${t.light};"></span>
          </div>
          <div class="scp-bar"><div class="scp-fill" style="background:linear-gradient(90deg,${t.bolt[0]},${t.bolt[1]},${t.bolt[2]});"></div></div>
        </div>
        <div class="shop-card-body">
          <div class="shop-name">${t.name}</div>
          <div class="shop-tagline">${t.tagline}</div>
          ${ownedIt
            ? `<button class="shop-btn ${equipped ? "equipped" : "equip"}" ${equipped ? "disabled" : ""}>
                 ${equipped ? "\u2713 Equipped" : "Equip"}
               </button>`
            : `<button class="shop-btn buy${afford ? "" : " short"}" ${afford ? "" : "disabled"}>
                 \u26A1 ${t.price}${afford ? "" : ` \u00b7 need ${t.price - balance} more`}
               </button>`}
        </div>`;

      const btn = card.querySelector("button");
      if (btn && !btn.disabled) {
        btn.addEventListener("click", () => {
          if (ownedIt) {
            DB.setTheme(t.id);
            applyTheme(t.id);
            renderShop();
          } else if (DB.buyTheme(t.id, t.price)) {
            DB.setTheme(t.id);
            applyTheme(t.id);
            renderCharge();
            renderShop();
          }
        });
      }
      grid.appendChild(card);
    });
  }

  // ---- seam: what this branch offers to everyone else ----
  Object.assign(Dojo, { renderShop, shopSummary });
})();

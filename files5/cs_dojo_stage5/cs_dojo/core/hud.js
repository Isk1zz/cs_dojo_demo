// ================================================
// CS Dojo — CORE / heads-up display
// ------------------------------------------------
// The always-on top strip: lightning charge, and (v5) wallet and
// energy. Charge is EARNED here and SPENT in shop/. This file never
// decides what charge is worth — it only renders and animates.
// Emits: charge:earned
// ================================================

(() => {
  // ---- seam: everything this branch borrows from elsewhere ----
  // Late-bound on purpose. A branch may be loaded before the branch
  // it calls into, so these resolve at call time, not at load time.


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

  // ---- seam: what this branch offers to everyone else ----
  Object.assign(Dojo, { renderCharge, awardCharge, flyBolt });
})();

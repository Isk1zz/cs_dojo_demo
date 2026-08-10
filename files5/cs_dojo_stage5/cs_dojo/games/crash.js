// ================================================
// CS Dojo — ARCADE / Crash
// ------------------------------------------------
// A multiplier climbs from 1.00x and breaks at a hidden point. Cash
// out before it breaks and you keep stake x multiplier; too slow and
// the stake is gone.
//
// This file owns the MATHS. games.js owns the gate and the wallet —
// this file must never call DB.addMoney or DB.spendMoney directly.
// ================================================

(() => {
  // ---- The distribution ----
  //
  // crash = 1 / (1 - u), u uniform on [0, 1).
  //
  // That gives P(crash >= m) = 1/m, so cashing out at any target m has
  // expected return m x (1/m) = 1. A flat 1.0 is a fair game with no
  // house edge at all, so HOUSE_EDGE of the rounds are forced to bust
  // instantly at 1.00x. Expected return is then exactly (1 - HOUSE_EDGE)
  // whatever multiplier you aim for — you cannot out-think it by
  // picking a lucky target, which is the honest way to build this.
  //
  //   RTP = 96%. Over many rounds the arcade takes 4c per dollar staked.
  //
  // MAX_MULT bounds the tail. Without it, one lucky round at the $50
  // stake cap could pay four figures and make the Garden pointless.
  // 25x x $50 = $1,250 is already the biggest number in the app.
  const HOUSE_EDGE = 0.04;
  const MAX_MULT = 25;

  // Speed of the climb: doubles every GROWTH_SECONDS.
  const GROWTH_SECONDS = 4;
  const K = Math.LN2 / GROWTH_SECONDS;

  function rollCrashPoint() {
    if (Math.random() < HOUSE_EDGE) return 1.00;
    const u = Math.random();
    const raw = 1 / (1 - u);
    return Math.min(MAX_MULT, Math.floor(raw * 100) / 100);
  }

  function multAt(elapsedMs) {
    return Math.exp(K * (elapsedMs / 1000));
  }

  // ---- State for one round ----
  // Deliberately module-scoped and reset on mount: only one round can
  // be in flight, and leaving the screen must not leave a timer running.
  let live = null;

  function stop() {
    if (live && live.raf) cancelAnimationFrame(live.raf);
    if (live && live.timer) clearInterval(live.timer);
    live = null;
  }

  function mount(container, api) {
    stop();

    const panel = document.createElement("div");
    panel.className = "crash-panel";
    panel.innerHTML = `
      <div class="crash-head">
        <div class="stats-section-title">\u{1F4C8} Crash</div>
        <button class="btn-ghost crash-close">\u2715 Close</button>
      </div>
      <div class="crash-stage">
        <div class="crash-mult" id="crash-mult">1.00\u00d7</div>
        <div class="crash-status" id="crash-status">Set a stake and go.</div>
        <div class="crash-track"><div class="crash-fill" id="crash-fill"></div></div>
      </div>
      <div class="crash-controls">
        <label class="crash-stake">
          <span>Stake</span>
          <input id="crash-stake" class="modal-input admin-input" type="number"
                 min="1" max="${api.MAX_STAKE}" step="1" value="5" />
        </label>
        <button id="crash-go" class="btn-primary">Start</button>
      </div>
      <div class="crash-history" id="crash-history"></div>
      <p class="settings-hint">
        Costs 1 ticket, ${Dojo.Games.ENERGY_PER_ROUND} energy and a little upkeep per round.
        Max stake $${api.MAX_STAKE}, max multiplier ${MAX_MULT}\u00d7.
        Long-run return is ${Math.round((1 - HOUSE_EDGE) * 100)}% of what you stake \u2014
        the house keeps the rest, so this is a break, not an income.
      </p>`;

    container.innerHTML = "";
    container.appendChild(panel);

    const multEl   = panel.querySelector("#crash-mult");
    const statusEl = panel.querySelector("#crash-status");
    const fillEl   = panel.querySelector("#crash-fill");
    const stakeEl  = panel.querySelector("#crash-stake");
    const goEl     = panel.querySelector("#crash-go");
    const histEl   = panel.querySelector("#crash-history");
    const history  = [];

    panel.querySelector(".crash-close").addEventListener("click", () => {
      stop();
      api.renderGames("games");
    });

    function paintHistory() {
      histEl.innerHTML = history.slice(-8).map(h =>
        `<span class="crash-chip ${h.won ? "won" : "lost"}">${h.at.toFixed(2)}\u00d7</span>`).join("");
    }

    function setPhase(phase) {
      panel.className = `crash-panel ${phase}`;
      const running = phase === "running";
      stakeEl.disabled = running;
      goEl.textContent = running ? "Cash out" : "Start";
    }

    function finish(mult, won, payout) {
      stop();
      history.push({ at: mult, won });
      paintHistory();
      setPhase(won ? "won" : "lost");
      multEl.textContent = `${mult.toFixed(2)}\u00d7`;
      statusEl.textContent = won
        ? `Cashed out at ${mult.toFixed(2)}\u00d7 \u2014 $${payout} back.`
        : `Broke at ${mult.toFixed(2)}\u00d7. Stake gone.`;
      if (Dojo.renderVitals) Dojo.renderVitals();
    }

    function start() {
      const stake = Math.floor(Number(stakeEl.value) || 0);
      const round = api.beginRound(stake, api.gameId);
      if (!round) {
        statusEl.textContent = Dojo.LifeShop && Dojo.LifeShop.isWeak()
          ? Dojo.LifeShop.weakReason() + "."
          : DB.getTickets() < 1 ? "No tickets left \u2014 seven come back every six hours."
          : DB.getWallet() < stake ? "Not enough money for that stake."
          : `Stake must be between $1 and $${api.MAX_STAKE}.`;
        return;
      }

      // Rolled once, up front, and never touched again — the number
      // cannot be nudged by how long the player waits.
      const crashAt = rollCrashPoint();
      const startedAt = Date.now();
      live = { raf: null, timer: null };
      setPhase("running");
      statusEl.textContent = "Climbing\u2026";
      if (Dojo.renderVitals) Dojo.renderVitals();

      const tick = () => {
        if (!live) return;
        const m = multAt(Date.now() - startedAt);
        if (m >= crashAt) {
          finish(crashAt, false, 0);
          return;
        }
        multEl.textContent = `${m.toFixed(2)}\u00d7`;
        fillEl.style.width = `${Math.min(100, (Math.log(m) / Math.log(MAX_MULT)) * 100)}%`;
        live.raf = requestAnimationFrame(tick);
      };

      const cashOut = () => {
        if (!live) return;
        const m = multAt(Date.now() - startedAt);
        if (m >= crashAt) { finish(crashAt, false, 0); return; }
        const payout = Math.floor(round.stake * m);
        api.settle(round, payout, { game: "crash", mult: m });
        finish(m, true, payout);
      };

      live.cashOut = cashOut;
      live.raf = requestAnimationFrame(tick);
    }

    goEl.addEventListener("click", () => {
      if (live && live.cashOut) live.cashOut();
      else { fillEl.style.width = "0%"; start(); }
    });

    setPhase("idle");
  }

  Dojo.Games.register({
    id: "crash",
    name: "Crash",
    tagline: "Cash out before the curve breaks",
    icon: "\u{1F4C8}",
    mount
  });

  // Exposed for testing the maths without a DOM.
  Dojo.Crash = { rollCrashPoint, multAt, HOUSE_EDGE, MAX_MULT };
})();

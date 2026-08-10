// ================================================
// CS Dojo — ARCADE / Hi-Lo
// ------------------------------------------------
// A card 1-13 is shown. Call whether the next one is higher or lower.
//
// This file owns the ODDS. games.js owns the gate and the wallet.
// ================================================

(() => {
  const RTP = 0.96;          // matched to Crash on purpose — see below
  const RANKS = 13;

  // ---- The odds table ----
  //
  // A TIE LOSES. That single rule is what makes the maths clean:
  //
  //   w = number of cards that win the call
  //   payout = RTP * 13 / w
  //   EV     = (w/13) * payout = RTP,  for every card, both directions
  //
  // So the return is a flat 96% whichever card you're looking at and
  // whichever way you call it — exactly like Crash. There is no card
  // that's a better bet than another, which is the honest way to build
  // it: the player can't be punished for not knowing an odds table.
  //
  // A push-on-tie version was tried first and doesn't work. Calling
  // "higher" on a 1 wins 12/13 and pushes 1/13, so it can never lose —
  // and the house can only take its cut by paying under 1x on a win,
  // which is nonsense. Ties losing removes that whole class of problem.
  const RANK_NAME = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["\u2660", "\u2665", "\u2666", "\u2663"];

  function winCount(rank, dir) {
    return dir === "higher" ? RANKS - rank : rank - 1;
  }

  function payoutFor(rank, dir) {
    const w = winCount(rank, dir);
    if (w <= 0) return 0;                       // impossible call
    return Math.round((RTP * RANKS / w) * 100) / 100;
  }

  function drawRank() { return 1 + Math.floor(Math.random() * RANKS); }
  function drawSuit() { return SUITS[Math.floor(Math.random() * SUITS.length)]; }

  function cardHtml(rank, suit, faceDown) {
    if (faceDown) return `<div class="pcard back"></div>`;
    const red = suit === "\u2665" || suit === "\u2666";
    return `<div class="pcard${red ? " red" : ""}">
      <span class="pc-rank">${RANK_NAME[rank]}</span>
      <span class="pc-suit">${suit}</span>
    </div>`;
  }

  function mount(container, api) {
    let round = null;
    let base = null;

    const panel = document.createElement("div");
    panel.className = "table-panel";
    container.innerHTML = "";
    container.appendChild(panel);

    function paint(state) {
      const { message, next, phase } = state || {};
      const hi = base ? payoutFor(base.rank, "higher") : 0;
      const lo = base ? payoutFor(base.rank, "lower") : 0;

      panel.innerHTML = `
        <div class="crash-head">
          <div class="stats-section-title">\u{1F0CF} Hi-Lo</div>
          <button class="btn-ghost table-close">\u2715 Close</button>
        </div>
        <div class="card-row">
          ${base ? cardHtml(base.rank, base.suit) : `<div class="pcard back"></div>`}
          <span class="card-vs">vs</span>
          ${next ? cardHtml(next.rank, next.suit) : `<div class="pcard back"></div>`}
        </div>
        <div class="table-status ${phase || ""}">${message || "Set a stake and deal."}</div>
        ${base && phase === "calling" ? `
          <div class="call-row">
            <button class="shop-btn equip" data-call="higher" ${hi ? "" : "disabled"}>
              \u25B2 Higher${hi ? ` \u00b7 ${hi.toFixed(2)}\u00d7` : " \u00b7 impossible"}
            </button>
            <button class="shop-btn equip" data-call="lower" ${lo ? "" : "disabled"}>
              \u25BC Lower${lo ? ` \u00b7 ${lo.toFixed(2)}\u00d7` : " \u00b7 impossible"}
            </button>
          </div>
          <p class="settings-hint">A tie loses. Both calls return ${Math.round(RTP * 100)}% long-run,
          whatever card is showing.</p>`
        : `
          <div class="crash-controls">
            <label class="crash-stake">
              <span>Stake</span>
              <input id="hilo-stake" class="modal-input admin-input" type="number"
                     min="1" max="${api.MAX_STAKE}" step="1" value="5" />
            </label>
            <button id="hilo-deal" class="btn-primary">Deal</button>
          </div>
          <p class="settings-hint">
            1 ticket, ${Dojo.Games.ENERGY_PER_ROUND} energy and a little upkeep per deal.
            Max stake $${api.MAX_STAKE}. A tie loses; long-run return is ${Math.round(RTP * 100)}%.
          </p>`}`;

      panel.querySelector(".table-close").addEventListener("click", () => api.renderGames("games"));

      const deal = panel.querySelector("#hilo-deal");
      if (deal) deal.addEventListener("click", startRound);

      panel.querySelectorAll("[data-call]").forEach(b =>
        b.addEventListener("click", () => call(b.getAttribute("data-call"))));
    }

    function startRound() {
      const stake = Math.floor(Number(panel.querySelector("#hilo-stake").value) || 0);
      round = api.beginRound(stake, api.gameId);
      if (!round) {
        base = null;
        paint({ message: Dojo.LifeShop && Dojo.LifeShop.isWeak()
          ? Dojo.LifeShop.weakReason() + "."
          : DB.getTickets() < 1 ? "No tickets left \u2014 seven come back every six hours."
          : DB.getWallet() < stake ? "Not enough money for that stake."
          : `Stake must be between $1 and $${api.MAX_STAKE}.`, phase: "lost" });
        return;
      }
      base = { rank: drawRank(), suit: drawSuit() };
      if (Dojo.renderVitals) Dojo.renderVitals();
      paint({ message: `Showing ${RANK_NAME[base.rank]}. Higher or lower?`, phase: "calling" });
    }

    function call(dir) {
      if (!round || !base) return;
      const next = { rank: drawRank(), suit: drawSuit() };
      const won = dir === "higher" ? next.rank > base.rank : next.rank < base.rank;
      const tie = next.rank === base.rank;
      const mult = payoutFor(base.rank, dir);
      const payout = won ? Math.floor(round.stake * mult) : 0;

      api.settle(round, payout, { game: "hilo", dir, base: base.rank, next: next.rank });
      const staked = round.stake;
      round = null;

      paint({
        next,
        phase: won ? "won" : "lost",
        message: won
          ? `${RANK_NAME[next.rank]} \u2014 right. $${payout} back on $${staked}.`
          : tie
            ? `${RANK_NAME[next.rank]} \u2014 a tie, and a tie loses.`
            : `${RANK_NAME[next.rank]} \u2014 wrong. $${staked} gone.`
      });
      base = null;
      if (Dojo.renderVitals) Dojo.renderVitals();
    }

    paint();
  }

  Dojo.Games.register({
    id: "hilo",
    name: "Hi-Lo",
    tagline: "Higher or lower than the card shown",
    icon: "\u{1F0CF}",
    mount
  });

  Dojo.HiLo = { payoutFor, winCount, RTP, RANKS };
})();

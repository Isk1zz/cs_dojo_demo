# shop/ — the sink

Two shops, two currencies, deliberately separate.

| File | Role |
|---|---|
| `themes.js` | Pure data: free `THEMES` + `PREMIUM_THEMES`. No DOM, no DB. |
| `shop.js` | The charge shop — premium themes. **Built.** |
| `life.js` | The money shop — vitals model, decay, goods, the vitals strip. **Built.** |

Stylesheet: `styles/shop.css`.

## The currency rule
| | earned by | buys |
|---|---|---|
| ⚡ charge | studying | cosmetic themes only |
| $ money | Garden, Arcade | food, hygiene, shelter, story unlocks |

**Neither converts to the other.** Nothing in either shop may buy progress,
hints, retries or exam advantage.

## Premium themes
Same fields as a free theme, plus `price`, `tagline` and `bg` — a fixed
background layer, which is what actually makes one feel different from a
recoloured default rather than an accent swap.

| Theme | Price |
|---|---|
| Sakura Midnight | 90 |
| Sumi Ink | 110 |
| Amber Terminal | 120 |
| Koi Pond | 150 |
| Neon Ronin | 180 |
| Fuji Dawn | 220 |

870 total against roughly 900–1,000 charge earnable in one 26-topic course —
so you can afford most of a set, not all of it. `CHARGE_CAP` is 400 and must
stay ≥ the dearest item.

Adding a theme is one entry in `themes.js`. The shop card paints itself in the
theme it sells, so no preview image is needed.

## Two shops, two screens

The split is by **coin**, not by folder:

- **Shop screen** — charge only. Premium themes. `shop/shop.js`.
- **Story tab of the Arcade** — money only. Vitals, food, hygiene, shelter,
  papers. `shop/life.js` renders there as a guest.

Staying alive and getting off the street are the same coin and the same
fiction, so they share one surface: your state and what you can buy sit
directly above the map they are for. `renderLifeTab(body)` draws into whatever
container it is handed and never calls `showScreen` — the Arcade owns that
screen.

## Vitals and decay (`life.js`)

**Decay is per activity, not per clock.** This is the decision to protect.

A real-time drain would mean coming back from a week away to a starving
character — the app would punish taking days off, which is exactly what
spacing is for and exactly why PROJECT.md §5 rejected streaks. Clock-based
vitals are a streak wearing a different hat.

| Trigger | thirst / hunger / hygiene |
|---|---|
| lesson chunk | −3 / −2 / −1 |
| mastery exam | −5 / −4 / −2 |
| arcade round | −2 / −2 / −2 |
| story scene | −8 / −8 / −6 |
| one tick per **day opened** | −10 / −8 / −5, × shelter multiplier |

Two weeks away costs one tick, not fourteen. Being away is free; playing costs.

Shelter multipliers: street ×1.0, hostel ×0.7, car ×0.55, apartment ×0.35 —
climbing out is what makes upkeep cheaper.

### Night theft — the economy's sink

On the daily tick there is a chance somebody goes through your pockets
overnight and takes a **percentage** of your cash.

| Sleeping | Chance | Taken |
|---|---|---|
| Street | 1 in 3 | 20–50% |
| Hostel | 1 in 12 | 10–25% |
| Car | 1 in 20 | 10–20% |
| Apartment | never | — |

This is the main reason shelter is worth buying, and the main reason money
doesn't run away. Without it the wallet only ever goes up: the Garden pays
every day forever while upkeep is a few dollars, so a long-term player ends
up with a number that means nothing.

**It's a percentage, not a flat amount,** so it keeps biting at any wealth
level — losing $40 of $80 and $4,000 of $8,000 hurt the same.

Like decay, it only fires on the daily tick, only for a day you actually
opened the app. Being away is still free. The result is reported once via
`LifeShop.lastNight()` and shown as a banner on the Story tab.

### Consequences of running empty (≤15 on any vital)
- Arcade closed, story scenes closed.
- **The Library is never gated.** You can always study, whatever state you're
  in. If a future change makes low vitals block a lesson, that change is wrong.

### Prices
At the intended pace (~10 chunks plus a daily tick) upkeep runs about $9/day.
A three-plant Garden pays $9/day; a full one pays $78. Early play is tight and
later play is comfortable — deliberately.

`buy(id)` is the only path that may touch the wallet or vitals from a
purchase. Other branches call `LifeShop.cost(kind)`, never `DB.patchVitals`.

## Exports
`THEMES`, `PREMIUM_THEMES`, `ALL_THEMES`, `isPremium`, `renderShop`,
`shopSummary`, `Dojo.LifeShop = { LIFE_ITEMS, item, buy }`

## Emits
`wallet:changed`, `vitals:changed`

## Not done
- Garden decorations and quote packs (stubbed as "coming later").
- Inventory is written but never shown — consumables apply instantly on
  purchase rather than being carried. If they should be carried and used
  later, that is a screen plus a `use(id)` alongside `buy(id)`.
- `id_card` and `licence` have no effect yet; they exist for story nodes to
  require once the narrative lands.

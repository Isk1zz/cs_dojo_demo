# settings/ — preferences, data, legal

Stylesheet: `styles/settings.css`.

## Sections
1. **Colour theme** — free themes, always available.
2. **Premium themes** — only the ones this profile owns, plus a link to the
   Shop. Ownership lives in `db.js`; the catalogue lives in `shop/themes.js`.
   This file owns neither.
3. **Codes** — every cheat lives in one `CODES` table in `settings.js` and
   nowhere else, so there is a single place to strip them for a public build.

   | Code | Effect |
   |---|---|
   | `admin613` | Marks every topic complete |
   | `parnasa100` | +$100 to the wallet |

   `admin613` deliberately does not touch reviews, stats or the wallet, so a
   cheated profile still looks cheated in Stats.
4. **Your data** — export/import. Progress is localStorage only.
5. **Legal** — Terms of Service and Privacy Policy, both **placeholder text**.

## Exports
`renderSettings`

## Emits
`progress:changed` (after an admin unlock)

## Legal — needs a real decision
The placeholders must be filled before any public or paid release, and the
Privacy Policy is the easy one: nothing leaves the browser, there is no
account, no server, no analytics. Say exactly that.

The hard one is content licensing, which is unresolved — see PROJECT.md §10.
Short version: facts aren't copyrightable, particular expression is; the
course textbooks are all-rights-reserved and one is CC BY-NC-ND
(non-commercial, no derivatives). New content teaches concepts, cites
authoritative or public-domain sources, and writes its own analogies. The repo
still has no LICENSE file.

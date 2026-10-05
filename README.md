# ow.ojee.net — Overwatch 2 rank + aim trackers

Two trackers for one group of friends: **who you can queue with**, and
**how everyone's aim is coming along**.

Live at <https://ow.ojee.net>.

## What it does

**Ranks** (`/`)

- Tracks any number of accounts and shows their rank in **tank, damage, support and open queue**.
- Click any player to make them the *anchor*; every other card then shows, per role, whether
  grouping with them is a normal (**narrow**) group or a **wide** group, and by how many skill
  divisions.
- Build a group of up to 5 and get a per-role verdict for the whole party.
- Records rank changes over time, so you can see who moved and when.
- Card view for detail, table view for scanning a lot of people quickly.
- PC / console toggle.

**Aim** (`/aim.html`)

- Score entry for the Practice Range drills (unlimited ammo): drill → hero → score,
  with completion tracking for every drill/hero combination.
- Leaderboard (best + average, distribution chart), per-player stats (personal bests,
  per-drill and per-hero breakdowns, score cluster), head-to-head compare (radar +
  win counts), and a full history with inline edit/delete.
- Every person carries a **main account**, any number of **alt accounts**, and the
  **characters** they train — set once, and it is there on every device.

## How it works

Static site, no build step. The browser talks to two services:

- [OverFast API](https://overfast-api.tekrop.fr) for Blizzard career profiles
  (CORS-open), which is what keeps the rank cards live.
- **server.ojee.net** — the shared backend (MongoDB) both trackers sync through.
  The aim roster, accounts, characters and scores live there, and so do the rank
  tracker's accounts, cached profiles and rank history. Same data for everyone,
  on every device. localStorage keeps a copy so the pages still open (marked
  offline) when the API cannot be reached.

GitHub Pages serves the files; there is no build step.

Account ownership is written by the aim tracker and enforced by the backend:
a person's declared main and alt tags always appear in the rank list, tagged to
them (**MAIN** / **ALT** chips on the card), and a stale client can neither drop
nor invent an owner.

## Constraints worth knowing

| Limit | Why |
| --- | --- |
| A profile must be set to **public** in Overwatch 2 (Options → Social → Career Profile) | Ranks are read from the public career page. Private profiles 404 and are flagged as such. |
| No placement progress ("3/10") and no predicted rank | Blizzard's public profile never exposes them; they exist only in-client. |
| Ranks are not live | Blizzard's own profile data updates on a delay. Each profile reports the season its ranks belong to, so a friend who hasn't placed this season is flagged rather than shown as current. |
| Adding by name needs disambiguation | Blizzard's search doesn't return the digits after the `#`, so the picker shows avatar, title and ranks to identify the right person. Adding by full BattleTag skips this. |
| A person's account must be a full BattleTag (`Name#1234`) | Only a complete tag can be looked up directly; a bare name cannot be pinned to one account. |

## Grouping rules

From Blizzard's [wide group system](https://overwatch.blizzard.com/en-us/news/23973730/competitive-play-update-teaming-up-for-better-matches/)
(season 10 onward). A "skill division" is one step on the flat Bronze 5 → Champion 1 ladder
(9 divisions × 5 tiers = 45 steps).

| Group contains | Narrow up to | Beyond that |
| --- | --- | --- |
| Diamond and below | 5 skill divisions | wide group |
| A Master | 3 skill divisions | wide group |
| A Grandmaster or Champion | — | always wide, and capped at 2 players |

Wide groups still queue; they only face other wide groups, wait longer, and earn reduced rank
progress. Blizzard adjusts these between seasons — the thresholds live in one object,
`RULES` in [`js/ranks.js`](js/ranks.js), so a change is a one-line edit.

## Layout

```
index.html      rank tracker markup and copy
aim.html        aim tracker markup and copy
css/styles.css  shared system: tokens, backdrop, panels, both pages
css/aim.css     aim-tracker components (roster, drills, charts, modal)
js/ranks.js     ladder math + grouping rules   (pure, unit-testable)
js/api.js       OverFast client, id resolution, concurrency pool
js/store.js     shared rank state: server sync + localStorage fallback
js/app.js       rank tracker rendering and events
js/aim.js       aim tracker rendering and events
js/aim-data.js  heroes, drills, helpers
js/aim-api.js   backend client (server.ojee.net)
js/aim-charts.js five charts, drawn as SVG — no chart library
js/icons.js     Material Symbols paths, inlined
test/           unit tests for the ladder + grouping rules
```

The backend itself lives in the **ojee.net** repo (`ojee/server`) and is deployed
as the `ojee-server` service on the disinteg box.

## Development

```sh
python3 -m http.server 8791 --bind 127.0.0.1   # serve
node test/ranks.test.mjs                       # check the grouping rules
```

No dependencies, no build. The grouping rules are the one part that can be wrong
*silently* — a bad verdict still looks like a confident answer — so they have a test.
Deployment is a push to `main`; GitHub Pages serves the repo root.

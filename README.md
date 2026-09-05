# ow.ojee.net — Overwatch 2 Rank Tracker

Track a group of Overwatch 2 accounts and see, at a glance, **who you can queue with**.

Live at <https://ow.ojee.net>.

## What it does

- Tracks any number of accounts and shows their rank in **tank, damage, support and open queue**.
- Click any player to make them the *anchor*; every other card then shows, per role, whether
  grouping with them is a normal (**narrow**) group or a **wide** group, and by how many skill
  divisions.
- Build a group of up to 5 and get a per-role verdict for the whole party.
- Records rank changes over time, so you can see who moved and when.
- Card view for detail, table view for scanning a lot of people quickly.
- PC / console toggle.

## How it works

Static site, no backend. The browser talks directly to the
[OverFast API](https://overfast-api.tekrop.fr), which scrapes public Blizzard career
profiles and serves CORS-open JSON. GitHub Pages serves the files; there is no build step.

The tracked list lives in `localStorage`, per device. **Data → Export/Import** moves it
between devices — it accepts an exported JSON blob or just a list of BattleTags, one per line.

## Constraints worth knowing

| Limit | Why |
| --- | --- |
| A profile must be set to **public** in Overwatch 2 (Options → Social → Career Profile) | Ranks are read from the public career page. Private profiles 404 and are flagged as such. |
| No placement progress ("3/10") and no predicted rank | Blizzard's public profile never exposes them; they exist only in-client. |
| Ranks are not live | Blizzard's own profile data updates on a delay. Each profile reports the season its ranks belong to, so a friend who hasn't placed this season is flagged rather than shown as current. |
| Adding by name needs disambiguation | Blizzard's search doesn't return the digits after the `#`, so the picker shows avatar, title and ranks to identify the right person. Adding by full BattleTag skips this. |

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
index.html      markup and copy
css/styles.css  Overwatch-flavoured theme, shared with ojee.net/ow
js/ranks.js     ladder math + grouping rules   (pure, unit-testable)
js/api.js       OverFast client, id resolution, concurrency pool
js/store.js     localStorage, rank history, import/export
js/app.js       rendering and events
js/bg.js        animated plus-grid backdrop
```

## Development

```sh
python3 -m http.server 8791 --bind 127.0.0.1
```

No dependencies, no build. Deployment is a push to `main`; GitHub Pages serves the repo root.

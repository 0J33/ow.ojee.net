# DESIGN.md — ow.ojee.net

The durable record of the surface this repo ships: one Overwatch-flavoured
Operate world shared by the rank tracker (`/rank/`) and the aim tracker (`/aim/`). Written from the built code after the 2026-10 overhaul, not
from intention.

## The world

The site speaks Overwatch 2's own HUD language — condensed display caps,
warm amber on deep navy, chamfered panels, rank emblems stacked over tier
numbers. It deliberately refuses the generic near-black-plus-neon dashboard:
depth comes from bevels and neutral elevation shadows, and the only saturated
colour is the site amber, used as the single accent everywhere.

**Backdrop.** A CSS "range", fixed to the viewport, layered in this order:
a fine grain (inline SVG turbulence), a 46px amber lattice (horizontal +
vertical), a warm stage light from the top edge, a cool blue bounce from the
bottom-left, and a vignette. It replaced the animated canvas plus-grid: same
motif, zero runtime cost, no battery draw, no rAF loop.

**Type.** Self-hosted `fonts/Teko` (500/700) for display, controls, numerals;
self-hosted `fonts/Rajdhani` (400–700) for body. Titles are Teko 700, tracked,
uppercased, in `#FFF6E9` with an amber text glow (the world's signature —
carried from the page this replaced). Subtitles are tracked caps at 0.9rem.

**Colour tokens** (`css/styles.css :root`):

| Token | Value | Role |
| --- | --- | --- |
| `--ow-orange` / `--ow-orange-hot` | `#F99E1A` / `#F06414` | the accent: primary actions, active states, links |
| `--ow-bg` | `#05070f` | page ground |
| `--ow-panel` / `--ow-panel-solid` | `rgba(13,18,32,.84)` / `#111624` | panels, dialogs |
| `--ow-panel-border` | `rgba(249,158,26,.16)` | panel edges |
| `--ow-text` / `--ow-text-dim` / `--ow-text-mute` | `#E6ECF5` / `#9DAEC6` / `#7C8DA6` | text ladder; every step clears 4.5:1 on panel grounds |
| `--ow-green` / `--ow-yellow` / `--ow-red` | `#22C55E` / `#EAB308` / `#EF4444` | verdicts and deltas only |

**Shape.** Three chamfer clip-paths (`--bevel-sm/md/lg`) on panels, buttons,
chips, modals; disabled on ≤768px where the cut costs more than it says.

**Icons.** Material Symbols Outlined, inlined as path data from
`js/icons.js` (one pack, one weight, `currentColor`). No emoji, no unicode
stand-ins — the medals on the leaderboard are drawn SVG for the same reason.

**Motion.** One authored moment: the header powers on (bar settles, title
locks in from blur) once per page. Everything else is a 150–200ms state
transition; content swaps settle with a single short pane animation. Reduced
motion disables all of it.

**Accessibility floor.** Focus rings are drawn *inside* the box
(`outline-offset:-4px`) because these controls are clip-pathed; amber-filled
controls get a dark ring instead. Player colours are mixed toward white until
they clear WCAG 4.5:1 (see `getReadableColor`). Dialogs trap Tab, take focus
on open, and return it on close. Tables and charts carry text alternatives or
adjacent labels.

## Shared components

- `.siteBar` — the tool switcher both pages share (mark · Ranks/Aim · back to ojee.net).
- `.panel` — the one container; content panels, toolbar, roster all use it.
- `.btn` / `.segment` / `.select` / `.input` — one control family, bevelled.
- `.modal*` — dialogs with sticky actions so Save stays reachable when the
  content is taller than the viewport.
- Toasts are the only live region; `#content` is not.

## Disclosed detector decisions (impeccable detect, accepted at review)

1–4. **Header title glow** (two text-shadow layers × two pages): the world's
signature, carried verbatim from the page the rank tracker replaced; the
glyphs sit at ~17:1 regardless.
5–6. **Tracked-caps subtitles** (36/41 chars): the incumbent title-block
treatment; one line at 1440, clean centred wrap at 390.
7–8. **Repeating-gradient lattice** (horizontal + vertical): this is the
range texture that *replaced* the old canvas backdrop — the pair is one
grid; dropping either leaves stripes.

Everything else the detector flagged was fixed: amber elevation glows are
neutral now, and the drill progress bar animates `transform: scaleX`.

## Review

Finish review ran on live screenshots (desktop 1440, mobile 390, both pages +
the person editor). First pass returned **fix**; the material list —
nested-interactive card controls, clipped focus rings, person-editor focus
and reachability, focus lost across renders, player-colour contrast, and this
file plus raster provenance — was applied before the verdict pass. Raster
origins live in `res/PROVENANCE.md`.

/* ═══════════════════════════════════════════════════════════════════════════
   AIM TRACKER — charts, drawn as SVG
   The React build used recharts; this site has no build step and no
   dependencies, so the five charts are drawn by hand. Each function returns
   an HTML string — same rendering model as the rest of the page.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  HEROES, DRILLS, DRILL_CATEGORIES, CATEGORY_COLORS, getReadableColor, esc,
} from './aim-data.js';

const AXIS = 'var(--ow-text-dim)';
const GRID = 'rgba(249,158,26,.12)';
const FONT = 'Rajdhani, sans-serif';

const tip = (text) => `<title>${esc(text)}</title>`;

/** 0..max with about `count` readable steps. */
function yTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE CLUSTER — one dot per entry, grouped by drill category
   ═══════════════════════════════════════════════════════════════════════════ */
export function scoreClusterChart(playerScores) {
  if (!playerScores || playerScores.length < 1) return '';

  const played = new Set(playerScores.map((s) => `${s.drill}__${s.hero}`));

  const categories = [];
  const catOf = {};
  DRILL_CATEGORIES.forEach((cat) => {
    Object.entries(DRILLS).forEach(([drillKey, drill]) => {
      if (drill.category !== cat.key) return;
      drill.heroes.forEach((heroKey) => {
        const combo = `${drillKey}__${heroKey}`;
        if (!played.has(combo)) return;
        catOf[categories.length] = cat.key;
        categories.push({
          key: combo,
          heroName: HEROES[heroKey]?.name || heroKey,
          drillName: drill.name,
        });
      });
    });
  });
  if (!categories.length) return '';

  const idx = {};
  categories.forEach((c, i) => { idx[c.key] = i; });

  const points = playerScores
    .filter((s) => idx[`${s.drill}__${s.hero}`] !== undefined)
    .map((s) => ({
      i: idx[`${s.drill}__${s.hero}`],
      score: s.score,
      hero: HEROES[s.hero]?.name || s.hero,
      drill: DRILLS[s.drill]?.name || s.drill,
      cat: catOf[idx[`${s.drill}__${s.hero}`]],
    }));
  if (!points.length) return '';

  const pad = { t: 16, r: 18, b: 74, l: 46 };
  const step = 58;
  const w = Math.max(categories.length * step + pad.l + pad.r, 380);
  const h = 300;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(...points.map((p) => p.score));
  const ticks = yTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i) => pad.l + ((i + 0.5) / categories.length) * iw;
  const y = (v) => pad.t + ih - (v / top) * ih;

  const usedCats = [...new Set(Object.values(catOf))];

  return `
  <div class="chartWrap">
    <div class="chartScroll" tabindex="0" role="group" aria-label="Chart, scrolls sideways">
      <div style="min-width:${w}px">
        <svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img"
             aria-label="Every score entry grouped by drill, one dot each">
          ${ticks.map((t) => `
            <line x1="${pad.l}" x2="${w - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" />
            <text class="axis" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
          <line x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="rgba(148,163,184,.35)" />
          ${categories.map((c, i) => `
            <text class="axis tick" x="${x(i)}" y="${pad.t + ih + 16}" text-anchor="end"
                  transform="rotate(-45 ${x(i)} ${pad.t + ih + 16})">${esc(c.heroName)}</text>`).join('')}
          ${points.map((p) => `
            <circle cx="${x(p.i)}" cy="${y(p.score)}" r="6.5"
                    fill="${CATEGORY_COLORS[p.cat] || '#F99E1A'}" fill-opacity=".88"
                    stroke="rgba(0,0,0,.55)" stroke-width="1.2">
              ${tip(`${p.drill} · ${p.hero}: ${p.score}`)}
            </circle>`).join('')}
        </svg>
      </div>
    </div>
    <div class="chartLegend">
      ${usedCats.map((k) => {
        const cat = DRILL_CATEGORIES.find((c) => c.key === k);
        return `<span class="legendItem"><i style="background:${CATEGORY_COLORS[k]}"></i>${esc(cat?.label || k)}</span>`;
      }).join('')}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HORIZONTAL BREAKDOWN — best + average per drill, or per hero
   ═══════════════════════════════════════════════════════════════════════════ */
function breakdownChart(rows, { color, title }) {
  if (!rows || !rows.length) return '';

  const labelW = 168;
  const pad = { t: 10, r: 56, b: 26, l: labelW };
  const rowH = 44;
  const w = 720;
  const h = pad.t + rows.length * rowH + pad.b;
  const iw = w - pad.l - pad.r;
  const max = Math.max(...rows.flatMap((r) => [r.best, r.avg]));
  const top = Math.max(yTicks(max).pop(), 1);
  const bw = (v) => (v / top) * iw;

  return `
  <div class="chartWrap">
    <div class="chartScroll" tabindex="0" role="group" aria-label="Chart, scrolls sideways">
      <div style="min-width:${w}px">
        <svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${esc(title)}">
          ${rows.map((r, i) => {
            const yTop = pad.t + i * rowH;
            const bY = yTop + 8;
            return `
              <text class="axis rowLabel" x="${pad.l - 12}" y="${bY + 15}" text-anchor="end">${esc(r.name)}</text>
              <rect x="${pad.l}" y="${bY}" width="${bw(r.best)}" height="14" rx="3"
                    fill="${color}">${tip(`${r.name} — best ${r.best}`)}</rect>
              <text class="val" x="${pad.l + bw(r.best) + 7}" y="${bY + 12}" fill="${color}">${r.best}</text>
              <rect x="${pad.l}" y="${bY + 17}" width="${bw(r.avg)}" height="10" rx="3"
                    fill="${color}" fill-opacity=".35">${tip(`${r.name} — average ${r.avg}`)}</rect>
              <text class="val dim" x="${pad.l + bw(r.avg) + 7}" y="${bY + 26}">${r.avg}</text>
            `;
          }).join('')}
          <line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${h - pad.b + 4}" stroke="rgba(148,163,184,.3)" />
        </svg>
      </div>
    </div>
    <div class="chartLegend">
      <span class="legendItem"><i style="background:${color}"></i>Best</span>
      <span class="legendItem"><i style="background:${color};opacity:.35"></i>Average</span>
    </div>
  </div>`;
}

export const drillBreakdownChart = (rows) =>
  breakdownChart(rows, { color: '#F99E1A', title: 'Best and average score per drill' });

export const heroBreakdownChart = (rows) =>
  breakdownChart(rows, { color: '#22C55E', title: 'Best and average score per hero' });

/* ═══════════════════════════════════════════════════════════════════════════
   RADAR — skill profile, one polygon per player, axes = drills
   ═══════════════════════════════════════════════════════════════════════════ */
export function compareRadarChart(comparisonRows, selectedIds, players) {
  if (!comparisonRows?.length || selectedIds.length < 2) return '';

  const drillBests = {};
  comparisonRows.forEach((row) => {
    if (!drillBests[row.drill]) drillBests[row.drill] = {};
    selectedIds.forEach((id) => {
      const v = row.players[id];
      if (v !== undefined && (!drillBests[row.drill][id] || v > drillBests[row.drill][id])) {
        drillBests[row.drill][id] = v;
      }
    });
  });

  const drills = Object.keys(drillBests);
  if (drills.length < 3) return '';

  const drillMax = {};
  drills.forEach((d) => { drillMax[d] = Math.max(...Object.values(drillBests[d]), 1); });

  const size = 420;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 132;
  const n = drills.length;
  const angle = (i) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i, radius) => `${(cx + Math.cos(angle(i)) * radius).toFixed(1)},${(cy + Math.sin(angle(i)) * radius).toFixed(1)}`;

  const series = selectedIds.map((id) => {
    const player = players.find((p) => p.id === id);
    const color = getReadableColor(player?.color || '#F99E1A');
    const points = drills.map((d, i) => {
      const norm = ((drillBests[d]?.[id] || 0) / drillMax[d]) * 100;
      return pt(i, (norm / 100) * R);
    }).join(' ');
    return { id, name: player?.name || id, color, points };
  });

  const rings = [0.25, 0.5, 0.75, 1];

  return `
  <div class="chartWrap">
    <svg class="chart" viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;height:auto"
         role="img" aria-label="Skill profile across drills">
      ${rings.map((f) => `
        <polygon points="${drills.map((_, i) => pt(i, R * f)).join(' ')}"
                 fill="none" stroke="${GRID}" />`).join('')}
      ${drills.map((d, i) => `
        <line x1="${cx}" y1="${cy}" x2="${pt(i, R).split(',')[0]}" y2="${pt(i, R).split(',')[1]}"
              stroke="${GRID}" />
        <text class="axis" x="${(cx + Math.cos(angle(i)) * (R + 26)).toFixed(1)}"
              y="${(cy + Math.sin(angle(i)) * (R + 26) + 4).toFixed(1)}"
              text-anchor="${Math.abs(Math.cos(angle(i))) < 0.3 ? 'middle' : (Math.cos(angle(i)) > 0 ? 'start' : 'end')}">
          ${esc((DRILLS[d]?.name || d).split(' / ').slice(0, 2).join(' '))}
        </text>`).join('')}
      ${series.map((s) => `
        <polygon points="${s.points}" fill="${s.color}" fill-opacity=".14"
                 stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round">
          ${tip(s.name)}
        </polygon>`).join('')}
      ${series.map((s) => `
        ${drills.map((d, i) => {
          const norm = ((drillBests[d]?.[s.id] || 0) / drillMax[d]) * R;
          return `<circle cx="${pt(i, norm).split(',')[0]}" cy="${pt(i, norm).split(',')[1]}" r="3.4"
                          fill="${s.color}">${tip(`${s.name} · ${DRILLS[d]?.name || d}: ${drillBests[d]?.[s.id] ?? 0}`)}</circle>`;
        }).join('')}`).join('')}
    </svg>
    <div class="chartLegend">
      ${series.map((s) => `<span class="legendItem"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEADERBOARD DISTRIBUTION — best and average, one pair per player
   ═══════════════════════════════════════════════════════════════════════════ */
export function leaderboardDistribution(rankings, players) {
  if (!rankings || rankings.length < 2) return '';

  const data = rankings.map((r) => {
    const player = players.find((p) => p.id === r.playerId);
    return {
      name: player?.name || 'Unknown',
      score: r.score,
      avg: r.avg,
      color: getReadableColor(player?.color || '#F99E1A'),
    };
  });

  const pad = { t: 18, r: 14, b: 42, l: 44 };
  const slot = 76;
  const w = Math.max(data.length * slot + pad.l + pad.r, 360);
  const h = 230;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.score));
  const ticks = yTicks(max);
  const top = ticks[ticks.length - 1];
  const y = (v) => pad.t + ih - (v / top) * ih;
  const slotW = iw / data.length;
  const barW = Math.min(30, slotW * 0.34);

  return `
  <div class="chartWrap">
    <div class="chartScroll" tabindex="0" role="group" aria-label="Chart, scrolls sideways">
      <div style="min-width:${w}px">
        <svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img"
             aria-label="Best and average score per player">
          ${ticks.map((t) => `
            <line x1="${pad.l}" x2="${w - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" />
            <text class="axis" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
          <line x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="rgba(148,163,184,.35)" />
          ${data.map((d, i) => {
            const c = pad.l + slotW * i + slotW / 2;
            return `
              <rect x="${c - barW - 2}" y="${y(d.score)}" width="${barW}" height="${pad.t + ih - y(d.score)}"
                    rx="3" fill="${d.color}">${tip(`${d.name} — best ${d.score}`)}</rect>
              <rect x="${c + 2}" y="${y(d.avg)}" width="${barW}" height="${pad.t + ih - y(d.avg)}"
                    rx="3" fill="${d.color}" fill-opacity=".38">${tip(`${d.name} — average ${d.avg}`)}</rect>
              <text class="axis tick" x="${c}" y="${pad.t + ih + 18}" text-anchor="middle">${esc(d.name)}</text>
            `;
          }).join('')}
        </svg>
      </div>
    </div>
    <div class="chartLegend">
      <span class="legendItem"><i style="background:#94A3B8"></i>Best</span>
      <span class="legendItem"><i style="background:#94A3B8;opacity:.38"></i>Average</span>
    </div>
  </div>`;
}

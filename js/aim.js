/* ═══════════════════════════════════════════════════════════════════════════
   AIM TRACKER — ow.ojee.net/aim.html
   The whole of ojee.net/ow, ported off React and recharts: same features,
   same drill list, same leaderboard maths — no build step, no dependencies.

   The roster is shared through server.ojee.net: every person carries a main
   account, their alt accounts and the characters they train, and all of it is
   the same on every device for everyone.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  HEROES, ROLES, DRILLS, DRILL_CATEGORIES, PRESET_COLORS,
  generateId, getHeroesByRole, getReadableColor, getColorShadow,
  formatDateTime, normalizeAccountId, displayAccountId, isFullAccountTag, esc,
} from './aim-data.js';
import { owApi, exportData, parseImportFile } from './aim-api.js';
import {
  scoreClusterChart, drillBreakdownChart, heroBreakdownChart,
  compareRadarChart, leaderboardDistribution,
} from './aim-charts.js';
import { icon } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const el = {
  content: $('#content'), rosterRow: $('#rosterRow'), rosterHint: $('#rosterHint'),
  tabNav: $('#tabNav'), toasts: $('#toasts'),
  modal: $('#modal'), modalContent: $('#modalContent'),
  exportBtn: $('#exportBtn'), importBtn: $('#importBtn'), importFile: $('#importFile'),
};

const PREFS_KEY = 'ow.aim:prefs';

/* ─── State ──────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'entry', label: 'Score Entry', ico: 'play' },
  { key: 'leaderboard', label: 'Leaderboard', ico: 'trophy' },
  { key: 'stats', label: 'Stats', ico: 'chart' },
  { key: 'compare', label: 'Compare', ico: 'compare' },
  { key: 'history', label: 'History', ico: 'doc' },
];

const prefs = (() => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }
  catch { return {}; }
})();
const savePrefs = () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      tab: ui.tab, activePlayerId: ui.activePlayerId,
    }));
  } catch { /* private mode */ }
};

const ui = {
  tab: TABS.some((t) => t.key === prefs.tab) ? prefs.tab : 'entry',
  activePlayerId: prefs.activePlayerId || null,
  offline: false,
  loading: true,
  // entry tab
  entry: { drill: null, hero: null, accountId: null, score: '' },
  // leaderboard tab
  lb: { drill: 'all', hero: 'all', sort: 'best' },
  // stats tab
  stats: { playerId: null },
  // compare tab
  compare: { ids: [], drill: 'all' },
  // history tab
  hist: { player: 'all', drill: 'all', hero: 'all', editing: null, editValue: '', confirmDelete: null },
};

let data = { players: [], scores: [] };

const playerById = (id) => data.players.find((p) => p.id === id);
const activePlayer = () => playerById(ui.activePlayerId);
const accountsOf = (p) => {
  if (!p) return [];
  const out = [];
  if (p.mainAccount) out.push({ id: p.mainAccount, kind: 'main' });
  (p.altAccounts || []).forEach((a) => { if (a) out.push({ id: a, kind: 'alt' }); });
  return out;
};

/* ─── Toast + modal plumbing ─────────────────────────────────────────────── */

function toast(message, kind = 'ok', ms = 2800) {
  const node = document.createElement('div');
  node.className = `toast ${kind === 'ok' ? '' : kind}`.trim();
  node.textContent = message;
  el.toasts.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 320);
  }, ms);
}

let modalTrigger = null;
function openModal(html, { wide = false, focus = true } = {}) {
  if (el.modal.hidden) modalTrigger = document.activeElement;
  el.modalContent.className = `modalContent${wide ? ' wide' : ''}`;
  el.modalContent.innerHTML = html;
  el.modal.hidden = false;
  if (focus) el.modalContent.querySelector('input,button,textarea,select')?.focus();
}

function closeModal() {
  if (el.modal.hidden) return;
  el.modal.dispatchEvent(new Event('modalclose'));
  el.modal.hidden = true;
  el.modalContent.innerHTML = '';
  if (modalTrigger && document.contains(modalTrigger)) {
    modalTrigger.focus({ preventScroll: true });
  }
  modalTrigger = null;
}

/* Keep Tab inside an open dialog — aria-modal promises it, so keep it. */
function trapTab(e) {
  const nodes = [...el.modalContent.querySelectorAll(
    'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const inside = el.modalContent.contains(document.activeElement);
  if (!inside) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal || e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab' && !el.modal.hidden) trapTab(e);
});

/* ─── Medals (drawn, never emoji) ────────────────────────────────────────── */

const MEDAL_COLORS = {
  1: { face: '#F5C542', edge: '#9A7412', ribbon: '#C0392B', ink: '#3A2B00' },
  2: { face: '#C9D3DF', edge: '#7E8B9B', ribbon: '#2F5D8A', ink: '#2A3138' },
  3: { face: '#D9915B', edge: '#8C5A33', ribbon: '#2E7D52', ink: '#3A2313' },
};

function medal(rank) {
  if (rank > 3 || !MEDAL_COLORS[rank]) return `<span class="medalNone">${rank}</span>`;
  const c = MEDAL_COLORS[rank];
  return `<span class="medal" title="${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}">
    <svg width="30" height="34" viewBox="0 0 24 27" aria-hidden="true">
      <path d="M7.4 1.5h3.1l1.7 7H9.1z" fill="${c.ribbon}"/>
      <path d="M16.6 1.5h-3.1l-1.7 7h3.1z" fill="${c.ribbon}" opacity=".75"/>
      <circle cx="12" cy="16.5" r="7.6" fill="${c.face}" stroke="${c.edge}" stroke-width="1.4"/>
      <circle cx="12" cy="16.5" r="5.4" fill="none" stroke="${c.edge}" stroke-width=".8" opacity=".6"/>
      <text x="12" y="20.4" text-anchor="middle" font-family="Teko, sans-serif"
            font-size="10" font-weight="700" fill="${c.ink}">${rank}</text>
    </svg>
  </span>`;
}

/* ─── Small shared views ─────────────────────────────────────────────────── */

/* alt defaults to the hero's name; pass '' where the name already sits
   beside the image, so screen readers don't hear it twice. */
const heroImg = (heroKey, size, cls = '', alt = undefined) => {
  const hero = HEROES[heroKey];
  if (!hero) return '';
  const text = alt === undefined ? hero.name : alt;
  return `<img src="${hero.portrait}" alt="${esc(text)}" width="${size}" height="${size}"
    class="${cls}" loading="lazy" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover"
    onerror="this.style.visibility='hidden'" />`;
};

const emptyState = (ico, title, lines) => `
  <div class="panel emptyState">
    <div class="emptyIcon">${icon(ico, 44)}</div>
    <h2>${esc(title)}</h2>
    ${lines.map((l) => `<p>${l}</p>`).join('')}
  </div>`;

/* ─── Roster bar ─────────────────────────────────────────────────────────── */

function renderRoster() {
  const players = data.players;

  el.rosterRow.innerHTML = players.map((p) => {
    const accts = accountsOf(p).length;
    const on = ui.activePlayerId === p.id;
    return `
      <div class="personChip ${on ? 'personChipActive' : ''}"
           style="${on ? `border-color:${esc(p.color)}` : ''}">
        <button class="personChipMain" data-person="${esc(p.id)}" type="button"
                title="Train as ${esc(p.name)} — Enter selects, or double-click to edit">
          <span class="personDot" style="background:${esc(p.color)}"></span>
          ${p.favoriteHero ? heroImg(p.favoriteHero, 22) : ''}
          <b style="color:${getReadableColor(p.color)};text-shadow:${getColorShadow(p.color)}">${esc(p.name)}</b>
          ${accts ? `<span class="acctN" title="${accts} account${accts > 1 ? 's' : ''} linked">${accts}</span>` : ''}
        </button>
        <button class="editIcon" data-edit="${esc(p.id)}" type="button"
                aria-label="Edit ${esc(p.name)}: accounts and characters"
                title="Edit accounts and characters">${icon('edit', 15)}</button>
      </div>`;
  }).join('') + `
    <button class="addPersonBtn" id="addPersonBtn" type="button">${icon('personAdd', 15)} Add person</button>`;

  $('#addPersonBtn').addEventListener('click', () => openPersonModal(null));

  // Nudge, don't nag: anyone who hasn't set their accounts yet is worth one line.
  const missing = players.filter((p) => !p.mainAccount);
  if (!players.length) {
    el.rosterHint.textContent = 'no one here yet — add the people you train with';
  } else if (missing.length) {
    el.rosterHint.innerHTML = `<button class="linkish" id="nudgeBtn" type="button"
        style="background:none;border:none;color:var(--ow-orange);cursor:pointer;font:inherit;padding:0">
        ${missing.length} of ${players.length} still need${missing.length === 1 ? 's' : ''} a main account</button>`;
    $('#nudgeBtn').addEventListener('click', () => openPersonModal(missing[0]));
  } else {
    el.rosterHint.textContent = `${players.length} player${players.length > 1 ? 's' : ''} · everyone has their accounts set`;
  }
}

/** Selection changes repaint the chips in place — re-rendering them would
    destroy the node a double-click is landing on. */
function updateRosterSelection() {
  el.rosterRow.querySelectorAll('[data-person]').forEach((btn) => {
    const on = btn.dataset.person === ui.activePlayerId;
    btn.classList.toggle('personChipActive', on);
    const p = playerById(btn.dataset.person);
    btn.style.borderColor = on && p ? p.color : '';
  });
}

/* ─── Tabs ───────────────────────────────────────────────────────────────── */

function renderTabs() {
  el.tabNav.innerHTML = `<div class="tabList" role="tablist" aria-label="Views">${
    TABS.map((t) => `
    <button class="tabBtn ${ui.tab === t.key ? 'tabBtnActive' : ''}" data-tab="${t.key}" type="button"
            role="tab" aria-selected="${ui.tab === t.key}"
            id="tab-${t.key}" aria-controls="content">
      ${icon(t.ico, 16)} ${t.label}
    </button>`).join('')}</div>`;
}

el.tabNav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  ui.tab = btn.dataset.tab;
  savePrefs();
  render();
});

/* ─── SCORE ENTRY ────────────────────────────────────────────────────────── */

function completionMap(playerId) {
  const mine = data.scores.filter((s) => s.playerId === playerId);
  const done = new Set(mine.map((s) => `${s.drill}__${s.hero}`));
  const map = {};
  let totalDone = 0, totalAll = 0;
  Object.entries(DRILLS).forEach(([key, d]) => {
    const heroesDone = d.heroes.filter((h) => done.has(`${key}__${h}`)).length;
    map[key] = { done: heroesDone, total: d.heroes.length };
    totalDone += heroesDone;
    totalAll += d.heroes.length;
  });
  map._overall = { done: totalDone, total: totalAll };
  return map;
}

function renderEntry() {
  const p = activePlayer();
  if (!p) {
    return emptyState('play', 'No one selected',
      ['Pick someone from the roster above, or <b>add a person</b> to start logging scores.']);
  }

  const comp = completionMap(p.id);
  const { drill, hero } = ui.entry;
  const availableHeroes = drill ? DRILLS[drill]?.heroes || [] : [];
  const mine = new Set(p.characters || []);
  const accts = accountsOf(p);

  // Default the account to their main one.
  if (drill && ui.entry.accountId == null && accts.length) {
    ui.entry.accountId = (accts.find((a) => a.kind === 'main') || accts[0]).id;
  }

  const recentScores = data.scores
    .filter((s) => s.playerId === p.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  const drillHTML = DRILL_CATEGORIES.map((cat) => {
    const catDrills = Object.entries(DRILLS).filter(([, d]) => d.category === cat.key);
    if (!catDrills.length) return '';
    return `
      <div class="drillCategoryGroup">
        <div class="drillCategoryLabel">${esc(cat.label)}</div>
        <div class="drillGrid">
          ${catDrills.map(([key, d]) => {
            const c = comp[key] || { done: 0, total: 0 };
            const complete = c.done === c.total;
            return `
              <div class="drillCard ${drill === key ? 'drillCardActive' : ''}" data-drill="${key}" role="button" tabindex="0">
                <div class="drillCardTop">
                  <div class="drillCardName">${esc(d.name)}</div>
                  <span class="drillCompletion ${complete ? 'drillComplete' : ''}">${c.done}/${c.total}</span>
                </div>
                <div class="drillCardHeroes">${d.heroes.map((h) => heroImg(h, 24, 'drillHeroThumb')).join('')}</div>
                <div class="drillCardBottom"><div class="drillProgressBar">
                  <div class="drillProgressFill" style="transform:scaleX(${c.total ? (c.done / c.total) : 0})"></div>
                </div></div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  const heroHTML = (drill && availableHeroes.length > 1) ? `
    <div class="panel tabPane" data-scroll="hero">
      <div class="stepLabel">2. Select Hero</div>
      <div class="heroGrid">
        ${availableHeroes.map((hk) => {
          const noteRaw = DRILLS[drill]?.heroNotes?.[hk];
          const note = typeof noteRaw === 'string' ? { text: noteRaw } : noteRaw;
          const isMine = mine.has(hk);
          return `
            <div class="heroCard ${hero === hk ? 'heroCardActive' : ''} ${isMine ? 'isMine' : ''}"
                 data-hero="${hk}" role="button" tabindex="0"
                 title="${isMine ? `One of ${esc(p.name)}'s characters` : esc(HEROES[hk]?.name || hk)}">
              ${isMine ? `<span class="mineMark" title="${esc(p.name)} trains this hero">${icon('star', 11)}</span>` : ''}
              <img src="${HEROES[hk]?.portrait}" alt="" class="heroPortrait" loading="lazy" />
              <span class="heroCardName">${esc(HEROES[hk]?.name || hk)}</span>
              ${note ? `<span class="heroNote">${note.icon ? `<img src="${esc(note.icon)}" alt="" class="heroNoteIcon" loading="lazy" />` : ''}${esc(note.text)}</span>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const stepNo = availableHeroes.length > 1 ? 3 : 2;
  const scoreHTML = (drill && hero) ? `
    <div class="panel tabPane" data-scroll="score">
      <div class="stepLabel">${stepNo}. Enter Score</div>
      ${accts.length > 1 ? `
        <div class="accountRow">
          <span class="fieldLabel">Account</span>
          ${accts.map((a) => `
            <button class="accountChip ${ui.entry.accountId === a.id ? 'accountChipActive' : ''}"
                    data-account="${esc(a.id)}" type="button">
              <span class="kindTag ${a.kind}">${a.kind === 'main' ? 'MAIN' : 'ALT'}</span>
              ${esc(displayAccountId(a.id))}
            </button>`).join('')}
        </div>` : ''}
      <div class="scoreContext">
        ${heroImg(hero, 32, 'miniPortrait')}
        <div>
          <div class="scoreContextName">${esc(HEROES[hero]?.name || hero)}</div>
          <div class="scoreContextDrill">${esc(DRILLS[drill]?.name || drill)}${accts.length > 1 && ui.entry.accountId ? ` · ${esc(displayAccountId(ui.entry.accountId))}` : ''}</div>
        </div>
      </div>
      <div class="scoreInputRow">
        <input type="number" class="scoreField" id="scoreField" value="${esc(ui.entry.score)}"
               placeholder="0" min="0" inputmode="numeric" aria-label="Score" />
        <button class="submitBtn" id="submitScore" type="button" ${ui.entry.score ? '' : 'disabled'}>Submit Score</button>
      </div>
    </div>` : '';

  const recentHTML = recentScores.length ? `
    <div class="panel">
      <h2 class="panelTitle">Recent Entries</h2>
      <div class="tableWrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Account</th><th>Drill</th><th>Hero</th><th>Score</th></tr></thead>
          <tbody>
            ${recentScores.map((s) => `
              <tr>
                <td>${formatDateTime(s.date)}</td>
                <td>${s.accountId ? esc(displayAccountId(s.accountId)) : '<span style="color:var(--ow-text-mute)">&mdash;</span>'}</td>
                <td>${esc(DRILLS[s.drill]?.name || s.drill)}</td>
                <td><span class="cellFlex">${heroImg(s.hero, 22, '', '')}${esc(HEROES[s.hero]?.name || s.hero)}</span></td>
                <td style="font-family:var(--ow-font-title);font-size:1.15rem">${s.score}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  return `
    <div class="entryFlow">
      <div class="panel tabPane">
        <div class="stepLabel">1. Select Drill
          <span class="completionBadge">${comp._overall.done} / ${comp._overall.total}</span>
        </div>
        ${drillHTML}
      </div>
      ${heroHTML}
      ${scoreHTML}
      ${recentHTML}
    </div>`;
}

function bindEntry() {
  const p = activePlayer();
  if (!p) return;

  el.content.querySelectorAll('[data-drill]').forEach((node) => {
    const pick = () => {
      ui.entry.drill = node.dataset.drill;
      ui.entry.hero = null;
      ui.entry.accountId = null;
      const heroes = DRILLS[ui.entry.drill]?.heroes || [];
      if (heroes.length === 1) ui.entry.hero = heroes[0];
      render();
      requestAnimationFrame(() => {
        el.content.querySelector('[data-scroll="hero"],[data-scroll="score"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };
    node.addEventListener('click', pick);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
    });
  });

  el.content.querySelectorAll('[data-hero]').forEach((node) => {
    const pick = () => {
      ui.entry.hero = node.dataset.hero;
      render();
      requestAnimationFrame(() => {
        el.content.querySelector('[data-scroll="score"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $('#scoreField')?.focus();
      });
    };
    node.addEventListener('click', pick);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
    });
  });

  el.content.querySelectorAll('[data-account]').forEach((node) => {
    node.addEventListener('click', () => {
      ui.entry.accountId = node.dataset.account;
      render();
    });
  });

  const field = $('#scoreField');
  if (field) {
    field.addEventListener('input', () => {
      ui.entry.score = field.value;
      const btn = $('#submitScore');
      if (btn) btn.disabled = !field.value;
    });
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitScore(); });
  }
  $('#submitScore')?.addEventListener('click', submitScore);
}

async function submitScore() {
  const p = activePlayer();
  const { drill, hero, score, accountId } = ui.entry;
  if (!p || !drill || !hero || !score) return;

  const entry = {
    id: generateId(),
    playerId: p.id,
    accountId: accountId || '',
    drill,
    hero,
    score: parseInt(score, 10),
    date: new Date().toISOString(),
  };
  if (Number.isNaN(entry.score)) { toast('Scores are numbers', 'err'); return; }

  data.scores.push(entry);
  ui.entry.score = '';
  toast(`Score recorded — ${entry.score}`);
  render();
  await persist(() => owApi.addScore(entry));
}

/* ─── LEADERBOARD ────────────────────────────────────────────────────────── */

function computeRankings({ drill, hero, sort }) {
  let filtered = data.scores;
  if (drill !== 'all') filtered = filtered.filter((s) => s.drill === drill);
  if (hero !== 'all') filtered = filtered.filter((s) => s.hero === hero);

  const byPlayer = {};
  filtered.forEach((s) => {
    if (!byPlayer[s.playerId]) byPlayer[s.playerId] = [];
    byPlayer[s.playerId].push(s);
  });

  const rows = Object.entries(byPlayer).map(([playerId, scores]) => {
    const comboBests = {};
    let best = { score: 0 };
    scores.forEach((s) => {
      const k = `${s.drill}__${s.hero}`;
      if (!comboBests[k] || s.score > comboBests[k]) comboBests[k] = s.score;
      if (s.score > best.score) best = s;
    });
    const values = Object.values(comboBests);
    return {
      playerId,
      score: best.score,
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      count: scores.length,
    };
  });

  rows.sort((a, b) => (sort === 'avg' ? b.avg - a.avg : b.score - a.score));
  return rows;
}

function heroOptionsFor(drill) {
  if (drill === 'all') {
    return [...new Set(data.scores.map((s) => s.hero))].sort();
  }
  return DRILLS[drill]?.heroes || [];
}

function renderLeaderboard() {
  const { drill, hero, sort } = ui.lb;
  const rankings = computeRankings({ drill, hero, sort });
  const options = heroOptionsFor(drill);

  const filters = `
    <div class="panel">
      <div class="filterRow">
        <span class="filterLabel">Drill:</span>
        <select class="filterSelect" id="lbDrill" aria-label="Drill filter">
          <option value="all">All Drills</option>
          ${Object.entries(DRILLS).map(([k, d]) => `<option value="${k}" ${drill === k ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
        <span class="filterLabel">Hero:</span>
        <select class="filterSelect" id="lbHero" aria-label="Hero filter">
          <option value="all">All Heroes</option>
          ${options.map((hk) => `<option value="${hk}" ${hero === hk ? 'selected' : ''}>${esc(HEROES[hk]?.name || hk)}</option>`).join('')}
        </select>
      </div>
    </div>`;

  if (!rankings.length) {
    return filters + emptyState('trophy', 'Nothing on the board yet',
      ['Log a few scores in <b>Score Entry</b> and the standings fill in.']);
  }

  const byBest = [...rankings].sort((a, b) => b.score - a.score);
  const podium = byBest.slice(0, 3);
  const podiumHTML = podium.length >= 2 ? `
    <div class="podium">
      ${podium.map((r, i) => {
        const p = playerById(r.playerId);
        const spotClass = i === 0 ? 'podiumFirst' : i === 1 ? 'podiumSecond' : 'podiumThird';
        return `
          <div class="podiumSpot ${spotClass}">
            ${medal(i + 1)}
            ${p?.favoriteHero ? `<img src="${HEROES[p.favoriteHero]?.portrait}" alt="" class="podiumPortrait"
                 style="border:3px solid ${esc(p?.color || '#F99E1A')}" loading="lazy" />` : ''}
            <div class="podiumName" style="color:${getReadableColor(p?.color)};text-shadow:${getColorShadow(p?.color)}">${esc(p?.name || 'Unknown')}</div>
            <div class="podiumScore" style="color:${['#22C55E', '#EAB308', '#EF4444'][i]}">${r.score}</div>
          </div>`;
      }).join('')}
    </div>` : '';

  const total = rankings.length;
  const table = `
    <div class="panel">
      <h2 class="panelTitle">Rankings</h2>
      <div class="tableWrap">
        <table class="table">
          <thead><tr>
            <th style="width:56px">Rank</th><th>Player</th>
            <th class="sortableHeader" data-sort="best">Best ${sort === 'best' ? '&#9660;' : ''}</th>
            <th class="sortableHeader" data-sort="avg">Average ${sort === 'avg' ? '&#9660;' : ''}</th>
            <th>Entries</th>
          </tr></thead>
          <tbody>
            ${rankings.map((r, idx) => {
              const p = playerById(r.playerId);
              return `
                <tr>
                  <td>${medal(idx + 1)}</td>
                  <td>
                    <span class="cellFlex">
                      <span class="playerChipColor" style="background:${esc(p?.color || '#999')}"></span>
                      ${p?.favoriteHero ? heroImg(p.favoriteHero, 24) : ''}
                      <strong style="color:${getReadableColor(p?.color)};text-shadow:${getColorShadow(p?.color)}">${esc(p?.name || 'Unknown')}</strong>
                      ${p?.mainAccount ? `<span class="cardTag">${esc(displayAccountId(p.mainAccount))}</span>` : ''}
                    </span>
                  </td>
                  <td style="font-family:var(--ow-font-title);font-size:1.2rem;font-weight:700;
                      color:${sort === 'best' ? 'var(--ow-orange)' : 'var(--ow-text)'}">${r.score}</td>
                  <td style="font-family:var(--ow-font-title);font-size:1.05rem;font-weight:600;
                      color:${sort === 'avg' ? 'var(--ow-orange)' : 'var(--ow-text)'}">${r.avg}</td>
                  <td>${r.count}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  return filters + podiumHTML
    + `<div class="panel"><h2 class="panelTitle">Score Distribution</h2>
         ${leaderboardDistribution(byBest, data.players)}</div>`
    + table;
}

function bindLeaderboard() {
  $('#lbDrill')?.addEventListener('change', (e) => {
    ui.lb.drill = e.target.value;
    ui.lb.hero = 'all';
    render();
  });
  $('#lbHero')?.addEventListener('change', (e) => { ui.lb.hero = e.target.value; render(); });
  el.content.querySelectorAll('[data-sort]').forEach((n) => {
    const pick = () => { ui.lb.sort = n.dataset.sort; render(); };
    n.setAttribute('tabindex', '0');
    n.setAttribute('aria-label', `Sort by ${n.dataset.sort}`);
    n.addEventListener('click', pick);
    n.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
    });
  });
}

/* ─── STATS ──────────────────────────────────────────────────────────────── */

function renderStats() {
  if (!data.players.length) {
    return emptyState('chart', 'No one to look at yet', ['Add a person to the roster first.']);
  }
  if (!ui.stats.playerId || !playerById(ui.stats.playerId)) {
    ui.stats.playerId = ui.activePlayerId && playerById(ui.activePlayerId)
      ? ui.activePlayerId : data.players[0].id;
  }
  const p = playerById(ui.stats.playerId);
  const mine = new Set(p.characters || []);

  const picker = `
    <div class="statsPlayerPicker">
      ${data.players.map((x) => `
        <button class="playerChip ${ui.stats.playerId === x.id ? 'playerChipActive' : ''}"
                data-statplayer="${esc(x.id)}" type="button"
                style="${ui.stats.playerId === x.id ? `border-color:${esc(x.color)}` : ''}">
          <span class="playerChipColor" style="background:${esc(x.color)}"></span>
          ${x.favoriteHero ? heroImg(x.favoriteHero, 20, 'playerChipHero') : ''}
          ${esc(x.name)}
        </button>`).join('')}
    </div>`;

  const scores = data.scores
    .filter((s) => s.playerId === p.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!scores.length) {
    return picker + emptyState('chart', `No scores for ${p.name} yet`,
      ['Everything they log in <b>Score Entry</b> lands here.']);
  }

  const values = scores.map((s) => s.score);
  const drillsDone = new Set(scores.map((s) => s.drill));
  const heroesUsed = new Set(scores.map((s) => s.hero));
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const best = Math.max(...values);

  const allBests = {};
  data.scores.forEach((s) => {
    if (!allBests[s.playerId] || s.score > allBests[s.playerId]) allBests[s.playerId] = s.score;
  });
  const sortedBests = Object.entries(allBests).sort((a, b) => b[1] - a[1]);
  const rank = sortedBests.findIndex(([pid]) => pid === p.id) + 1;

  const heroCount = new Set(Object.values(DRILLS).flatMap((d) => d.heroes)).size;

  const strip = `
    <div class="statStrip">
      <div class="statItem">
        <div class="statValue">${medal(rank)}<span class="statMax">/ ${sortedBests.length}</span></div>
        <div class="statLabel">Rank</div>
      </div>
      <div class="statItem"><div class="statValue">${scores.length}</div><div class="statLabel">Entries</div></div>
      <div class="statItem"><div class="statValue">${best}</div><div class="statLabel">Best</div></div>
      <div class="statItem"><div class="statValue">${avg}</div><div class="statLabel">Average</div></div>
      <div class="statItem"><div class="statValue">${drillsDone.size}<span class="statMax">/ ${Object.keys(DRILLS).length}</span></div><div class="statLabel">Drills</div></div>
      <div class="statItem"><div class="statValue">${heroesUsed.size}<span class="statMax">/ ${heroCount}</span></div><div class="statLabel">Heroes</div></div>
    </div>`;

  // Personal bests per drill+hero combo, in drill order
  const bests = {};
  scores.forEach((s) => {
    const k = `${s.drill}__${s.hero}`;
    if (!bests[k] || s.score > bests[k].score) bests[k] = s;
  });
  const pbRows = Object.entries(DRILLS).flatMap(([drillKey, d]) =>
    d.heroes.filter((h) => bests[`${drillKey}__${h}`]).map((h) => ({
      drillKey, drillName: d.name, hero: h, score: bests[`${drillKey}__${h}`].score, first: null,
    }))
  );
  const pbTable = `
    <div class="panel">
      <h2 class="panelTitle">Personal Bests</h2>
      <div class="tableWrap">
        <table class="table">
          <thead><tr><th>Drill</th><th>Hero</th><th>Best</th></tr></thead>
          <tbody>
            ${pbRows.map((r, i) => `
              <tr>
                ${i === 0 || pbRows[i - 1].drillKey !== r.drillKey
                  ? `<td rowspan="${pbRows.filter((x) => x.drillKey === r.drillKey).length}" style="font-weight:700;vertical-align:top">${esc(r.drillName)}</td>` : ''}
                <td><span class="cellFlex">${heroImg(r.hero, 26, '', '')}${esc(HEROES[r.hero]?.name || r.hero)}${mine.has(r.hero) ? ` <span class="kindTag main">YOURS</span>` : ''}</span></td>
                <td class="scoreGreen">${r.score}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const drillMap = {};
  scores.forEach((s) => { (drillMap[s.drill] ||= []).push(s.score); });
  const drillRows = Object.entries(drillMap).map(([k, v]) => ({
    name: DRILLS[k]?.name || k,
    best: Math.max(...v),
    avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    count: v.length,
  })).sort((a, b) => b.best - a.best);

  const heroMap = {};
  scores.forEach((s) => { (heroMap[s.hero] ||= []).push(s.score); });
  const heroRows = Object.entries(heroMap).map(([k, v]) => ({
    name: HEROES[k]?.name || k,
    best: Math.max(...v),
    avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    count: v.length,
  })).sort((a, b) => b.best - a.best);

  return picker + strip
    + `<div class="panel"><h2 class="panelTitle">All Scores</h2>${scoreClusterChart(scores)}</div>`
    + pbTable
    + `<div class="panel"><h2 class="panelTitle">By Drill</h2>${drillBreakdownChart(drillRows)}</div>`
    + `<div class="panel"><h2 class="panelTitle">By Hero</h2>${heroBreakdownChart(heroRows)}</div>`;
}

function bindStats() {
  el.content.querySelectorAll('[data-statplayer]').forEach((n) =>
    n.addEventListener('click', () => { ui.stats.playerId = n.dataset.statplayer; render(); }));
}

/* ─── COMPARE ────────────────────────────────────────────────────────────── */

function comparisonRows() {
  const { ids, drill } = ui.compare;
  if (ids.length < 2) return [];
  let relevant = data.scores.filter((s) => ids.includes(s.playerId));
  if (drill !== 'all') relevant = relevant.filter((s) => s.drill === drill);

  const combos = [...new Set(relevant.map((s) => `${s.drill}__${s.hero}`))];
  const rows = combos.map((combo) => {
    const [d, h] = combo.split('__');
    const row = { drill: d, hero: h, players: {}, bestScore: -Infinity };
    ids.forEach((pid) => {
      const best = relevant
        .filter((s) => s.playerId === pid && s.drill === d && s.hero === h)
        .reduce((m, s) => Math.max(m, s.score), -Infinity);
      if (best > -Infinity) {
        row.players[pid] = best;
        if (best > row.bestScore) row.bestScore = best;
      }
    });
    return row;
  });

  rows.sort((a, b) =>
    (DRILLS[a.drill]?.name || a.drill).localeCompare(DRILLS[b.drill]?.name || b.drill)
    || (HEROES[a.hero]?.name || a.hero).localeCompare(HEROES[b.hero]?.name || b.hero));
  return rows;
}

function renderCompare() {
  const { ids } = ui.compare;

  const picker = `
    <div class="panel">
      <div class="stepLabel">Select players to compare (2+)</div>
      <div class="compareSelect">
        ${data.players.map((p) => `
          <button class="compareChip ${ids.includes(p.id) ? 'compareChipActive' : ''}"
                  data-cmp="${esc(p.id)}" type="button"
                  style="${ids.includes(p.id) ? `border-color:${esc(p.color)}` : ''}">
            <span class="playerChipColor" style="background:${esc(p.color)}"></span>
            ${p.favoriteHero ? heroImg(p.favoriteHero, 20, 'playerChipHero') : ''}
            ${esc(p.name)}
          </button>`).join('')}
      </div>
      ${ids.length >= 2 ? `
        <div class="filterRow">
          <span class="filterLabel">Drill:</span>
          <select class="filterSelect" id="cmpDrill" aria-label="Drill filter">
            <option value="all">All Drills</option>
            ${Object.entries(DRILLS).map(([k, d]) => `<option value="${k}" ${ui.compare.drill === k ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          </select>
        </div>` : ''}
    </div>`;

  if (ids.length < 2) {
    return picker + emptyState('compare', 'Pick two or more',
      ['Select people above to put their scores head to head.']);
  }

  const rows = comparisonRows();
  if (!rows.length) {
    return picker + emptyState('search', 'No overlapping data',
      ['These players have not logged the same drill and hero yet.']);
  }

  const counts = {};
  ids.forEach((id) => { counts[id] = 0; });
  rows.forEach((row) => {
    ids.forEach((id) => {
      if (row.players[id] !== undefined && row.players[id] === row.bestScore) counts[id]++;
    });
  });

  const wins = `
    <div class="statStrip">
      ${ids.map((id) => {
        const p = playerById(id);
        return `
          <div class="statItem">
            <div class="statValue" style="color:${getReadableColor(p?.color)};text-shadow:${getColorShadow(p?.color)}">${counts[id] || 0}</div>
            <div class="statLabel">${esc(p?.name || 'Unknown')} wins</div>
          </div>`;
      }).join('')}
    </div>`;

  const table = `
    <div class="panel">
      <h2 class="panelTitle">Head to Head</h2>
      <div class="tableWrap">
        <table class="table">
          <thead><tr>
            <th>Drill</th><th>Hero</th>
            ${ids.map((id) => {
              const p = playerById(id);
              return `<th style="color:${getReadableColor(p?.color)};text-shadow:${getColorShadow(p?.color)}">${esc(p?.name || 'Unknown')}</th>`;
            }).join('')}
          </tr></thead>
          <tbody>
            ${rows.map((row) => {
              const present = ids.filter((id) => row.players[id] !== undefined);
              const min = Math.min(...present.map((id) => row.players[id]));
              return `
                <tr>
                  <td>${esc(DRILLS[row.drill]?.name || row.drill)}</td>
                  <td><span class="cellFlex">${heroImg(row.hero, 22, '', '')}${esc(HEROES[row.hero]?.name || row.hero)}</span></td>
                  ${ids.map((id) => {
                    const v = row.players[id];
                    if (v === undefined) return `<td style="color:var(--ow-text-mute)">&mdash;</td>`;
                    const isBest = v === row.bestScore;
                    const isWorst = present.length > 1 && v === min;
                    return `<td class="${isBest ? 'compareBetter' : isWorst ? 'compareWorse' : ''}"
                      style="font-family:var(--ow-font-title);font-size:1.1rem">${v}</td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  return picker + wins
    + `<div class="panel"><h2 class="panelTitle">Skill Profile</h2>
         ${compareRadarChart(rows, ids, data.players)}</div>`
    + table;
}

function bindCompare() {
  el.content.querySelectorAll('[data-cmp]').forEach((n) =>
    n.addEventListener('click', () => {
      const id = n.dataset.cmp;
      const i = ui.compare.ids.indexOf(id);
      if (i >= 0) ui.compare.ids.splice(i, 1);
      else if (ui.compare.ids.length >= 8) toast('That is a crowded comparison', 'err');
      else ui.compare.ids.push(id);
      render();
    }));
  $('#cmpDrill')?.addEventListener('change', (e) => { ui.compare.drill = e.target.value; render(); });
}

/* ─── HISTORY ────────────────────────────────────────────────────────────── */

function renderHistory() {
  const f = ui.hist;
  let list = [...data.scores].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (f.player !== 'all') list = list.filter((s) => s.playerId === f.player);
  if (f.drill !== 'all') list = list.filter((s) => s.drill === f.drill);
  if (f.hero !== 'all') list = list.filter((s) => s.hero === f.hero);

  const usedHeroes = [...new Set(data.scores.map((s) => s.hero))].sort();

  const filters = `
    <div class="panel">
      <div class="filterRow">
        <span class="filterLabel">Player:</span>
        <select class="filterSelect" id="hPlayer" aria-label="Player filter">
          <option value="all">All Players</option>
          ${data.players.map((p) => `<option value="${esc(p.id)}" ${f.player === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <span class="filterLabel">Drill:</span>
        <select class="filterSelect" id="hDrill" aria-label="Drill filter">
          <option value="all">All Drills</option>
          ${Object.entries(DRILLS).map(([k, d]) => `<option value="${k}" ${f.drill === k ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
        <span class="filterLabel">Hero:</span>
        <select class="filterSelect" id="hHero" aria-label="Hero filter">
          <option value="all">All Heroes</option>
          ${usedHeroes.map((hk) => `<option value="${hk}" ${f.hero === hk ? 'selected' : ''}>${esc(HEROES[hk]?.name || hk)}</option>`).join('')}
        </select>
        <div class="toolbarSpacer"></div>
        <button class="btn btnSm" id="hRefresh" type="button">${icon('refresh', 14)} Refresh</button>
      </div>
    </div>`;

  if (!list.length) {
    return filters + emptyState('doc', 'No entries found', ['Nothing matches these filters yet.']);
  }

  return filters + `
    <div class="panel">
      <h2 class="panelTitle">All Entries (${list.length})</h2>
      <div class="tableWrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Player</th><th>Account</th><th>Drill</th><th>Hero</th><th>Score</th><th>Actions</th></tr></thead>
          <tbody>
            ${list.map((s) => {
              const p = playerById(s.playerId);
              const editing = f.editing === s.id;
              return `
                <tr>
                  <td>${formatDateTime(s.date)}</td>
                  <td>
                    <span class="cellFlex">
                      <span class="playerChipColor" style="background:${esc(p?.color || '#999')}"></span>
                      <strong style="color:${getReadableColor(p?.color)};text-shadow:${getColorShadow(p?.color)}">${esc(p?.name || 'Unknown')}</strong>
                    </span>
                  </td>
                  <td>${s.accountId ? esc(displayAccountId(s.accountId)) : '<span style="color:var(--ow-text-mute)">&mdash;</span>'}</td>
                  <td>${esc(DRILLS[s.drill]?.name || s.drill)}</td>
                  <td><span class="cellFlex">${heroImg(s.hero, 22)}${esc(HEROES[s.hero]?.name || s.hero)}</span></td>
                  <td>
                    ${editing
                      ? `<input type="number" class="editInput" id="editScore" value="${esc(f.editValue)}" />`
                      : `<span style="font-family:var(--ow-font-title);font-size:1.1rem">${s.score}</span>`}
                  </td>
                  <td>
                    <div class="historyActions">
                      ${editing ? `
                        <button class="saveBtn" data-save="${esc(s.id)}" type="button">Save</button>
                        <button class="cancelBtn" data-cancel="1" type="button">Cancel</button>` : `
                        <button class="editBtn" data-edit="${esc(s.id)}" type="button">Edit</button>
                        ${f.confirmDelete === s.id ? `
                          <button class="deleteBtn" data-confirmdel="${esc(s.id)}" type="button">Sure?</button>
                          <button class="cancelBtn" data-cancel="1" type="button">No</button>` : `
                          <button class="deleteBtn" data-del="${esc(s.id)}" type="button">Delete</button>`}`}
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function bindHistory() {
  const f = ui.hist;
  $('#hPlayer')?.addEventListener('change', (e) => { f.player = e.target.value; render(); });
  $('#hDrill')?.addEventListener('change', (e) => { f.drill = e.target.value; render(); });
  $('#hHero')?.addEventListener('change', (e) => { f.hero = e.target.value; render(); });
  $('#hRefresh')?.addEventListener('click', () => loadData({ silent: true }));

  const row = (id) => data.scores.find((s) => s.id === id);

  el.content.querySelectorAll('[data-edit]').forEach((n) => n.addEventListener('click', () => {
    const s = row(n.dataset.edit);
    if (!s) return;
    f.editing = s.id;
    f.editValue = String(s.score);
    render();
    const input = $('#editScore');
    input?.focus();
    input?.select();
  }));

  $('#editScore')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.content.querySelector('[data-save]')?.click();
    if (e.key === 'Escape') { f.editing = null; render(); }
  });

  el.content.querySelectorAll('[data-save]').forEach((n) => n.addEventListener('click', async () => {
    const s = row(n.dataset.save);
    const v = parseInt($('#editScore').value, 10);
    if (!s || Number.isNaN(v)) return;
    s.score = v;
    f.editing = null;
    toast('Score updated');
    render();
    await persist(() => owApi.updateScore(s.id, v));
  }));

  el.content.querySelectorAll('[data-cancel]').forEach((n) => n.addEventListener('click', () => {
    f.editing = null;
    f.confirmDelete = null;
    render();
  }));

  el.content.querySelectorAll('[data-del]').forEach((n) => n.addEventListener('click', () => {
    f.confirmDelete = n.dataset.del;
    render();
  }));

  el.content.querySelectorAll('[data-confirmdel]').forEach((n) => n.addEventListener('click', async () => {
    const id = n.dataset.confirmdel;
    const s = row(id);
    if (!s) return;
    data.scores = data.scores.filter((x) => x.id !== id);
    f.confirmDelete = null;
    toast('Entry deleted');
    render();
    await persist(() => owApi.deleteScore(id));
    if (s) refreshLocalCache();
  }));
}

const refreshLocalCache = () => {
  try { localStorage.setItem('ow.aim:v1', JSON.stringify({ players: data.players, scores: data.scores })); }
  catch { /* ignore */ }
};

/* ─── Person modal — accounts + characters ───────────────────────────────── */

function openPersonModal(person) {
  const isEdit = !!person;
  const draft = {
    id: person?.id || generateId(),
    name: person?.name || '',
    color: person?.color || PRESET_COLORS[2],
    favoriteHero: person?.favoriteHero || null,
    mainAccount: person?.mainAccount || '',
    altAccounts: [...(person?.altAccounts || [])],
    characters: [...(person?.characters || [])],
  };
  let hexInput = draft.color;
  let confirmDelete = false;
  let tagError = '';

  const rgbOf = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0,
  });
  const hexOf = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('').toUpperCase();
  let rgb = rgbOf(draft.color);

  const body = () => {
    const heroesByRole = getHeroesByRole();
    const accts = [
      draft.mainAccount ? { id: draft.mainAccount, kind: 'main' } : null,
      ...draft.altAccounts.map((a) => ({ id: a, kind: 'alt' })),
    ].filter(Boolean);

    if (confirmDelete) {
      return `
        <h2 class="modalTitle">Delete Player</h2>
        <p class="confirmText">Delete <strong>${esc(draft.name)}</strong> and all their scores,
          accounts and characters? This cannot be undone.</p>
        <div class="modalActions">
          <button class="btn" data-act="canceldelete" type="button">Cancel</button>
          <button class="btn btnDanger" data-act="dodelete" type="button">Delete</button>
        </div>`;
    }

    return `
      <h2 class="modalTitle">${isEdit ? 'Edit Player' : 'New Player'}</h2>

      <div class="formSection">
        <div class="formSectionHead">
          <h3 class="formSectionTitle">Identity</h3>
        </div>
        <div class="formGroup">
          <label class="fieldLabel" for="pName">Name</label>
          <input class="input" id="pName" value="${esc(draft.name)}" maxlength="20"
                 placeholder="What do you go by?" />
        </div>
        <div class="formGroup">
          <label class="fieldLabel">Colour</label>
          <div class="colorPickerRow">
            <span class="colorPreview" style="background:${esc(hexOf(rgb.r, rgb.g, rgb.b))}"></span>
            <input class="hexInput" id="pHex" value="${esc(hexInput)}" maxlength="7" placeholder="#F06414"
                   aria-label="Colour hex code" />
            <div class="presetRow" style="margin:0;flex:1">
              ${PRESET_COLORS.slice(0, 12).map((c) => `
                <button class="swatch ${draft.color.toUpperCase() === c ? 'swatchActive' : ''}"
                        data-swatch="${c}" style="background:${c}" title="${c}" type="button"></button>`).join('')}
            </div>
          </div>
          ${[['r', 'R', '#EF4444'], ['g', 'G', '#22C55E'], ['b', 'B', '#3B82F6']].map(([ch, label, accent]) => `
            <div class="sliderRow">
              <span class="sliderLabel" style="color:${accent}" aria-hidden="true">${label}</span>
              <input type="range" class="slider" min="0" max="255" value="${rgb[ch]}" data-chan="${ch}"
                     aria-label="${label} channel" />
              <input type="number" class="sliderValue" min="0" max="255" value="${rgb[ch]}" data-chanum="${ch}"
                     aria-label="${label} channel value" />
            </div>`).join('')}
        </div>
      </div>

      <div class="formSection">
        <div class="formSectionHead">
          <h3 class="formSectionTitle">Accounts</h3>
          <span class="formSectionHelp">your main BattleTag, plus every alt — these land in Ranks, tagged to you</span>
        </div>
        <div class="formGroup">
          <label class="fieldLabel" for="pMain">Main account</label>
          <input class="input" id="pMain" value="${esc(draft.mainAccount)}"
                 placeholder="Name#1234" spellcheck="false" style="text-transform:none" />
        </div>
        ${draft.altAccounts.length ? `
          <div class="accountList">
            ${draft.altAccounts.map((a, i) => `
              <div class="accountItem">
                <span class="kindTag alt">ALT</span>
                <span class="tag">${esc(displayAccountId(a))}</span>
                <button class="accountRemove" data-rmalt="${i}" type="button" title="Remove alt">${icon('close', 15)}</button>
              </div>`).join('')}
          </div>` : ''}
        <div class="accountAddRow">
          <input class="input" id="pAlt" placeholder="Add an alt — Name#1234" spellcheck="false" />
          <button class="btn" data-act="addalt" type="button">${icon('add', 15)} Alt</button>
        </div>
        ${tagError ? `<div class="tagError">${esc(tagError)}</div>` : ''}
      </div>

      <div class="formSection">
        <div class="formSectionHead">
          <h3 class="formSectionTitle">Characters</h3>
          <span class="formSectionHelp">the heroes you train — they get flagged everywhere you look</span>
        </div>
        <div class="charGrid">
          ${['tank', 'damage', 'support'].map((role) => `
            <div class="charRoleHead">${ROLES[role].name}</div>
            ${heroesByRole[role].map((h) => `
              <button class="charTile ${draft.characters.includes(h.key) ? 'charTileActive' : ''}"
                      data-char="${h.key}" type="button" title="${esc(h.name)}">
                ${draft.characters.includes(h.key) ? `
                  <span class="charSig ${draft.favoriteHero === h.key ? 'on' : ''}" data-sig="${h.key}"
                        title="Make ${esc(h.name)} the signature hero">${icon('star', 13)}</span>` : ''}
                <img src="${h.portrait}" alt="" loading="lazy" />
                <span class="charName">${esc(h.name)}</span>
              </button>`).join('')}`).join('')}
        </div>
        ${draft.characters.length ? `
          <div class="formGroup" style="margin-top:12px">
            <label class="fieldLabel" for="pSig">Signature hero (shown on podiums and chips)</label>
            <select class="select" id="pSig">
              <option value="">None</option>
              ${draft.characters.map((k) => `<option value="${k}" ${draft.favoriteHero === k ? 'selected' : ''}>${esc(HEROES[k]?.name || k)}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>

      <div class="modalActions">
        ${isEdit ? `<button class="btn btnDanger" data-act="delete" type="button" style="margin-right:auto">${icon('delete', 15)} Delete</button>` : ''}
        <button class="btn" data-close type="button">Cancel</button>
        <button class="btn btnPrimary" data-act="save" type="button" ${draft.name.trim() ? '' : 'disabled'}>
          ${isEdit ? 'Save' : 'Create'}
        </button>
      </div>`;
  };

  const rerender = () => {
    const focusId = document.activeElement?.id || null;
    const caret = document.activeElement?.selectionStart ?? null;
    const scroll = el.modalContent.scrollTop;
    openModal(body(), { wide: true, focus: false });
    bind();
    // Replacing the innerHTML collapses the scroll position to 0 — put the
    // reader back where they were instead of yanking the modal to the top.
    el.modalContent.scrollTop = scroll;
    // Reclaim whatever the rebuild just dropped, caret included.
    if (focusId) {
      const back = document.getElementById(focusId);
      if (back) {
        back.focus({ preventScroll: true });
        if (caret != null && back.setSelectionRange && back.type !== 'number') {
          try { back.setSelectionRange(caret, caret); } catch { /* not text */ }
        }
      }
    }
  };

  const bind = () => {
    const nameInput = $('#pName');
    nameInput?.addEventListener('input', () => {
      draft.name = nameInput.value;
      const save = el.modalContent.querySelector('[data-act="save"]');
      if (save) save.disabled = !draft.name.trim();
    });

    $('#pHex')?.addEventListener('input', (e) => {
      const v = e.target.value;
      hexInput = v;
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        draft.color = v.toUpperCase();
        rgb = rgbOf(draft.color);
        rerender();
        $('#pHex')?.focus();
      }
    });

    el.modalContent.querySelectorAll('[data-swatch]').forEach((n) =>
      n.addEventListener('click', () => {
        draft.color = n.dataset.swatch;
        hexInput = draft.color;
        rgb = rgbOf(draft.color);
        rerender();
      }));

    el.modalContent.querySelectorAll('[data-chan]').forEach((n) =>
      n.addEventListener('input', () => {
        // Patch in place — re-rendering mid-drag would drop the slider.
        rgb[n.dataset.chan] = Math.max(0, Math.min(255, parseInt(n.value, 10) || 0));
        draft.color = hexOf(rgb.r, rgb.g, rgb.b);
        hexInput = draft.color;
        const prev = el.modalContent.querySelector('.colorPreview');
        if (prev) prev.style.background = draft.color;
        const hx = $('#pHex');
        if (hx) hx.value = hexInput;
        const num = el.modalContent.querySelector(`[data-chanum="${n.dataset.chan}"]`);
        if (num) num.value = rgb[n.dataset.chan];
      }));
    el.modalContent.querySelectorAll('[data-chanum]').forEach((n) =>
      n.addEventListener('input', () => {
        rgb[n.dataset.chanum] = Math.max(0, Math.min(255, parseInt(n.value, 10) || 0));
        draft.color = hexOf(rgb.r, rgb.g, rgb.b);
        hexInput = draft.color;
        const prev = el.modalContent.querySelector('.colorPreview');
        if (prev) prev.style.background = draft.color;
        const hx = $('#pHex');
        if (hx) hx.value = hexInput;
        const range = el.modalContent.querySelector(`[data-chan="${n.dataset.chanum}"]`);
        if (range) range.value = rgb[n.dataset.chanum];
      }));

    const mainInput = $('#pMain');
    // No rerender here: rebuilding the modal mid-edit would yank the field
    // out from under the person typing in it. The draft keeps up as they go.
    mainInput?.addEventListener('input', () => {
      draft.mainAccount = mainInput.value;
      tagError = '';
    });
    mainInput?.addEventListener('change', () => {
      draft.mainAccount = normalizeAccountId(mainInput.value);
      mainInput.value = draft.mainAccount;
    });

    const altInput = $('#pAlt');
    const addAlt = () => {
      const raw = altInput?.value || '';
      const id = normalizeAccountId(raw);
      if (!id) return;
      if (!isFullAccountTag(id)) {
        tagError = 'A BattleTag needs its number — Name#1234';
        rerender();
        return;
      }
      const taken = [draft.mainAccount, ...draft.altAccounts]
        .some((a) => a.toLowerCase() === id.toLowerCase());
      if (taken) { tagError = 'That account is already on this person'; rerender(); return; }
      draft.altAccounts.push(id);
      tagError = '';
      rerender();
      $('#pAlt')?.focus();
    };
    el.modalContent.querySelector('[data-act="addalt"]')?.addEventListener('click', addAlt);
    altInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addAlt(); } });

    el.modalContent.querySelectorAll('[data-rmalt]').forEach((n) =>
      n.addEventListener('click', () => {
        draft.altAccounts.splice(Number(n.dataset.rmalt), 1);
        rerender();
      }));

    el.modalContent.querySelectorAll('[data-char]').forEach((n) =>
      n.addEventListener('click', (e) => {
        if (e.target.closest('[data-sig]')) return;
        const k = n.dataset.char;
        const i = draft.characters.indexOf(k);
        if (i >= 0) {
          draft.characters.splice(i, 1);
          if (draft.favoriteHero === k) draft.favoriteHero = null;
        } else {
          draft.characters.push(k);
          if (!draft.favoriteHero) draft.favoriteHero = k;
        }
        rerender();
      }));

    el.modalContent.querySelectorAll('[data-sig]').forEach((n) =>
      n.addEventListener('click', (e) => {
        e.stopPropagation();
        draft.favoriteHero = draft.favoriteHero === n.dataset.sig ? null : n.dataset.sig;
        rerender();
      }));

    $('#pSig')?.addEventListener('change', (e) => { draft.favoriteHero = e.target.value || null; });

    el.modalContent.querySelector('[data-act="save"]')?.addEventListener('click', savePerson);
    el.modalContent.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
      confirmDelete = true; rerender();
    });
    el.modalContent.querySelector('[data-act="canceldelete"]')?.addEventListener('click', () => {
      confirmDelete = false; rerender();
    });
    el.modalContent.querySelector('[data-act="dodelete"]')?.addEventListener('click', deletePerson);
  };

  const savePerson = async () => {
    if (!draft.name.trim()) return;
    if (!draft.mainAccount && draft.altAccounts.length) {
      tagError = 'An alt needs a main account above it';
      rerender();
      return;
    }
    const payload = {
      id: draft.id,
      name: draft.name.trim(),
      color: draft.color,
      favoriteHero: draft.favoriteHero,
      mainAccount: normalizeAccountId(draft.mainAccount),
      altAccounts: draft.altAccounts.map(normalizeAccountId),
      characters: draft.characters,
    };

    const existing = playerById(payload.id);
    if (existing) Object.assign(existing, payload);
    else data.players.push(payload);
    ui.activePlayerId = payload.id;
    ui.stats.playerId = payload.id;
    savePrefs();

    closeModal();
    toast(existing ? 'Player updated' : 'Player created');
    render();
    refreshLocalCache();

    try {
      const res = await owApi.savePlayer(payload);
      if (res?.player) Object.assign(playerById(payload.id) || {}, res.player);
      loadData({ silent: true });
    } catch (err) {
      toast(`Saved here, but the server said: ${err.message}`, 'err', 5200);
    }
  };

  const deletePerson = async () => {
    const id = draft.id;
    data.players = data.players.filter((p) => p.id !== id);
    data.scores = data.scores.filter((s) => s.playerId !== id);
    if (ui.activePlayerId === id) ui.activePlayerId = null;
    if (ui.stats.playerId === id) ui.stats.playerId = null;
    ui.compare.ids = ui.compare.ids.filter((x) => x !== id);
    savePrefs();
    closeModal();
    toast('Player deleted');
    render();
    refreshLocalCache();
    try { await owApi.deletePlayer(id); } catch (err) { toast(err.message, 'err', 4200); }
  };

  openModal(body(), { wide: true }); // first paint takes focus; later rebuilds don't
  bind();
}

/* ─── Import / Export ────────────────────────────────────────────────────── */

function handleExport() {
  exportData({ players: data.players, scores: data.scores });
  toast('Data exported');
}

function handleImportClick() {
  el.importFile.click();
}

el.importFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  el.importFile.value = '';
  openImportModal(file);
});

function openImportModal(file) {
  let pw = '';
  openModal(`
    <h2 class="modalTitle">Import Data</h2>
    <p class="helpText">This replaces <b>everything</b> on the server — every person,
      account, character and score. The password is the group's: whoever set up the
      tracker holds it, and a backup file is only usable with it.</p>
    <div class="formGroup">
      <label class="fieldLabel" for="impPw">Password</label>
      <input class="input" id="impPw" type="password" placeholder="Enter password..." />
    </div>
    <div class="modalActions">
      <button class="btn" data-close type="button">Cancel</button>
      <button class="btn btnPrimary" id="impGo" type="button">Import</button>
    </div>`);
  $('#impPw').addEventListener('input', (e) => { pw = e.target.value; });
  $('#impPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#impGo').click(); });
  $('#impGo').addEventListener('click', async () => {
    try {
      const parsed = await parseImportFile(file);
      await owApi.importData(pw, parsed);
      closeModal();
      await loadData({ silent: true });
      toast('Data imported');
    } catch (err) {
      closeModal();
      toast(err.message || 'Import failed', 'err', 5000);
    }
  });
}

/* ─── Data loading + persistence ─────────────────────────────────────────── */

async function loadData({ silent = false } = {}) {
  const result = await owApi.loadData();
  const next = {
    players: result.players || [],
    scores: result.scores || [],
    offline: !!result.offline,
  };
  const changed = JSON.stringify([next.players, next.scores])
    !== JSON.stringify([data.players, data.scores]);
  const offlineChanged = next.offline !== ui.offline;

  data = { players: next.players, scores: next.scores };
  ui.offline = next.offline;
  ui.loading = false;

  if (!playerById(ui.activePlayerId)) {
    ui.activePlayerId = data.players[0]?.id || null;
    savePrefs();
  }
  // Only repaint when something actually moved: a repaint would wipe an
  // open inline edit or the scroll position.
  if (!silent || changed || offlineChanged) render();
}

/** Optimistic local update already applied — confirm it with the server. */
async function persist(send, okMessage) {
  try {
    await send();
    refreshLocalCache();
    if (ui.offline) { ui.offline = false; render(); }
    if (okMessage) toast(okMessage, 'ok', 1400);
  } catch (err) {
    toast(`Not saved: ${err.message}`, 'err', 5200);
    await loadData({ silent: true }); // fall back to what the server actually has
  }
}

/* ─── Render ─────────────────────────────────────────────────────────────── */

/** Where the keyboard was, so a re-render can put it back. */
function focusSnapshot() {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return null;
  if (a.id) return { sel: `#${a.id}` };
  if (a.dataset?.tab) return { sel: `[data-tab="${a.dataset.tab}"]` };
  if (a.dataset?.person) return { sel: `[data-person="${a.dataset.person}"]` };
  if (a.dataset?.cmp) return { sel: `[data-cmp="${a.dataset.cmp}"]` };
  if (a.dataset?.statplayer) return { sel: `[data-statplayer="${a.dataset.statplayer}"]` };
  return null;
}

function restoreFocus(snap) {
  if (!snap) return;
  const back = document.querySelector(snap.sel);
  if (back) back.focus({ preventScroll: true });
}

function render() {
  if (ui.loading) {
    el.content.innerHTML = `<div class="panel emptyState">
      <div class="emptyIcon"><span class="spin">${icon('refresh', 40)}</span></div>
      <h2>Loading the range…</h2></div>`;
    return;
  }

  const snap = focusSnapshot();
  renderRoster();
  renderTabs();
  renderContent();
  restoreFocus(snap);
}

function renderContent() {
  if (ui.loading) return;

  const banner = ui.offline ? `
    <div class="offlineBanner">${icon('warn', 16)}
      The API is unreachable — showing the last saved copy. Changes will sync when it is back.
    </div>` : '';

  const views = {
    entry: renderEntry,
    leaderboard: renderLeaderboard,
    stats: renderStats,
    compare: renderCompare,
    history: renderHistory,
  };

  el.content.innerHTML = banner + (views[ui.tab] || renderEntry)();

  if (ui.tab === 'entry') bindEntry();
  if (ui.tab === 'leaderboard') bindLeaderboard();
  if (ui.tab === 'stats') bindStats();
  if (ui.tab === 'compare') bindCompare();
  if (ui.tab === 'history') bindHistory();
}

/* ─── Roster interactions ────────────────────────────────────────────────── */

el.rosterRow.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  if (edit) {
    e.stopPropagation();
    openPersonModal(playerById(edit.dataset.edit));
    return;
  }
  const chip = e.target.closest('[data-person]');
  if (!chip) return;
  const id = chip.dataset.person;
  const changed = ui.activePlayerId !== id;
  if (changed) {
    ui.activePlayerId = id;
    ui.entry = { drill: null, hero: null, accountId: null, score: '' };
    ui.stats.playerId = id;
    savePrefs();
    updateRosterSelection();
    renderContent();
  }
});

el.rosterRow.addEventListener('dblclick', (e) => {
  const chip = e.target.closest('[data-person]');
  if (chip) openPersonModal(playerById(chip.dataset.person));
});

/* ─── Boot ───────────────────────────────────────────────────────────────── */

el.exportBtn.addEventListener('click', handleExport);
el.importBtn.addEventListener('click', handleImportClick);

render();
loadData();
setInterval(() => { if (!document.hidden) loadData({ silent: true }); }, 90_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadData({ silent: true });
});

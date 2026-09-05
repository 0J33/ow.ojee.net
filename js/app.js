/* ═══════════════════════════════════════════════════════════════════════════
   OW RANK TRACKER — ow.ojee.net
   ═══════════════════════════════════════════════════════════════════════════ */

import { initGridBackground } from './bg.js';
import {
  fetchSummary, searchPlayers, lookupVisibility, resolvePlayer, pool,
  normalizeTag, isFullTag, displayTag, prettyTag, CAREER_URL, ApiError,
} from './api.js';
import {
  ROLES, rankLabel, divisionMeta, compareRanks, classifyGroup,
  peakSkill, skillDivision, divisionGap, RULES,
} from './ranks.js';
import * as store from './store.js';

const $ = (sel) => document.querySelector(sel);
const el = {
  content: $('#content'), statusBar: $('#statusBar'), toasts: $('#toasts'),
  modal: $('#modal'), modalContent: $('#modalContent'),
  addForm: $('#addForm'), addInput: $('#addInput'), addBtn: $('#addBtn'),
  refreshBtn: $('#refreshBtn'), dataBtn: $('#dataBtn'), sortSelect: $('#sortSelect'),
  groupTray: $('#groupTray'), groupMembers: $('#groupMembers'),
  groupVerdicts: $('#groupVerdicts'), groupClear: $('#groupClear'),
};

/* Neutral silhouette shown while an avatar loads, or when a profile has none.
   Deliberately not the site favicon — that reads as "this is ojee", not "no photo". */
const AVATAR_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
  '<rect width="48" height="48" fill="#0e1524"/>' +
  '<circle cx="24" cy="18.5" r="7.5" fill="#26344b"/>' +
  '<path d="M9 46c0-8.6 6.7-13.5 15-13.5S39 37.4 39 46z" fill="#26344b"/></svg>'
);

const busy = new Set();          // ids currently being fetched
let refreshingAll = false;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtAgo(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function toast(message, kind = 'ok', ms = 3200) {
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

/** Ranks for one account on the active platform, with a fallback to the other. */
function ranksFor(id) {
  const { platform } = store.getSettings();
  const entry = store.getEntry(id);
  const comp = entry?.data?.competitive;
  if (!comp) return { ranks: null, season: null, platformUsed: null, fellBack: false };
  const other = platform === 'pc' ? 'console' : 'pc';
  const chosen = comp[platform] ? platform : (comp[other] ? other : null);
  if (!chosen) return { ranks: null, season: null, platformUsed: null, fellBack: false };
  return {
    ranks: comp[chosen],
    season: comp[chosen].season,
    platformUsed: chosen,
    fellBack: chosen !== platform,
  };
}

const anchorRanks = () => {
  const a = store.getSettings().anchor;
  return a ? ranksFor(a).ranks : null;
};

/* ─── Fetching ────────────────────────────────────────────────────────────── */

async function refreshOne(id, { force = false } = {}) {
  if (busy.has(id)) return;
  if (!force && !store.isStale(id)) return;
  busy.add(id);
  render();
  try {
    const account = store.getAccounts().find((a) => a.id === id);
    const { data, resolvedId } = await resolvePlayer(account?.resolvedId || id);
    if (resolvedId !== (account?.resolvedId || id)) {
      store.updateAccount(id, { resolvedId }); // stick to the id form that works
    }
    const noComp = !data?.competitive?.pc && !data?.competitive?.console;
    const isPublic = noComp ? await lookupVisibility(resolvedId) : true;
    const changes = store.putSummary(id, data, { isPublic });
    if (changes.length && !refreshingAll) {
      const c = changes[0];
      const dir = skillDivision(c.to) > skillDivision(c.from) ? 'up' : 'down';
      toast(`${data.username}: ${c.role} ${dir} to ${rankLabel(c.to)}`, 'info', 5000);
    }
    return changes;
  } catch (err) {
    if (err.name === 'AbortError') return;
    store.putError(id, err instanceof ApiError ? err : new ApiError(err.message));
    if (!refreshingAll) toast(`${displayTag(id)}: ${err.message}`, 'err', 5000);
  } finally {
    busy.delete(id);
    render();
  }
}

async function refreshAll({ force = false } = {}) {
  const targets = store.getAccounts()
    .map((a) => a.id)
    .filter((id) => force || store.isStale(id));
  if (!targets.length) { if (force) toast('Nothing to refresh'); return; }

  refreshingAll = true;
  el.refreshBtn.disabled = true;
  el.refreshBtn.innerHTML = '<span class="spin">&#10227;</span> Syncing';
  render();

  const before = new Set();
  await pool(targets, async (id) => {
    const changes = await refreshOne(id, { force: true });
    (changes || []).forEach(() => before.add(id));
  });

  refreshingAll = false;
  el.refreshBtn.disabled = false;
  el.refreshBtn.textContent = 'Refresh';
  const moved = before.size;
  toast(moved ? `${moved} account${moved > 1 ? 's' : ''} changed rank` : 'All ranks up to date');
  render();
}

/* ─── Adding accounts ─────────────────────────────────────────────────────── */

async function handleAdd(rawInput) {
  const input = normalizeTag(rawInput);
  if (!input) return;

  el.addBtn.disabled = true;
  el.addBtn.textContent = '...';
  try {
    if (isFullTag(input)) {
      await commitAdd(input);
    } else {
      await openCandidatePicker(input);
    }
  } catch (err) {
    toast(err.message || 'Could not add that account', 'err', 5000);
  } finally {
    el.addBtn.disabled = false;
    el.addBtn.textContent = 'Add';
  }
}

async function commitAdd(id, label = '') {
  const result = store.addAccount({ id, label });
  if (!result.added) {
    toast(result.reason === 'duplicate' ? 'Already tracking that account' : 'Invalid tag', 'err');
    return;
  }
  el.addInput.value = '';
  render();
  await refreshOne(id, { force: true });

  const entry = store.getEntry(id);
  if (entry?.ok) {
    toast(`Added ${entry.data.username}`);
  } else if (entry?.error?.kind === 'notfound') {
    // Nothing by that tag exists, so a card for it would never resolve.
    store.removeAccount(id);
    toast(`No account named ${displayTag(id)} — check the digits after the #`, 'err', 6000);
    render();
  } else if (entry?.error?.kind === 'unlisted') {
    // Real account, no career page. Keep it — it starts working the moment
    // Blizzard serves the profile again.
    toast(`${displayTag(id)} added, but Blizzard serves no profile for it`, 'err', 6000);
  }
}

/** Name-only input: search, then show who they might mean, ranks included. */
async function openCandidatePicker(name) {
  const res = await searchPlayers(name, { limit: 24 });
  const results = (res.results || []).filter((r) => r.is_public);

  if (!res.total) throw new Error(`No player found named "${name}"`);
  if (!results.length) {
    throw new Error(`Found ${res.total} player(s) named "${name}" but every profile is private`);
  }

  openModal(`
    <h2 class="modalTitle">Which ${esc(name)}?</h2>
    <p class="helpText">
      Blizzard&rsquo;s search does not expose the number after the&nbsp;#, so pick by
      avatar, title and rank. Adding by full BattleTag skips this step.
    </p>
    <div class="candidateList" id="candidateList">
      ${results.map((r, i) => `
        <button class="candidate" data-i="${i}" type="button">
          <img src="${esc(r.avatar)}" alt="" loading="lazy" />
          <span class="candidateMeta">
            <span class="candidateName">${esc(r.name)}</span>
            <span class="cardTitle">${esc(r.title || '')}</span>
            <span class="candidateRanks" data-ranks="${i}">
              <span class="miniRank">loading ranks&hellip;</span>
            </span>
          </span>
        </button>`).join('')}
    </div>
    <div class="modalActions"><button class="btn" data-close type="button">Cancel</button></div>
  `);

  $('#candidateList').addEventListener('click', (e) => {
    const btn = e.target.closest('.candidate');
    if (!btn) return;
    closeModal();
    commitAdd(results[Number(btn.dataset.i)].player_id);
  });

  // Ranks are the only reliable way to tell two same-named players apart.
  pool(results, async (r, i) => {
    const slot = document.querySelector(`[data-ranks="${i}"]`);
    if (!slot) return;
    try {
      const summary = await fetchSummary(r.player_id);
      const comp = summary.competitive?.pc || summary.competitive?.console;
      slot.innerHTML = comp
        ? (ROLES.map((role) => {
            const rank = comp[role.key];
            return rank ? `<span class="miniRank">
              <img src="${esc(rank.rank_icon)}" alt="" />
              <b style="color:${role.color}">${role.short}</b> ${esc(rankLabel(rank))}</span>` : '';
          }).join('') || '<span class="miniRank">No ranks this season</span>')
        : '<span class="miniRank">No competitive data</span>';
    } catch {
      slot.innerHTML = '<span class="miniRank">Ranks unavailable</span>';
    }
  }, 4);
}

/* ─── Rendering ───────────────────────────────────────────────────────────── */

function sortedAccounts() {
  const { sort, anchor } = store.getSettings();
  const list = [...store.getAccounts()];
  const name = (a) => (store.getEntry(a.id)?.data?.username || a.label || a.id).toLowerCase();

  const cmp = {
    name: (a, b) => name(a).localeCompare(name(b)),
    added: (a, b) => (a.addedAt || 0) - (b.addedAt || 0),
    rank: (a, b) => peakSkill(ranksFor(b.id).ranks) - peakSkill(ranksFor(a.id).ranks),
    changed: (a, b) =>
      (store.getHistory(b.id)[0]?.t || 0) - (store.getHistory(a.id)[0]?.t || 0),
    gap: (a, b) => {
      const base = anchorRanks();
      if (!base) return 0;
      const best = (acc) => {
        const r = ranksFor(acc.id).ranks;
        if (!r) return Infinity;
        const gaps = ROLES.map((role) => divisionGap(base[role.key], r[role.key]))
                          .filter((g) => g !== null);
        return gaps.length ? Math.min(...gaps) : Infinity;
      };
      return best(a) - best(b);
    },
  }[sort] || (() => 0);

  list.sort(cmp);
  if (anchor) { // the account you're comparing against always leads
    const i = list.findIndex((a) => a.id === anchor);
    if (i > 0) list.unshift(list.splice(i, 1)[0]);
  }
  return list;
}

function roleTileHTML(role, rank, cmpRank, isAnchorCard) {
  const meta = rank ? divisionMeta(rank.division) : null;

  let chip = '';
  if (cmpRank !== undefined && !isAnchorCard) {
    if (!rank || !cmpRank) {
      chip = '<span class="cmpChip cmp-unknown">&mdash;</span>';
    } else {
      const v = compareRanks(cmpRank, rank);
      chip = `<span class="cmpChip cmp-${v.status}" title="${esc(v.reason)}">${
        v.status === 'narrow' ? `OK &middot; ${v.gap}` : `WIDE &middot; ${v.gap}`
      }</span>`;
    }
  }

  return `
    <div class="roleTile ${rank ? '' : 'empty'}">
      <span class="roleTileLabel" style="color:${role.color}">${role.short}</span>
      ${rank ? `
        <span class="rankIcons">
          <img class="rankIcon" src="${esc(rank.rank_icon)}" alt="" loading="lazy" />
          <img class="tierIcon" src="${esc(rank.tier_icon)}" alt="" loading="lazy" />
        </span>
        <span class="rankText" style="color:${meta.color}">${esc(rankLabel(rank))}</span>
      ` : `
        <span class="rankIcons"></span>
        <span class="rankNone">&mdash;</span>
      `}
      ${chip}
    </div>`;
}

function cardHTML(account) {
  const { anchor, group, platform } = store.getSettings();
  const entry = store.getEntry(account.id);
  const data = entry?.data;
  const { ranks, season, platformUsed, fellBack } = ranksFor(account.id);
  const isAnchorCard = anchor === account.id;
  const base = anchorRanks();
  const liveSeason = store.currentSeason();

  const badges = [];
  if (isAnchorCard) badges.push('<span class="badge info">Anchor</span>');
  if (fellBack) badges.push(`<span class="badge">${platformUsed === 'pc' ? 'PC' : 'Console'} only</span>`);
  if (season && liveSeason && season < liveSeason)
    badges.push(`<span class="badge warn" title="These ranks are from season ${season}, not the current season — this player has not placed yet">S${season} &middot; not placed</span>`);
  else if (season) badges.push(`<span class="badge">S${season}</span>`);
  if (entry && entry.isPublic === false)
    badges.push('<span class="badge err" title="This career profile is set to private, so its ranks cannot be read">Private</span>');
  else if (entry?.error?.kind === 'unlisted')
    badges.push('<span class="badge err" title="Blizzard serves no career page for this account">No profile</span>');
  if (busy.has(account.id)) badges.push('<span class="badge"><span class="spin">&#10227;</span></span>');

  const inGroup = group.includes(account.id);

  return `
  <article class="card ${isAnchorCard ? 'isAnchor' : ''} ${inGroup ? 'isGrouped' : ''} ${store.isStale(account.id, 60) ? 'isStale' : ''}"
           data-id="${esc(account.id)}">
    <div class="cardBanner" data-act="anchor" role="button" tabindex="0"
         title="Compare everyone against this player"
         ${data?.namecard ? `style="background-image:url('${esc(data.namecard)}')"` : ''}>
      <img class="avatar" src="${esc(data?.avatar || AVATAR_FALLBACK)}" alt="" loading="lazy"
           onerror="this.src='${AVATAR_FALLBACK}'" />
      <div class="cardIdentity">
        <div class="cardName">${esc(account.label || data?.username || prettyTag(account.id) || 'Unknown')}</div>
        ${prettyTag(account.id) ? `<div class="cardTag">${esc(prettyTag(account.id))}</div>`
          : (account.label && data?.username ? `<div class="cardTag">${esc(data.username)}</div>` : '')}
        <div class="cardMetaRow">
          ${data?.endorsement?.frame ? `<img class="endorsement" src="${esc(data.endorsement.frame)}" alt="Endorsement ${data.endorsement.level}" title="Endorsement level ${data.endorsement.level}" />` : ''}
          ${badges.join('')}
        </div>
        ${data?.title ? `<div class="cardTitle">${esc(data.title)}</div>` : ''}
      </div>
      <div class="cardTools">
        <button class="iconBtn" data-act="group" title="${inGroup ? 'Remove from group' : 'Add to group'}">${inGroup ? '&#9679;' : '&#9675;'}</button>
        <button class="iconBtn" data-act="detail" title="Full profile and rank history">&#9432;</button>
        <button class="iconBtn" data-act="refresh" title="Refresh this account">&#10227;</button>
        <button class="iconBtn" data-act="remove" title="Stop tracking">&#10005;</button>
      </div>
    </div>

    ${entry && !entry.ok ? `<div class="cardError">
        ${entry.error.kind === 'unlisted' ? '&#128274; ' : ''}${esc(entry.error.message)}${data?.competitive ? ' — showing last known ranks' : ''}
        ${entry.error.kind === 'unlisted' ? `<br /><span class="helpText">
          Blizzard 404s this profile, so the usual causes are: career profile set to
          <b>private</b> (Options &rarr; Social), the BattleTag was <b>changed</b>, or the
          account has no Overwatch&nbsp;2 profile. Blizzard&rsquo;s search still knows the
          account, so it will start working on its own once the profile is served again.
          <a href="${esc(CAREER_URL(account.id))}" target="_blank" rel="noopener">Check on Blizzard &#8599;</a>
        </span>` : ''}
      </div>` : ''}
    ${entry?.ok && !ranks ? `<div class="cardError">No competitive ranks on this profile${entry.isPublic === false ? ' — the profile is private' : ' — private profile, or no competitive played'}</div>` : ''}
    ${account.note ? `<div class="cardNote">${esc(account.note)}</div>` : ''}

    <div class="roleRow">
      ${ROLES.map((role) => roleTileHTML(
          role, ranks?.[role.key] || null,
          base ? (base[role.key] || null) : undefined,
          isAnchorCard,
        )).join('')}
    </div>
  </article>`;
}

function tableHTML(accounts) {
  const { anchor, group } = store.getSettings();
  const base = anchorRanks();

  const cell = (rank, cmp, isAnchorRow) => {
    if (!rank) return '<td><span class="rankNone">&mdash;</span></td>';
    const meta = divisionMeta(rank.division);
    let chip = '';
    if (base && !isAnchorRow) {
      chip = cmp
        ? (() => { const v = compareRanks(cmp, rank);
            return `<span class="cmpChip cmp-${v.status}" title="${esc(v.reason)}">${v.status === 'narrow' ? 'OK' : 'WIDE'} ${v.gap}</span>`; })()
        : '<span class="cmpChip cmp-unknown">&mdash;</span>';
    }
    return `<td><span class="tableRank">
      <img src="${esc(rank.rank_icon)}" alt="" loading="lazy" />
      <span style="color:${meta.color}">${esc(rankLabel(rank))}</span>${chip}</span></td>`;
  };

  return `
  <div class="panel tableWrap">
    <table class="rankTable">
      <thead><tr>
        <th>Player</th>${ROLES.map((r) => `<th style="color:${r.color}">${r.short}</th>`).join('')}
        <th>Season</th><th>Updated</th>
      </tr></thead>
      <tbody>
        ${accounts.map((a) => {
          const entry = store.getEntry(a.id);
          const { ranks, season } = ranksFor(a.id);
          const isAnchorRow = anchor === a.id;
          return `<tr data-id="${esc(a.id)}" data-act="anchor"
                      class="${isAnchorRow ? 'isAnchor' : ''} ${group.includes(a.id) ? 'isGrouped' : ''}">
            <td><span class="tableName">
              <img src="${esc(entry?.data?.avatar || AVATAR_FALLBACK)}" alt="" loading="lazy" />
              <span>
                <b>${esc(a.label || entry?.data?.username || prettyTag(a.id) || 'Unknown')}</b>
                ${prettyTag(a.id) ? `<br /><span class="cardTag">${esc(prettyTag(a.id))}</span>` : ''}
              </span></span></td>
            ${ROLES.map((r) => cell(ranks?.[r.key] || null,
                base ? base[r.key] : undefined, isAnchorRow)).join('')}
            <td>${season ? `S${season}` : '&mdash;'}</td>
            <td class="cardTag">${fmtAgo(entry?.fetchedAt)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function statusHTML() {
  const accounts = store.getAccounts();
  if (!accounts.length) return '';
  const { anchor, platform } = store.getSettings();
  const oldest = Math.min(...accounts.map((a) => store.getEntry(a.id)?.fetchedAt || 0));
  const failing = accounts.filter((a) => store.getEntry(a.id)?.ok === false).length;
  const season = store.currentSeason();

  const bits = [
    `<span><span class="statusDot ${failing ? 'warn' : ''}"></span><b>${accounts.length}</b> tracked</span>`,
    `<span>Updated <b>${fmtAgo(oldest)}</b></span>`,
    season ? `<span>Season <b>${season}</b></span>` : '',
    `<span>Platform <b>${platform === 'pc' ? 'PC' : 'Console'}</b></span>`,
    failing ? `<span><span class="statusDot err"></span>${failing} failing</span>` : '',
  ];

  if (anchor) {
    const name = store.getEntry(anchor)?.data?.username || displayTag(anchor);
    bits.push(`<span><span class="statusDot"></span>Comparing against <b>${esc(name)}</b>
      &mdash; <button class="iconBtn" id="clearAnchor" type="button">clear</button></span>`);
  } else {
    bits.push('<span style="opacity:.75">Click a player to compare everyone against them</span>');
  }
  return bits.filter(Boolean).join('');
}

function renderGroupTray() {
  const { group } = store.getSettings();
  if (group.length < 2) { el.groupTray.hidden = true; return; }
  el.groupTray.hidden = false;

  el.groupMembers.innerHTML = group.map((id) => {
    const entry = store.getEntry(id);
    return `<span class="groupChip">
      <img src="${esc(entry?.data?.avatar || AVATAR_FALLBACK)}" alt="" />
      ${esc(entry?.data?.username || displayTag(id))}
      <button class="iconBtn" data-drop="${esc(id)}" title="Remove">&#10005;</button></span>`;
  }).join('');

  el.groupVerdicts.innerHTML = ROLES.map((role) => {
    const ranks = group.map((id) => ranksFor(id).ranks?.[role.key] || null);
    const v = classifyGroup(ranks);
    // One ranked player is not a verdict — a gap of 0 there would read as a
    // green light when there is simply nothing to compare against.
    const decided = v.ranked >= 2;
    const status = decided ? v.status : 'unknown';
    const label = !decided
      ? (v.ranked === 1 ? 'only 1 ranked' : 'no ranks')
      : status === 'narrow' ? `narrow &middot; ${v.gap}` : `wide &middot; ${v.gap}`;
    const warn = v.overCap ? ' &#9888; max 2 at GM+' : '';
    const missing = decided && v.unrankedCount ? ` (${v.unrankedCount} unranked)` : '';
    return `<span class="verdict ${status}" title="${esc(v.reason)}${v.overCap ? ' — Grandmaster and above are capped at 2-player groups' : ''}">
      <b style="color:${role.color}">${role.short}</b> ${label}${missing}${warn}</span>`;
  }).join('');
}

function render() {
  const { view, platform, sort, anchor } = store.getSettings();

  document.querySelectorAll('[data-platform]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.platform === platform)));
  document.querySelectorAll('[data-view]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  el.sortSelect.value = sort;

  el.statusBar.innerHTML = statusHTML();
  $('#clearAnchor')?.addEventListener('click', () => {
    store.setSetting('anchor', null); render();
  });

  const accounts = sortedAccounts();
  if (!accounts.length) {
    el.content.innerHTML = `
      <div class="panel emptyState">
        <div class="emptyIcon">&#127919;</div>
        <h3>No accounts tracked yet</h3>
        <p>Add a BattleTag above &mdash; <b>Name#1234</b> looks the account up directly.<br />
           A bare name searches instead, and you pick from the matches.</p>
        <p class="helpText">Their career profile has to be set to <b>public</b> in
           Overwatch&nbsp;2 &rarr; Options &rarr; Social for ranks to show.</p>
      </div>`;
    renderGroupTray();
    return;
  }

  el.content.innerHTML = view === 'table'
    ? tableHTML(accounts)
    : `<div class="grid">${accounts.map(cardHTML).join('')}</div>`;

  renderGroupTray();
}

/* ─── Detail modal ────────────────────────────────────────────────────────── */

function openDetail(id) {
  const account = store.getAccounts().find((a) => a.id === id);
  const entry = store.getEntry(id);
  const data = entry?.data;
  const history = store.getHistory(id);
  const comp = data?.competitive;

  const platformBlock = (key, label) => {
    const ranks = comp?.[key];
    if (!ranks) return '';
    return `<div class="platformBlock">
      <h4>${label} &middot; season ${ranks.season ?? '?'}</h4>
      <div class="roleRow">
        ${ROLES.map((r) => roleTileHTML(r, ranks[r.key] || null, undefined, true)).join('')}
      </div></div>`;
  };

  openModal(`
    <div class="detailHead">
      <img class="avatar" src="${esc(data?.avatar || AVATAR_FALLBACK)}" alt="" />
      <div>
        <h2 class="modalTitle" style="margin:0">${esc(data?.username || prettyTag(id) || 'Unknown')}</h2>
        <div class="cardTag">${esc(prettyTag(id) || 'added by name search')}${data?.title ? ` &middot; ${esc(data.title)}` : ''}</div>
        <div class="cardTag">Checked ${fmtAgo(entry?.fetchedAt)}</div>
      </div>
    </div>

    ${platformBlock('pc', 'PC')}
    ${platformBlock('console', 'Console')}
    ${!comp?.pc && !comp?.console ? '<p class="helpText">No competitive data on this profile.</p>' : ''}

    <div class="formGroup">
      <span class="fieldLabel">Nickname</span>
      <input class="input" id="detailLabel" value="${esc(account?.label || '')}" placeholder="${esc(data?.username || '')}" />
    </div>
    <div class="formGroup">
      <span class="fieldLabel">Note</span>
      <input class="input" id="detailNote" value="${esc(account?.note || '')}" placeholder="e.g. smurf, console only, plays evenings" />
    </div>

    <h4 class="fieldLabel" style="margin-bottom:8px">Rank changes seen (${history.length})</h4>
    <div class="historyList">
      ${history.length ? history.slice(0, 14).map((h) => {
        const up = skillDivision(h.to) > skillDivision(h.from);
        return `<div class="historyItem">
          <b style="color:${ROLES.find((r) => r.key === h.role)?.color}">${h.role.toUpperCase()}</b>
          <span>${esc(rankLabel(h.from))}</span>
          <span class="${up ? 'up' : 'down'}">${up ? '&#9650;' : '&#9660;'}</span>
          <span>${esc(rankLabel(h.to))}</span>
          <span class="cardTag" style="margin-left:auto">${fmtAgo(h.t)}</span>
        </div>`;
      }).join('')
        : '<p class="helpText">Nothing yet — changes are recorded from now on, each time this account refreshes.</p>'}
    </div>

    <div class="modalActions">
      <a class="btn" href="${esc(CAREER_URL(id))}" target="_blank" rel="noopener">Career profile</a>
      <button class="btn btnDanger" id="detailRemove" type="button">Stop tracking</button>
      <button class="btn btnPrimary" data-close type="button">Done</button>
    </div>
  `);

  const commit = () => {
    store.updateAccount(id, {
      label: $('#detailLabel').value.trim(),
      note: $('#detailNote').value.trim(),
    });
  };
  $('#detailLabel').addEventListener('change', commit);
  $('#detailNote').addEventListener('change', commit);
  $('#detailRemove').addEventListener('click', () => {
    store.removeAccount(id); closeModal(); render(); toast('Removed');
  });
  el.modal.addEventListener('modalclose', () => { commit(); render(); }, { once: true });
}

/* ─── Data modal (import / export) ────────────────────────────────────────── */

function openDataModal() {
  const payload = store.exportPayload();
  const json = JSON.stringify(payload, null, 2);

  openModal(`
    <h2 class="modalTitle">Tracked list</h2>
    <p class="helpText">
      Your list lives in this browser only. Export it to carry the same friends to
      your phone or another machine.
    </p>

    <h4 class="fieldLabel" style="margin:18px 0 6px">Export &mdash; ${payload.accounts.length} account(s)</h4>
    <textarea class="textarea" id="exportBox" readonly>${esc(json)}</textarea>
    <div class="toolbarGroup" style="margin-top:8px">
      <button class="btn btnSm" id="copyExport" type="button">Copy</button>
      <button class="btn btnSm" id="downloadExport" type="button">Download .json</button>
    </div>

    <h4 class="fieldLabel" style="margin:22px 0 6px">Import</h4>
    <p class="helpText">
      Paste an export, or just a list of BattleTags separated by new lines or commas.
    </p>
    <textarea class="textarea" id="importBox" placeholder="Ojee#2117&#10;Friend#1234&#10;&#10;…or paste an exported JSON block"></textarea>
    <div class="toolbarGroup" style="margin-top:8px">
      <input type="file" id="importFile" accept=".json,application/json,text/plain" class="input" style="padding:6px" />
      <label style="display:flex;gap:6px;align-items:center;font-size:.9rem">
        <input type="checkbox" id="replaceMode" /> Replace my current list
      </label>
      <button class="btn btnPrimary btnSm" id="doImport" type="button">Import</button>
    </div>

    <div class="modalActions"><button class="btn" data-close type="button">Close</button></div>
  `);

  $('#copyExport').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(json); toast('Copied to clipboard'); }
    catch { $('#exportBox').select(); toast('Press Ctrl+C to copy', 'info'); }
  });

  $('#downloadExport').addEventListener('click', () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ow-tracked-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) $('#importBox').value = await file.text();
  });

  $('#doImport').addEventListener('click', async () => {
    try {
      const rows = store.parseImport($('#importBox').value);
      const mode = $('#replaceMode').checked ? 'replace' : 'merge';
      if (mode === 'replace' &&
          !confirm(`Replace your ${store.getAccounts().length} tracked account(s) with these ${rows.length}?`))
        return;
      const { added, skipped } = store.applyImport(rows, mode);
      closeModal();
      render();
      toast(`Imported ${added}${skipped ? `, skipped ${skipped} duplicate(s)` : ''}`);
      await refreshAll({ force: true });
    } catch (err) {
      toast(err.message || 'Could not read that', 'err', 5000);
    }
  });
}

/* ─── Modal plumbing ──────────────────────────────────────────────────────── */

function openModal(html, { wide = false } = {}) {
  el.modalContent.className = `modalContent${wide ? ' wide' : ''}`;
  el.modalContent.innerHTML = html;
  el.modal.hidden = false;
  el.modalContent.querySelector('input,button,textarea')?.focus();
}

function closeModal() {
  if (el.modal.hidden) return;
  el.modal.dispatchEvent(new Event('modalclose'));
  el.modal.hidden = true;
  el.modalContent.innerHTML = '';
}

el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal || e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === '/' && document.activeElement !== el.addInput && el.modal.hidden) {
    e.preventDefault(); el.addInput.focus();
  }
});

/* ─── Events ──────────────────────────────────────────────────────────────── */

function toggleGroup(id) {
  const group = [...store.getSettings().group];
  const i = group.indexOf(id);
  if (i >= 0) group.splice(i, 1);
  else if (group.length >= 5) { toast('A competitive group is 5 players max', 'err'); return; }
  else group.push(id);
  store.setSetting('group', group);
  render();
}

el.content.addEventListener('click', (e) => {
  const holder = e.target.closest('[data-id]');
  if (!holder) return;
  const id = holder.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;

  if (act === 'group')   { e.stopPropagation(); toggleGroup(id); return; }
  if (act === 'detail')  { e.stopPropagation(); openDetail(id); return; }
  if (act === 'refresh') { e.stopPropagation(); refreshOne(id, { force: true }); return; }
  if (act === 'remove')  {
    e.stopPropagation();
    const name = store.getEntry(id)?.data?.username || displayTag(id);
    if (confirm(`Stop tracking ${name}?`)) { store.removeAccount(id); render(); }
    return;
  }
  if (act === 'anchor') {
    const current = store.getSettings().anchor;
    store.setSetting('anchor', current === id ? null : id);
    render();
  }
});

el.content.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const banner = e.target.closest('.cardBanner');
  if (!banner) return;
  e.preventDefault();
  banner.click();
});

el.groupTray.addEventListener('click', (e) => {
  const drop = e.target.closest('[data-drop]');
  if (drop) toggleGroup(drop.dataset.drop);
});
el.groupClear.addEventListener('click', () => { store.setSetting('group', []); render(); });

el.addForm.addEventListener('submit', (e) => { e.preventDefault(); handleAdd(el.addInput.value); });
el.refreshBtn.addEventListener('click', () => refreshAll({ force: true }));
el.dataBtn.addEventListener('click', openDataModal);
el.sortSelect.addEventListener('change', () => { store.setSetting('sort', el.sortSelect.value); render(); });

document.querySelectorAll('[data-platform]').forEach((b) =>
  b.addEventListener('click', () => { store.setSetting('platform', b.dataset.platform); render(); }));
document.querySelectorAll('[data-view]').forEach((b) =>
  b.addEventListener('click', () => { store.setSetting('view', b.dataset.view); render(); }));

/* ─── Boot ────────────────────────────────────────────────────────────────── */

initGridBackground($('#gridBg'));
render();
refreshAll();

// Top up whenever the tab comes back into focus, and on a slow timer while open.
setInterval(() => { if (!document.hidden) refreshAll(); },
  Math.max(5, store.getSettings().autoRefreshMin) * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });

$('#buildInfo').textContent = '';

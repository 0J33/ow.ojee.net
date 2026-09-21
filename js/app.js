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

/* ─── Icons ───────────────────────────────────────────────────────────────
   Material Symbols Outlined 400 — the pack every other ojee surface draws
   from. Inlined as path data because this page has no build step and no
   icon font.

   These used to be HTML entities: a 🎯 for the empty state, a 🔒 on an
   unlisted profile, a ⚠ on an over-cap group. An emoji is a picture the
   browser picks — it arrives in full colour, at whatever weight the
   platform's font decided, and it looked like a sticker dropped onto the
   page. ● ○ ⟳ ✕ ⓘ ↗ were the same problem more quietly: glyphs standing in
   for icons, each at the mercy of the body font's metrics.

   ▲ ▼ on the rank delta and the ← in the header link stay as text. Those
   are typography, not icons.                                              */
const ICON = {
  refresh: 'M480-160q-133 0-226.5-93.5T160-480q0-133 93.5-226.5T480-800q85 0 149 34.5T740-671v-129h60v254H546v-60h168q-38-60-97-97t-137-37q-109 0-184.5 75.5T220-480q0 109 75.5 184.5T480-220q83 0 152-47.5T728-393h62q-29 105-115 169t-195 64Z',
  info: 'M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z',
  close: 'm249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z',
  lock: 'M220-80q-24.75 0-42.37-17.63Q160-115.25 160-140v-434q0-24.75 17.63-42.38Q195.25-634 220-634h70v-96q0-78.85 55.61-134.42Q401.21-920 480.11-920q78.89 0 134.39 55.58Q670-808.85 670-730v96h70q24.75 0 42.38 17.62Q800-598.75 800-574v434q0 24.75-17.62 42.37Q764.75-80 740-80H220Zm0-60h520v-434H220v434Zm314.5-162.03Q557-324.06 557-355q0-30-22.67-54.5t-54.5-24.5q-31.83 0-54.33 24.5t-22.5 55q0 30.5 22.67 52.5t54.5 22q31.83 0 54.33-22.03ZM350-634h260v-96q0-54.17-37.88-92.08-37.88-37.92-92-37.92T388-822.08q-38 37.91-38 92.08v96ZM220-140v-434 434Z',
  external: 'M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h279v60H180v600h600v-279h60v279q0 24-18 42t-42 18H180Zm202-219-42-43 398-398H519v-60h321v321h-60v-218L382-339Z',
  warn: 'm40-120 440-760 440 760H40Zm104-60h672L480-760 144-180Zm361.5-65.68q8.5-8.67 8.5-21.5 0-12.82-8.68-21.32-8.67-8.5-21.5-8.5-12.82 0-21.32 8.68-8.5 8.67-8.5 21.5 0 12.82 8.68 21.32 8.67 8.5 21.5 8.5 12.82 0 21.32-8.68ZM454-348h60v-224h-60v224Zm26-122Z',
  target: 'M324-111.5Q251-143 197-197t-85.5-127Q80-397 80-480t31.5-156Q143-709 197-763t127-85.5Q397-880 480-880t156 31.5Q709-817 763-763t85.5 127Q880-563 880-480t-31.5 156Q817-251 763-197t-127 85.5Q563-80 480-80t-156-31.5ZM721-239q99-99 99-241t-99-241q-99-99-241-99t-241 99q-99 99-99 241t99 241q99 99 241 99t241-99Zm-411-71q-70-70-70-170t70-170q70-70 170-70t170 70q70 70 70 170t-70 170q-70 70-170 70t-170-70Zm297.5-42.5Q660-405 660-480t-52.5-127.5Q555-660 480-660t-127.5 52.5Q300-555 300-480t52.5 127.5Q405-300 480-300t127.5-52.5Zm-184-71Q400-447 400-480t23.5-56.5Q447-560 480-560t56.5 23.5Q560-513 560-480t-23.5 56.5Q513-400 480-400t-56.5-23.5Z',
  dotOn: 'M612-348q54-54 54-132t-54-132q-54-54-132-54t-132 54q-54 54-54 132t54 132q54 54 132 54t132-54ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Z',
  dotOff: 'M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Z',
  up: 'm280-400 200-201 200 201H280Z',
  down: 'M480-360 280-559h400L480-360Z',
};

/* An icon as an HTML string, since everything here renders by innerHTML.
   `currentColor` so it inherits whatever the button or badge already sets. */
const icon = (name, size = 16) =>
  `<svg class="ic" viewBox="0 -960 960 960" width="${size}" height="${size}"`
  + ` fill="currentColor" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

/* Neutral silhouette shown while an avatar loads, or when a profile has none.
   Deliberately not the site favicon — that reads as "this is ojee", not "no photo". */
const AVATAR_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
  '<rect width="48" height="48" fill="#0e1524"/>' +
  '<circle cx="24" cy="18.5" r="7.5" fill="#26344b"/>' +
  '<path d="M9 46c0-8.6 6.7-13.5 15-13.5S39 37.4 39 46z" fill="#26344b"/></svg>'
);

const busy = new Set();          // ids currently being fetched
// Same-name accounts from a failed tag lookup, kept until the add flow can
// put them in front of the user.
const ambiguous = new Map();
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
    if (err.kind === 'ambiguous') ambiguous.set(id, err.candidates);
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
  el.refreshBtn.innerHTML = `<span class="spin">${icon('refresh', 15)}</span> Syncing`;
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
  } else if (entry?.error?.kind === 'ambiguous') {
    // Never keep a card we cannot prove belongs to the right person.
    const candidates = ambiguous.get(id) || [];
    store.removeAccount(id);
    ambiguous.delete(id);
    render();
    await openCandidatePicker(displayTag(id).split('#')[0], {
      results: candidates, typedTag: displayTag(id),
    });
  } else if (entry?.error?.kind === 'unlisted') {
    // Real account, no career page. Keep it — it starts working the moment
    // Blizzard serves the profile again.
    toast(`${displayTag(id)} added, but Blizzard serves no profile for it`, 'err', 6000);
  }
}


/**
 * Track a BattleTag whose career page Blizzard will not serve.
 * Blizzard's search index only contains public profiles — a scan of 12 name
 * searches returned 164 public and 0 private — so an account that resolves as
 * a tag but is missing from search is, in practice, not set to public.
 * We keep the card: it starts working by itself once that changes.
 */
function keepUnresolved(id) {
  const result = store.addAccount({ id });
  if (!result.added) { toast('Already tracking that account', 'err'); return; }
  store.putError(id, new ApiError(
    'Not visible — this profile is almost certainly not set to public',
    { status: 404, kind: 'unlisted' }
  ));
  render();
  toast(`${displayTag(id)} kept — it will fill in once the profile is public`, 'info', 6000);
}

/**
 * Show every account with this name so the user can pick the right one.
 * `results` may be supplied by a caller that has already searched.
 */
async function openCandidatePicker(name, { results = null, typedTag = null } = {}) {
  if (!results) {
    const res = await searchPlayers(name, { limit: 24 });
    results = res.results || [];
    if (!results.length) throw new Error(`No player found named "${name}"`);
  }
  if (!results.length) throw new Error(`No account named "${name}" could be listed`);

  openModal(`
    <h2 class="modalTitle">Which ${esc(name)}?</h2>
    <p class="helpText">
      ${typedTag
        ? `Blizzard has no career page it will serve for <b>${esc(typedTag)}</b>, and its
           search ignores the digits after the&nbsp;#&nbsp;&mdash; so these
           ${results.length} accounts all match. Pick by avatar, title and rank.`
        : `Blizzard&rsquo;s search does not expose the number after the&nbsp;#, so pick by
           avatar, title and rank. Adding by full BattleTag skips this step.`}
    </p>
    <div class="candidateList" id="candidateList">
      ${results.map((r, i) => `
        <button class="candidate" data-i="${i}" type="button">
          <img src="${esc(r.avatar)}" alt="" loading="lazy" />
          <span class="candidateMeta">
            <span class="candidateName">${esc(r.name)}
              ${r.is_public === false ? '<span class="badge err">Private</span>' : ''}</span>
            <span class="cardTitle">${esc(r.title || '')}</span>
            <span class="candidateRanks" data-ranks="${i}">
              <span class="miniRank">loading ranks&hellip;</span>
            </span>
          </span>
        </button>`).join('')}
    </div>
    <div class="modalActions">
      ${typedTag ? `<button class="btn" id="keepTyped" type="button">None of these is mine</button>` : ''}
      <button class="btn" data-close type="button">Cancel</button>
    </div>
  `);

  if (typedTag) {
    $('#keepTyped').addEventListener('click', () => {
      closeModal();
      keepUnresolved(normalizeTag(typedTag));
    });
  }

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
  if (busy.has(account.id)) badges.push(`<span class="badge"><span class="spin">${icon('refresh', 12)}</span></span>`);

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
        <button class="iconBtn" data-act="group" title="${inGroup ? 'Remove from group' : 'Add to group'}">${icon(inGroup ? 'dotOn' : 'dotOff')}</button>
        <button class="iconBtn" data-act="detail" title="Full profile and rank history">${icon('info')}</button>
        <button class="iconBtn" data-act="refresh" title="Refresh this account">${icon('refresh')}</button>
        <button class="iconBtn" data-act="remove" title="Stop tracking">${icon('close')}</button>
      </div>
    </div>

    ${entry && !entry.ok ? `<div class="cardError">
        ${entry.error.kind === 'unlisted' ? icon('lock', 14) + ' ' : ''}${esc(entry.error.message)}${data?.competitive ? ' — showing last known ranks' : ''}
        ${entry.error.kind === 'unlisted' ? `<br /><span class="helpText">
          Blizzard only publishes a career page for profiles set to <b>public</b>, and
          only lists those in search &mdash; so this almost always means the profile is
          <b>private</b> or <b>friends only</b>. Fix it in Overwatch&nbsp;2 under
          <b>Options &rarr; Social &rarr; Career Profile</b>, then refresh here.
          Less often: the BattleTag was changed, or the account has no Overwatch&nbsp;2 profile.
          <a href="${esc(CAREER_URL(account.id))}" target="_blank" rel="noopener">Check on Blizzard ${icon('external', 13)}</a>
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
      <button class="iconBtn" data-drop="${esc(id)}" title="Remove">${icon('close', 14)}</button></span>`;
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
    const warn = v.overCap ? ` ${icon('warn', 14)} max 2 at GM+` : '';
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
        <div class="emptyIcon">${icon('target', 44)}</div>
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

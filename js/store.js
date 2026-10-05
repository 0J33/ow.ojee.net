/* ═══════════════════════════════════════════════════════════════════════════
   SHARED STORAGE — localStorage as cache, the server as the source of truth
   The tracked list, the fetched career profiles and the rank-change history
   all live in one document on server.ojee.net, so every device and every
   visitor sees the same tracker. localStorage keeps the page instant on load
   and keeps the whole app working when the API cannot be reached.

   Sync model (deliberately small):
     · every local mutation marks the state dirty and schedules one push
     · coming back to the tab pulls; a newer server copy wins outright
     · a dirty state never adopts — we push ours first, then pull
   Preferences (view, sort, platform, anchor, group) stay per-device: they are
   about how *you* are looking right now, not about the data.
   ═══════════════════════════════════════════════════════════════════════════ */

import { normalizeTag, displayTag } from './api.js';
import { ROLES } from './ranks.js';

const KEY = 'ow.ojee.net:v2';
const SCHEMA = 2;
const HISTORY_LIMIT = 40;
const SERVER = 'https://server.ojee.net/api/ow/rank/state';
const PUSH_DEBOUNCE_MS = 1200;
const FETCH_TIMEOUT_MS = 12_000;

/** fetch with a hard deadline: a stalled request must not stall the page. */
function getJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

const defaults = () => ({
  version: SCHEMA,
  accounts: [],   // [{ id, label, note, addedAt, pid?, kind? }]
  cache: {},      // id -> { fetchedAt, ok, error, isPublic, data }
  history: {},    // id -> [{ t, platform, role, from, to }]
  settings: {
    platform: 'pc',
    view: 'grid',
    sort: 'rank',
    anchor: null,
    group: [],
    autoRefreshMin: 15,
    staleMin: 10,
  },
});

let state = load();

/* Settings are merged, never replaced: a server copy carries somebody else's
   (or no) preferences, and the local ones are this device's own. */
function sanitize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base, ...raw,
    version: SCHEMA,
    settings: { ...base.settings, ...(raw.settings || {}) },
    cache: raw.cache && typeof raw.cache === 'object' ? raw.cache : {},
    history: raw.history && typeof raw.history === 'object' ? raw.history : {},
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // One-time move from the v1 key so existing devices keep their list.
      const legacy = localStorage.getItem('ow.ojee.net:v1');
      return legacy ? sanitize(JSON.parse(legacy)) : defaults();
    }
    return sanitize(JSON.parse(raw));
  } catch {
    return defaults(); // corrupt or blocked storage: start clean rather than break
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (err) { console.warn('Could not persist to localStorage', err); }
  }, 120);
}

/* ─── Remote sync ────────────────────────────────────────────────────────── */

const events = new EventTarget();
/** Fires when a newer server copy replaces the local one. */
export const onRemote = (fn) => events.addEventListener('remote', fn);

let syncedAt = loadMeta('syncedAt');   // server updatedAt of the copy we last read or wrote
let dirty = loadMeta('dirty') === '1'; // local changes not yet pushed (survives reloads)
let pushTimer = null;
let inFlight = null;                   // one sync at a time
export const syncStatus = () => ({
  dirty, syncing: !!inFlight, syncedAt,
  online: navigator.onLine !== false,
});

function loadMeta(k) {
  try { return localStorage.getItem(`${KEY}:${k}`); } catch { return null; }
}
function saveMeta(k, v) {
  try {
    if (v == null) localStorage.removeItem(`${KEY}:${k}`);
    else localStorage.setItem(`${KEY}:${k}`, v);
  } catch { /* private mode: sync still works for this session */ }
}

function markDirty() {
  dirty = true;
  saveMeta('dirty', '1');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { sync('push'); }, PUSH_DEBOUNCE_MS);
}

const payload = () => ({
  accounts: state.accounts,
  cache: state.cache,
  history: state.history,
});

async function push({ keepalive = false } = {}) {
  const res = await getJSON(SERVER, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload()),
    keepalive, // only for the pagehide flush: bodies over 64kb are rejected
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  const json = await res.json();
  syncedAt = json.updatedAt || new Date().toISOString();
  saveMeta('syncedAt', syncedAt);
  dirty = false;
  saveMeta('dirty', null);
  save();
}

async function pull() {
  const res = await getJSON(SERVER, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const remote = await res.json();

  const remoteAt = remote.updatedAt || null;
  const hasRemote = !!remoteAt && (Array.isArray(remote.accounts) && remote.accounts.length
    || Object.keys(remote.cache || {}).length);

  if (!hasRemote) {
    // Server is still empty — seed it with whatever this device has.
    if (state.accounts.length || Object.keys(state.cache).length) await push();
    else { syncedAt = null; saveMeta('syncedAt', null); }
    return;
  }

  const remoteTime = Date.parse(remoteAt);
  const localTime = syncedAt ? Date.parse(syncedAt) : 0;
  if (syncedAt && !(remoteTime > localTime)) return; // we are current

  state = sanitize({ ...state, accounts: remote.accounts, cache: remote.cache, history: remote.history });
  syncedAt = remoteAt;
  saveMeta('syncedAt', syncedAt);
  save();
  events.dispatchEvent(new Event('remote'));
}

let retryTimer = null;
let retries = 0;

/** Serialize syncs so a push and a pull never interleave. */
export function sync(mode = 'auto') {
  if (inFlight) return inFlight;
  const run = (async () => {
    try {
      if (mode !== 'pull' && dirty) await push();
      if (mode !== 'push') await pull();
      retries = 0;
    } catch (err) {
      console.warn('rank-state sync failed:', err.message);
      // The link to the API is flaky at times — come back on our own a few
      // times rather than waiting for the next tab focus.
      if (retries < 4) {
        retries++;
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => sync('auto'), 6_000 * retries);
      }
    } finally {
      inFlight = null;
    }
  })();
  inFlight = run;
  return run;
}

/* ─── Reads ──────────────────────────────────────────────────────────────── */

export const getState = () => state;
export const getAccounts = () => state.accounts;
export const getSettings = () => state.settings;
export const getEntry = (id) => state.cache[id] || null;
export const getHistory = (id) => state.history[id] || [];

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

/* ─── Mutations (each one marks the shared state dirty) ──────────────────── */

export function addAccount({ id, label = '', note = '' }) {
  const clean = normalizeTag(id);
  if (!clean) return { added: false, reason: 'empty' };
  if (state.accounts.some((a) => a.id.toLowerCase() === clean.toLowerCase()))
    return { added: false, reason: 'duplicate' };
  state.accounts.push({ id: clean, label, note, addedAt: Date.now() });
  save(); markDirty();
  return { added: true, id: clean };
}

export function removeAccount(id) {
  state.accounts = state.accounts.filter((a) => a.id !== id);
  delete state.cache[id];
  delete state.history[id];
  if (state.settings.anchor === id) state.settings.anchor = null;
  state.settings.group = state.settings.group.filter((g) => g !== id);
  save(); markDirty();
}

export function updateAccount(id, patch) {
  const acc = state.accounts.find((a) => a.id === id);
  if (acc) Object.assign(acc, patch);
  save(); markDirty();
}

export function moveAccount(id, delta) {
  const i = state.accounts.findIndex((a) => a.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.accounts.length) return;
  const [item] = state.accounts.splice(i, 1);
  state.accounts.splice(j, 0, item);
  save(); markDirty();
}

/* ─── Cache + rank-change history ─────────────────────────────────────────── */

const sameRank = (a, b) =>
  (!a && !b) || (!!a && !!b && a.division === b.division && a.tier === b.tier);

/** Store a fresh summary and record any role whose rank actually moved. */
export function putSummary(id, data, { isPublic = null } = {}) {
  const previous = state.cache[id]?.data;
  const changes = [];

  for (const platform of ['pc', 'console']) {
    const before = previous?.competitive?.[platform];
    const after = data?.competitive?.[platform];
    if (!before || !after) continue;
    for (const role of ROLES) {
      const from = before[role.key] || null;
      const to = after[role.key] || null;
      if (!sameRank(from, to)) {
        changes.push({ t: Date.now(), platform, role: role.key, from, to });
      }
    }
  }

  if (changes.length) {
    state.history[id] = [...changes, ...(state.history[id] || [])].slice(0, HISTORY_LIMIT);
  }

  state.cache[id] = {
    fetchedAt: Date.now(),
    ok: true,
    error: null,
    isPublic: isPublic ?? state.cache[id]?.isPublic ?? null,
    data,
  };
  save(); markDirty();
  return changes;
}

export function putError(id, error) {
  const prev = state.cache[id];

  // An account with no career page still has a name and avatar in Blizzard's
  // search index — worth showing, so the card reads as a person, not a failure.
  const fromSearch = error.profile && {
    username: error.profile.name,
    avatar: error.profile.avatar,
    namecard: error.profile.namecard,
    title: error.profile.title,
    endorsement: null,
    competitive: null,
    last_updated_at: error.profile.last_updated_at,
  };

  state.cache[id] = {
    fetchedAt: Date.now(),
    ok: false,
    error: { message: error.message, kind: error.kind || 'error' },
    isPublic: error.profile ? !!error.profile.is_public : (prev?.isPublic ?? null),
    data: prev?.data ?? fromSearch ?? null, // keep the last good ranks if we had any
  };
  save(); markDirty();
}

export const isStale = (id, minutes = state.settings.staleMin) => {
  const entry = state.cache[id];
  return !entry || Date.now() - entry.fetchedAt > minutes * 60_000;
};

/**
 * Best guess at the live season: the highest season number seen across every
 * tracked profile. Anyone playing this season pulls it forward automatically,
 * so a friend still showing an older season is visibly behind.
 */
export function currentSeason() {
  let max = 0;
  for (const entry of Object.values(state.cache)) {
    for (const platform of ['pc', 'console']) {
      const s = entry?.data?.competitive?.[platform]?.season;
      if (typeof s === 'number') max = Math.max(max, s);
    }
  }
  return max || null;
}

/* ─── Import / export ─────────────────────────────────────────────────────── */

export function exportPayload() {
  return {
    app: 'ow.ojee.net',
    version: SCHEMA,
    exportedAt: new Date().toISOString(),
    accounts: state.accounts.map(({ id, label, note }) => ({
      id, battletag: displayTag(id), label: label || undefined, note: note || undefined,
    })),
  };
}

/**
 * Accepts our own export, a bare array, or a newline/comma separated list of
 * BattleTags — so a list pasted out of Discord imports without reformatting.
 */
export function parseImport(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Nothing to import');

  let rows = null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : parsed.accounts;
    if (!Array.isArray(list)) throw new Error('No "accounts" array found in that JSON');
    rows = list.map((row) =>
      typeof row === 'string'
        ? { id: normalizeTag(row) }
        : { id: normalizeTag(row.id || row.battletag || row.tag || ''),
            label: row.label || '', note: row.note || '' }
    );
  } else {
    rows = trimmed.split(/[\n,;]+/).map((t) => ({ id: normalizeTag(t) }));
  }

  const seen = new Set();
  return rows.filter((r) => {
    const k = r.id.toLowerCase();
    if (!r.id || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function applyImport(rows, mode = 'merge') {
  if (mode === 'replace') {
    state.accounts = [];
    state.cache = {};
    state.history = {};
    state.settings.anchor = null;
    state.settings.group = [];
  }
  let added = 0, skipped = 0;
  for (const row of rows) {
    if (addAccount(row).added) added++; else skipped++;
  }
  save(); markDirty();
  return { added, skipped };
}

/** Best-effort last push as the tab closes; the dirty flag survives either way. */
export function flush() {
  if (!dirty) return;
  clearTimeout(pushTimer);
  push({ keepalive: true }).catch(() => { /* picked up on the next load */ });
}

// A reload that happened before a scheduled push: don't lose those changes.
if (dirty) setTimeout(() => sync('push'), 600);

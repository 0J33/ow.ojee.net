/* ═══════════════════════════════════════════════════════════════════════════
   PER-DEVICE STORAGE  (localStorage) + IMPORT / EXPORT
   Nothing leaves the browser except the API calls themselves. The tracked
   list lives on this device only, which is why import/export exists.
   ═══════════════════════════════════════════════════════════════════════════ */

import { normalizeTag, displayTag } from './api.js';
import { ROLES } from './ranks.js';

const KEY = 'ow.ojee.net:v1';
const SCHEMA = 1;
const HISTORY_LIMIT = 40;

const defaults = () => ({
  version: SCHEMA,
  accounts: [],   // [{ id, label, note, platform, addedAt }]
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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const base = defaults();
    return {
      ...base, ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      cache: parsed.cache || {},
      history: parsed.history || {},
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    };
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

export const getState = () => state;
export const getAccounts = () => state.accounts;
export const getSettings = () => state.settings;
export const getEntry = (id) => state.cache[id] || null;
export const getHistory = (id) => state.history[id] || [];

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

export function addAccount({ id, label = '', note = '' }) {
  const clean = normalizeTag(id);
  if (!clean) return { added: false, reason: 'empty' };
  if (state.accounts.some((a) => a.id.toLowerCase() === clean.toLowerCase()))
    return { added: false, reason: 'duplicate' };
  state.accounts.push({ id: clean, label, note, addedAt: Date.now() });
  save();
  return { added: true, id: clean };
}

export function removeAccount(id) {
  state.accounts = state.accounts.filter((a) => a.id !== id);
  delete state.cache[id];
  delete state.history[id];
  if (state.settings.anchor === id) state.settings.anchor = null;
  state.settings.group = state.settings.group.filter((g) => g !== id);
  save();
}

export function updateAccount(id, patch) {
  const acc = state.accounts.find((a) => a.id === id);
  if (acc) Object.assign(acc, patch);
  save();
}

export function moveAccount(id, delta) {
  const i = state.accounts.findIndex((a) => a.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.accounts.length) return;
  const [item] = state.accounts.splice(i, 1);
  state.accounts.splice(j, 0, item);
  save();
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
  save();
  return changes;
}

export function putError(id, error) {
  const prev = state.cache[id];
  state.cache[id] = {
    fetchedAt: Date.now(),
    ok: false,
    error: { message: error.message, kind: error.kind || 'error' },
    isPublic: prev?.isPublic ?? null,
    data: prev?.data ?? null, // keep the last good ranks visible, marked stale
  };
  save();
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
  save();
  return { added, skipped };
}

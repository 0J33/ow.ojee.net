/* ═══════════════════════════════════════════════════════════════════════════
   AIM TRACKER — API client
   Everything is server-side (server.ojee.net → MongoDB), so the roster, the
   accounts, the characters and every score are the same for everyone, on
   every device. The last good copy is cached locally: the page still opens
   when the API is down, marked as offline.
   ═══════════════════════════════════════════════════════════════════════════ */

const BASE = 'https://server.ojee.net/api/ow';
const CACHE_KEY = 'ow.aim:v1';

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeCache = (data) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* full/blocked */ }
};

async function request(path, opts = {}) {
  // A request that never answers must not hang the page: fifteen seconds and
  // the caller gets an error, which turns into the cached copy plus an
  // offline banner rather than a spinner forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      signal: opts.signal || ctrl.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The API did not answer in time');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const owApi = {
  /** All players + scores. Returns { players, scores, offline? }. */
  async loadData() {
    try {
      const data = await request('/data');
      if (data._dbError) throw new Error('database unavailable');
      writeCache(data);
      return { ...data, offline: false };
    } catch (e) {
      const cached = readCache();
      if (cached) return { ...cached, offline: true };
      return { players: [], scores: [], offline: true, error: e.message };
    }
  },

  async savePlayer(player) {
    return request('/players', { method: 'POST', body: JSON.stringify(player) });
  },

  async deletePlayer(id) {
    return request(`/players/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async addScore(score) {
    return request('/scores', { method: 'POST', body: JSON.stringify(score) });
  },

  async updateScore(id, score) {
    return request(`/scores/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ score }) });
  },

  async deleteScore(id) {
    return request(`/scores/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async importData(password, data) {
    return request('/import', {
      method: 'POST',
      body: JSON.stringify({
        password,
        players: data.players,
        scores: data.scores,
      }),
    });
  },
};

export const exportData = (data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ow-aim-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const parseImportFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.players && data.scores) resolve(data);
        else reject(new Error('Invalid data format'));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

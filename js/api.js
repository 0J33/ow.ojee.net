/* ═══════════════════════════════════════════════════════════════════════════
   OVERFAST API CLIENT
   https://overfast-api.tekrop.fr  — scrapes Blizzard career profiles.
   CORS is open (access-control-allow-origin: *) so this runs fully in-browser,
   which is what lets the whole app be a static GitHub Pages site.

   Live-instance limits: 30 req/s per IP, 10 simultaneous connections.
   We stay far under both with a small concurrency pool.
   ═══════════════════════════════════════════════════════════════════════════ */

export const API_BASE = 'https://overfast-api.tekrop.fr';
export const CAREER_URL = (id) =>
  `https://overwatch.blizzard.com/en-us/career/${encodeURIComponent(id)}/`;

const MAX_CONCURRENT = 5;

/** "Name#1234" / "name #1234" / "Name-1234" -> "Name-1234" (the API's id form). */
export function normalizeTag(input) {
  return String(input || '').trim().replace(/\s+/g, '').replace(/#/g, '-');
}

/** True for a complete BattleTag we can look up directly, no search needed. */
export const isFullTag = (input) => /^[^\-\s#]{2,}-\d{3,}$/.test(normalizeTag(input));

export const displayTag = (id) => String(id || '').replace(/-(\d+)$/, '#$1');

/**
 * Human-readable BattleTag, or null when the id is one of Blizzard's opaque
 * profile hashes (which is what a name search returns instead of a tag).
 */
export const prettyTag = (id) => (isFullTag(id) ? displayTag(id) : null);

export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'error', retryAfter = null, profile = null } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;             // 'notfound' | 'unlisted' | 'throttled' | 'network' | 'error'
    this.retryAfter = retryAfter; // seconds, when Blizzard is rate-limiting
    this.profile = profile;       // search record, when the account exists but has no career page
  }
}

async function request(path, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Network error — could not reach the API', { kind: 'network' });
  }

  if (res.ok) return res.json();

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  const detail = body?.error?.error || body?.error || body?.detail;

  if (res.status === 404) {
    throw new ApiError('Player not found — check the BattleTag spelling', {
      status: 404, kind: 'notfound', retryAfter: body?.error?.retry_after ?? null,
    });
  }
  if ([429, 500, 502, 503, 504].includes(res.status)) {
    throw new ApiError('The API is busy or Blizzard is rate-limiting it — try again shortly', {
      status: res.status, kind: 'throttled', retryAfter: body?.error?.retry_after ?? 30,
    });
  }
  throw new ApiError(
    typeof detail === 'string' ? detail : `API error ${res.status}`,
    { status: res.status }
  );
}

/** Career summary: identity, endorsement, and the four ranks per platform. */
export const fetchSummary = (playerId, opts) =>
  request(`/players/${encodeURIComponent(playerId)}/summary`, opts);

/**
 * Search by nickname or full BattleTag.
 * Only the search endpoint reports `is_public`, which is how we tell
 * "private profile" apart from "played no competitive".
 */
export async function searchPlayers(name, { limit = 20, offset = 0, signal } = {}) {
  const q = new URLSearchParams({ name: String(name).trim(), limit, offset });
  return request(`/players?${q}`, { signal });
}

export async function lookupVisibility(playerId, opts) {
  try {
    const res = await searchPlayers(displayTag(playerId).split('#')[0], { limit: 20, ...opts });
    const hit = res.results?.find((r) => r.player_id === playerId);
    return hit ? !!hit.is_public : null;
  } catch {
    return null; // visibility is a nicety; never fail a refresh over it
  }
}

/** Run tasks with bounded concurrency, resolving to settled results in order. */
export async function pool(items, worker, limit = MAX_CONCURRENT) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { results[i] = { ok: true, value: await worker(items[i], i) }; }
      catch (error) { results[i] = { ok: false, error }; }
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Resolve a player to their career summary, working around a real quirk:
 * a profile can be present in Blizzard's search index while its career page
 * 404s. When the BattleTag lookup fails we re-check via search to tell three
 * cases apart, because they need completely different answers from the user:
 *
 *   · search finds nothing            -> the BattleTag is wrong
 *   · search finds them, page 404s    -> profile exists but isn't published
 *                                        (private, in practice)
 *   · an alternate id form works      -> use it from now on
 *
 * @returns {{ data:object, resolvedId:string }}
 */
export async function resolvePlayer(id, opts) {
  try {
    return { data: await fetchSummary(id, opts), resolvedId: id };
  } catch (err) {
    if (err.kind !== 'notfound') throw err;

    // Search wants the dash form ("Name-1234"), not the display form.
    const name = displayTag(id).split('#')[0];
    let hit = null;
    try {
      const res = await searchPlayers(id, { limit: 5, ...opts });
      // Only trust an exact match — a typo'd tag must not silently resolve
      // to some other player who happens to share the name.
      hit = res.results?.find(
        (r) => r.player_id === id || r.blizzard_id === id ||
               r.name?.toLowerCase() === name.toLowerCase()
      ) || null;
      if (!hit) {
        const byName = await searchPlayers(name, { limit: 50, ...opts });
        hit = byName.results?.find((r) => r.blizzard_id === id || r.player_id === id) || null;
      }
    } catch { /* fall through to the original not-found */ }

    if (!hit) throw err;

    // The account is real. Try the other id form before concluding anything.
    const alternates = [hit.player_id, hit.blizzard_id].filter((x) => x && x !== id);
    for (const alt of alternates) {
      try {
        return { data: await fetchSummary(alt, opts), resolvedId: alt };
      } catch { /* try the next form */ }
    }

    // The account is in Blizzard's index but has no career page. Blizzard's own
    // site 404s these rather than showing a "profile is private" page, so the
    // cause is genuinely ambiguous — say so instead of guessing confidently.
    throw new ApiError(
      hit.is_public === false
        ? 'Career profile is set to private'
        : 'Blizzard has no public career page for this account',
      { status: 404, kind: 'unlisted', profile: hit }
    );
  }
}

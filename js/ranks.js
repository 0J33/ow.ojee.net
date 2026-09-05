/* ═══════════════════════════════════════════════════════════════════════════
   RANK MATH + COMPETITIVE GROUPING RULES
   ═══════════════════════════════════════════════════════════════════════════

   Overwatch 2 competitive skill is (division, tier):
     - division  = Bronze .. Champion   (API calls Champion "ultimate")
     - tier      = 1..5 INSIDE the division, LOWER IS BETTER (Gold 1 > Gold 5)

   A "Skill Division" in Blizzard's grouping rules is one of those 5-per-rank
   steps, so the whole ladder is a flat 0..39 scale. All gap math uses that.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ROLES = [
  { key: 'tank',    label: 'Tank',    short: 'TANK', color: '#5B9BD5' },
  { key: 'damage',  label: 'Damage',  short: 'DPS',  color: '#E05D44' },
  { key: 'support', label: 'Support', short: 'SUP',  color: '#58D68D' },
  { key: 'open',    label: 'Open Q',  short: 'OPEN', color: '#F99E1A' },
];

/* Ordered low -> high. `ultimate` is what the API returns for Champion. */
export const DIVISIONS = [
  { key: 'bronze',      label: 'Bronze',      color: '#B9743B' },
  { key: 'silver',      label: 'Silver',      color: '#B6C0CC' },
  { key: 'gold',        label: 'Gold',        color: '#F0C674' },
  { key: 'platinum',    label: 'Platinum',    color: '#6FD3D8' },
  { key: 'emerald',     label: 'Emerald',     color: '#3FBF7F' },
  { key: 'diamond',     label: 'Diamond',     color: '#7FA9F5' },
  { key: 'master',      label: 'Master',      color: '#E8B44A' },
  { key: 'grandmaster', label: 'Grandmaster', color: '#E8734A' },
  { key: 'ultimate',    label: 'Champion',    color: '#E05A9B' },
];

const DIV_INDEX = Object.fromEntries(DIVISIONS.map((d, i) => [d.key, i]));
export const TIERS_PER_DIVISION = 5;

export const divisionMeta = (key) =>
  DIVISIONS[DIV_INDEX[key]] || { key, label: key || 'Unranked', color: '#94A3B8' };

/* Flat 0..39 ladder position. Bronze 5 = 0, Champion 1 = 39. */
export function skillDivision(rank) {
  if (!rank || !(rank.division in DIV_INDEX)) return null;
  const tier = Math.min(5, Math.max(1, rank.tier || 5));
  return DIV_INDEX[rank.division] * TIERS_PER_DIVISION + (TIERS_PER_DIVISION - tier);
}

export const rankLabel = (rank) =>
  rank ? `${divisionMeta(rank.division).label} ${rank.tier}` : 'Unranked';

export const rankShort = (rank) =>
  rank ? `${divisionMeta(rank.division).label.slice(0, 2).toUpperCase()}${rank.tier}` : '—';

/* Gap in Skill Divisions between two ranks. null if either is unranked. */
export function divisionGap(a, b) {
  const x = skillDivision(a), y = skillDivision(b);
  if (x === null || y === null) return null;
  return Math.abs(x - y);
}

/* ─── Grouping rules ──────────────────────────────────────────────────────────
   Blizzard's Season 10+ "wide group" system. A group is always ALLOWED to
   queue; the question is whether it queues as a normal (narrow) group or as a
   wide group -- wide groups only face other wide groups, wait longer, and earn
   reduced rank progress.

     · all Diamond or below  -> wide when more than 5 Skill Divisions apart
     · anyone Master         -> wide when more than 3 Skill Divisions apart
     · anyone GM or Champion -> always wide, at any gap
     · Grandmaster+          -> group size is capped at 2 players

   Thresholds live in one object so a season change is a one-line edit.
   ────────────────────────────────────────────────────────────────────────── */
export const RULES = {
  maxNarrowGapDefault: 5,   // everyone Diamond or below
  maxNarrowGapMaster: 3,    // any Master in the group
  alwaysWideFrom: 'grandmaster',
  stackCapFrom: 'grandmaster',
  stackCap: 2,
};

const atLeast = (rank, divisionKey) =>
  rank && DIV_INDEX[rank.division] >= DIV_INDEX[divisionKey];

/**
 * Classify a set of ranks (one role, one platform) as a queue group.
 * Ranks may contain nulls for unranked players -- those are reported
 * separately rather than silently ignored, because an unplaced player
 * cannot group with Diamond+ at all.
 *
 * @returns {{
 *   status:'narrow'|'wide'|'unknown', gap:number|null, threshold:number|null,
 *   low:object|null, high:object|null, reason:string,
 *   overCap:boolean, unrankedCount:number, ranked:number
 * }}
 */
export function classifyGroup(ranks) {
  const present = ranks.filter(Boolean);
  const unrankedCount = ranks.length - present.length;

  if (present.length === 0) {
    return { status: 'unknown', gap: null, threshold: null, low: null, high: null,
             reason: 'No ranks to compare', overCap: false, unrankedCount, ranked: 0 };
  }

  const sorted = [...present].sort((a, b) => skillDivision(a) - skillDivision(b));
  const low = sorted[0], high = sorted[sorted.length - 1];
  const gap = skillDivision(high) - skillDivision(low);

  const hasTop = present.some((r) => atLeast(r, RULES.alwaysWideFrom));
  const hasMaster = present.some((r) => r.division === 'master');
  const overCap = present.some((r) => atLeast(r, RULES.stackCapFrom)) &&
                  ranks.length > RULES.stackCap;

  if (present.length === 1) {
    return { status: 'narrow', gap: 0, threshold: null, low, high,
             reason: 'Only one ranked player', overCap, unrankedCount, ranked: 1 };
  }

  if (hasTop) {
    return { status: 'wide', gap, threshold: 0, low, high, overCap, unrankedCount,
             ranked: present.length,
             reason: 'Any group containing a Grandmaster or Champion is a wide group' };
  }

  const threshold = hasMaster ? RULES.maxNarrowGapMaster : RULES.maxNarrowGapDefault;
  const wide = gap > threshold;
  return {
    status: wide ? 'wide' : 'narrow',
    gap, threshold, low, high, overCap, unrankedCount, ranked: present.length,
    reason: wide
      ? `${gap} skill divisions apart — over the ${threshold} allowed for ${hasMaster ? 'a group with a Master' : 'Diamond and below'}`
      : `${gap} of ${threshold} skill divisions apart`,
  };
}

/* Pairwise convenience used by the anchor comparison view. */
export const compareRanks = (a, b) => classifyGroup([a, b]);

/* Sort key: highest rank a player holds in any role, for list ordering. */
export function peakSkill(competitive) {
  if (!competitive) return -1;
  return ROLES.reduce((best, r) => {
    const v = skillDivision(competitive[r.key]);
    return v === null ? best : Math.max(best, v);
  }, -1);
}

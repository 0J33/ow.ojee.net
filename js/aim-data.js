/* ═══════════════════════════════════════════════════════════════════════════
   AIM TRACKER — data: heroes, drills, roster helpers
   Carried over from ojee.net/ow, minus the API layer (that lives in
   aim-api.js) and minus anything React-shaped.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HEROES = {
  ana: { name: 'Ana', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/985b06beae46b7ba3ca87d1512d0fc62ca7f206ceca58ef16fc44d43a1cc84ed.png' },
  anran: { name: 'Anran', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/2cdf460c6080a031258e513713d1d635a8e68799cb5d7e27774be8963e95f6a3.png' },
  ashe: { name: 'Ashe', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/4076bbaa2eb52a0bfe612434071e56e7702d5454473dbbea2f9e392a9d997a94.png' },
  baptiste: { name: 'Baptiste', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/d4e6f1ca45d9f88fa89260787397f141a6f007b14e5b26698883b6a17bab9680.png' },
  bastion: { name: 'Bastion', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/4ede795c2a681aaccfa72d0c901cba0cb8a2c292fd6a97b2ba9faed161c2d184.png' },
  brigitte: { name: 'Brigitte', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/795fba91376d87d441a7f359ae12a3175dfa95825ccc4414cc6b95b129fc4cb0.png' },
  cassidy: { name: 'Cassidy', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/9240cd64cc8ef58df9acbf55204ab1b5d8578f743fda5931f0dbccbd75ab841b.png' },
  domina: { name: 'Domina', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/1161c112292c56c052c0ae711792fcde06e3251b98bc9709e582dd7585b5dcd6.png' },
  dva: { name: 'D.Va', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/df5a5532862d9292634fb3dc0e51a4705aa601de65e5e815513ccc663d84de56.png' },
  doomfist: { name: 'Doomfist', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ff5c54f43ad253c7faeda9c4ed31d42582ea6b19205d197866f3dd0c0aa14c16.png' },
  echo: { name: 'Echo', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/d4f2d5b0c2b7e82d61353186c5f23152ccba9d3569b50839aa580dca3e9114ba.png' },
  emre: { name: 'Emre', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/c51e2f698138861c0e3b6cfab3c3ca9d67fd709be175e7c397aa6f2649712a30.png' },
  freja: { name: 'Freja', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/811963897c352d9f178bec882d94bd0281074feee7c429c5145b6b8ea8ebe862.png' },
  genji: { name: 'Genji', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/156b12c20b1aea872c1eeb5bb37a7de1047b2ab30ecefd0663a8925badde1ea8.png' },
  hanzo: { name: 'Hanzo', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/78b61c3e806fb26b02b8980fba62189155074fc15bd865b0883268e546030be5.png' },
  hazard: { name: 'Hazard', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ca48b96dbae6ea7f58ce8a5e73513c8c62b1685bdbf258020fb78bb21a008b5f.png' },
  illari: { name: 'Illari', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ce42d1455e03e79f321345fea84b27a8918b5db8bd7ab9b2ca9e569606ede9e4.png' },
  'jetpack-cat': { name: 'Jetpack Cat', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/03a184cd0de27091e0099ac22635ad9615a8f6997881a5c25cc5f2444764f729.png' },
  'junker-queen': { name: 'Junker Queen', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/06eeecb359f311f43a8f5121d4f9f3a93c565d70b30e94ef543c05596c9a39dc.png' },
  junkrat: { name: 'Junkrat', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/7660b9fc6f25f30858fdd8797fe0d52b2306f1e78fef99843f58a274e69af046.png' },
  juno: { name: 'Juno', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/c0167d251e57b0aa2b1e16c37d87f0e7c77263db9dd0503d77b5f2589bf3e4a0.png' },
  kiriko: { name: 'Kiriko', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/408603fe037e8576078eaac5eab2fb251489ced4003b11f5f522776d43d0b83d.png' },
  lifeweaver: { name: 'Lifeweaver', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/3376515cebed0904012e67e956f6d1b9c12e03da642845eeaf787b7e4c7b339d.png' },
  lucio: { name: 'Lúcio', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/040bb13f5123ab93faad2f95627ba184608aef4b2469a4d3003859c7087df044.png' },
  mauga: { name: 'Mauga', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/33d39bb439c08975197fc52eff4874716839711b5356c4fdc174f9c24bac1d0e.png' },
  mei: { name: 'Mei', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/4a55ced3bd597fb08e0fde9dc007f8543ac616ba98ca3db9b0e4d871a8ae17f8.png' },
  mercy: { name: 'Mercy', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/3bfb8bd8ec827e53d870f1238ab73d8aa1f5dbfbcfaaf7f96ffcd35b5c6102ab.png' },
  mizuki: { name: 'Mizuki', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/a9733c2367e0cbd70b9316fd2e1e17028653ec56d0051ea6ff098531dc4f99fc.png' },
  moira: { name: 'Moira', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/f48f8485056d5d00dad195859188d23e50f7126b8b08b5646f46ef1b42f5e1de.png' },
  orisa: { name: 'Orisa', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/a73958a28551f5254f3ab3f97c5f5f8d698a95c0b6a515d1a2b1caac169205a6.png' },
  pharah: { name: 'Pharah', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/60ac2d5de4a6d34644d8872233da402f1436c87f804bb11a21661bb30bf4a51f.png' },
  ramattra: { name: 'Ramattra', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ddef7c9fb8ce4256e8508196b486f81950efe7aaa6cf27fec4668beb4cd15774.png' },
  reaper: { name: 'Reaper', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/dc6ff07ac790c00dc95a40882449617bb6e0e38906b353a630cffe0c815270a9.png' },
  reinhardt: { name: 'Reinhardt', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/551fbe070c16fdfcc17f7f1de63af22c53e7d2f1340fc2f3172441504527bc4e.png' },
  roadhog: { name: 'Roadhog', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/89ddf07e4b619ed96169042e296a1b8856d102746f35add88284b44a9a5a6a03.png' },
  sigma: { name: 'Sigma', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/a4c032fa466c9a6d9c6974747635d7ef910027f91cd58892af0c899db565f92d.png' },
  sojourn: { name: 'Sojourn', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/82b8c1b8765dcb9a0ba16e343c3516bf324c771ac81e9878473280216e70a889.png' },
  'soldier-76': { name: 'Soldier: 76', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/c93b5f0a528c40473188f77cc2a267aee7d5b6cf5c9e104105d634b4388674e2.png' },
  sombra: { name: 'Sombra', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/47727b02a16e3bd7b2447d86ae1edf11587bc320b2aecb4f2f16a7ca4ad4e8a0.png' },
  symmetra: { name: 'Symmetra', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ebec57e8bd68b3d4383edfeb34f8f52dd0b94a6467d594c2fee722e8a97c32aa.png' },
  torbjorn: { name: 'Torbjörn', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/ce17118cedc29b0d2ac1e059666bed36b9531c85079b0b894bb402d12c917ba9.png' },
  tracer: { name: 'Tracer', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/4504f6f15cb3feaa92ecd38e01dcf751cb5abdac2e0bb52d0555727e53277502.png' },
  vendetta: { name: 'Vendetta', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/cf8ffb52b6f315546d5e94e9d6defad5a2c570798776956de23f47536f9529da.png' },
  venture: { name: 'Venture', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/dcab9123f5f55df22e54d4e797de43c71b917e0149dd059a7fd6136f48464cd0.png' },
  widowmaker: { name: 'Widowmaker', role: 'damage', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/6e4702b45f196aaf51555cf57327322721f45458b17f5f0643ed008a88378259.png' },
  winston: { name: 'Winston', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/46a10db3aa908c590ddc4e7606376a88143d1f1306ecfbea043263040f9529a5.png' },
  'wrecking-ball': { name: 'Wrecking Ball', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/9ef1d58867136e0b26f928d896000b9dab216118f6e2f59e53f2e975e1e27afa.png' },
  wuyang: { name: 'Wuyang', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/4959500b495b35c0908be2abda56b53f2601b2c5cc39a1cfde8df1bffd38d66d.png' },
  zarya: { name: 'Zarya', role: 'tank', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/9b6f63cc66ddf9d5e0862173c733cc0d2e574c5c89357798d91b93b2f95a7080.png' },
  zenyatta: { name: 'Zenyatta', role: 'support', portrait: 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/7d1546b1541a8afc39353f9337a408d6275a141b0432b7e560ef61579996b0fc.png' },
};

/* ─── Live roster ───────────────────────────────────────────────────────────
   The table above is the offline floor, not the ceiling: Blizzard ships new
   heroes and this list used to go stale until someone edited it by hand.
   refreshHeroes() folds whatever OverFast reports into HEROES at runtime —
   names, portraits and roles for everyone — so a new hero shows up the first
   time the page opens after their release. The last fetch is cached, so the
   grid is never empty while the API naps. */
const HERO_CACHE_KEY = 'ow.aim:heroes';
const HERO_LIST_URL = 'https://overfast-api.tekrop.fr/heroes';

function mergeHeroes(list) {
  const added = [];
  for (const h of list || []) {
    if (!h || !h.key || !h.name) continue;
    const rec = {
      name: h.name,
      portrait: h.portrait || HEROES[h.key]?.portrait || '',
      role: (h.role && ROLES[h.role]) ? h.role : (HEROES[h.key]?.role || 'damage'),
    };
    if (!HEROES[h.key]) added.push(h.key);
    HEROES[h.key] = { ...HEROES[h.key], ...rec };
  }
  return added;
}

/** Read the cache immediately so the first paint already has every hero. */
export function hydrateHeroesFromCache() {
  try {
    const raw = localStorage.getItem(HERO_CACHE_KEY);
    if (!raw) return [];
    return mergeHeroes(JSON.parse(raw).list);
  } catch { return []; }
}

/** Fetch the live roster, merge it in, and report which heroes were new. */
export async function refreshHeroes({ timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(HERO_LIST_URL, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`heroes ${res.status}`);
    const list = await res.json();
    const added = mergeHeroes(list);
    try {
      localStorage.setItem(HERO_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), list }));
    } catch { /* private mode: this visit still got the merge */ }
    return added;
  } finally {
    clearTimeout(timer);
  }
}

export const ROLES = {
  tank: { name: 'Tank', color: '#5B9BD5' },
  damage: { name: 'Damage', color: '#E05D44' },
  support: { name: 'Support', color: '#58D68D' },
};

export const DRILL_CATEGORIES = [
  { key: 'horizontal_bots', label: 'Horizontal / Training Bots' },
  { key: 'player_strafe', label: 'Player Strafe / Training Bots' },
  { key: 'vertical_bots', label: 'Vertical / Training Bots' },
  { key: 'horizontal_bullseye', label: 'Horizontal / Bullseye' },
  { key: 'vertical_bullseye', label: 'Vertical / Bullseye' },
  { key: 'stationary_bullseye', label: 'Stationary / Bullseye' },
  { key: 'arc_bots', label: 'Arc / Training Bots' },
];

export const CATEGORY_COLORS = {
  horizontal_bots: '#F99E1A',
  player_strafe: '#3B82F6',
  vertical_bots: '#22C55E',
  horizontal_bullseye: '#EF4444',
  vertical_bullseye: '#A855F7',
  stationary_bullseye: '#EC4899',
  arc_bots: '#14B8A6',
};

export const DRILLS = {
  '40m_horizontal': { name: '40M / Horizontal / Training Bots', category: 'horizontal_bots', heroes: ['widowmaker'] },
  '30m_horizontal': { name: '30M / Horizontal / Training Bots', category: 'horizontal_bots', heroes: ['ashe'] },
  '20m_horizontal': { name: '20M / Horizontal / Training Bots', category: 'horizontal_bots', heroes: ['cassidy', 'illari', 'torbjorn', 'orisa', 'hanzo'] },
  '10m_horizontal': { name: '10M / Horizontal / Training Bots', category: 'horizontal_bots', heroes: ['cassidy', 'illari', 'echo', 'ramattra', 'mizuki'] },
  '20m_player_strafe': {
    name: '20M / Player Strafe / Training Bots', category: 'player_strafe',
    heroes: ['mauga', 'soldier-76', 'baptiste', 'bastion', 'juno', 'zenyatta', 'kiriko', 'emre', 'domina', 'sojourn'],
    heroNotes: { domina: { text: 'Extended Power', icon: 'https://owperks.com/perks-icons/extended_power.webp' } },
  },
  '10m_player_strafe': { name: '10M / Player Strafe / Training Bots', category: 'player_strafe', heroes: ['genji'] },
  '5m_player_strafe': { name: '5M / Player Strafe / Training Bots', category: 'player_strafe', heroes: ['anran'] },
  '10m_vertical': { name: '10M / Vertical / Training Bots', category: 'vertical_bots', heroes: ['pharah'] },
  '40m_horizontal_bullseye': { name: '40M / Horizontal / Bullseye', category: 'horizontal_bullseye', heroes: ['ana'] },
  '40m_vertical_bullseye': { name: '40M / Vertical / Bullseye', category: 'vertical_bullseye', heroes: ['ana'] },
  '20m_vertical_bullseye': { name: '20M / Vertical / Bullseye', category: 'vertical_bullseye', heroes: ['hanzo'] },
  '20m_stationary_bullseye': { name: '20M / Stationary / Bullseye', category: 'stationary_bullseye', heroes: ['mei', 'cassidy', 'zenyatta', 'kiriko'] },
  '30m_arc': { name: '30M / Arc / Training Bots', category: 'arc_bots', heroes: ['freja'] },
  '20m_arc': { name: '20M / Arc / Training Bots', category: 'arc_bots', heroes: ['wuyang'] },
  '5m_arc': { name: '5M / Arc / Training Bots', category: 'arc_bots', heroes: ['tracer'] },
};

export const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#F06414', '#FF6B6B', '#EE5A24',
  '#FFC312', '#F9CA24', '#A3CB38', '#009432', '#1289A7',
  '#0652DD', '#6F1E51', '#ED4C67', '#FDA7DF', '#12CBC4',
  '#1B1464', '#006266', '#C4E538', '#EA2027', '#B53471',
  '#9980FA', '#D980FA', '#00D2D3', '#48DBFB', '#FF9FF3',
  '#FECA57', '#54A0FF',
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const getHeroesByRole = () => {
  const grouped = { tank: [], damage: [], support: [] };
  Object.entries(HEROES).forEach(([key, hero]) => {
    if (grouped[hero.role]) grouped[hero.role].push({ key, ...hero });
  });
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
  return grouped;
};

/* WCAG relative luminance — the naive 0.299/0.587/0.114 average reads far
   kinder than the contrast formula does, so it let mid-dark player colours
   through at ~2.7:1. Threshold 0.24 clears 4.5:1 on every panel here. */
const relLum = (r, g, b) => {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** A readable text color for a player color on dark backgrounds. */
export const getReadableColor = (hex) => {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#E6ECF5';
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  if (relLum(r, g, b) >= 0.24) return hex;
  // Mix toward white (keeps the hue) until the text clears the bar.
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mr = Math.round(r + (255 - r) * t);
    const mg = Math.round(g + (255 - g) * t);
    const mb = Math.round(b + (255 - b) * t);
    if (relLum(mr, mg, mb) >= 0.24) {
      return '#' + [mr, mg, mb].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }
  return '#FFFFFF';
};

export const getColorShadow = (hex) => {
  if (!hex) return 'none';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.75) return '0 0 4px rgba(0,0,0,.8), 0 1px 2px rgba(0,0,0,.9)';
  if (lum < 0.25) return '0 0 6px rgba(255,255,255,.35)';
  return 'none';
};

export const getScoreColor = (score, min, max) => {
  if (min === max) return '#F99E1A';
  const ratio = (score - min) / (max - min);
  if (ratio >= 0.66) return '#22C55E';
  if (ratio >= 0.33) return '#EAB308';
  return '#EF4444';
};

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** BattleTag "Name#1234" / "Name-1234" -> "Name-1234" (Blizzard's id form). */
export const normalizeAccountId = (input) =>
  String(input || '').trim().replace(/\s+/g, '').replace(/#/g, '-');

export const displayAccountId = (id) => String(id || '').replace(/-(\d+)$/, '#$1');

export const isFullAccountTag = (input) => /^[^\-\s#]{2,}-\d{3,}$/.test(normalizeAccountId(input));

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

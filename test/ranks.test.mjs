/* Grouping rules are the one part of this app that is wrong silently: a bad
   verdict still looks like a confident answer. Run with `node test/ranks.test.mjs`. */
import {
  skillDivision, classifyGroup, compareRanks, divisionGap, rankLabel, peakSkill,
} from '../js/ranks.js';

const R = (division, tier) => ({ division, tier });
let failed = 0;

const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.log(`FAIL  ${name}\n      got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`ok    ${name} = ${JSON.stringify(got)}`);
};

/* ── Ladder: 9 divisions x 5 tiers, tier 1 is best ─────────────────────────── */
eq('bronze 5 is the floor',        skillDivision(R('bronze', 5)), 0);
eq('bronze 1',                     skillDivision(R('bronze', 1)), 4);
eq('silver 5 follows bronze 1',    skillDivision(R('silver', 5)), 5);
eq('gold 3',                       skillDivision(R('gold', 3)), 12);
eq('champion 1 is the ceiling',    skillDivision(R('ultimate', 1)), 44);
eq('unranked has no position',     skillDivision(null), null);
eq('champion renders as Champion', rankLabel(R('ultimate', 2)), 'Champion 2');

/* ── Blizzard's own worked example ─────────────────────────────────────────── */
eq('bronze5 vs gold4 gap',   divisionGap(R('bronze', 5), R('gold', 4)), 11);
eq('bronze5 vs gold4 wide',  compareRanks(R('bronze', 5), R('gold', 4)).status, 'wide');

/* ── Diamond and below: 5 divisions narrow, 6 wide ─────────────────────────── */
eq('gap of 5 stays narrow', compareRanks(R('gold', 3), R('platinum', 3)).status, 'narrow');
eq('gap of 5 measured',     compareRanks(R('gold', 3), R('platinum', 3)).gap, 5);
eq('gap of 6 goes wide',    compareRanks(R('gold', 3), R('platinum', 2)).status, 'wide');
eq('emerald sits above platinum',
   skillDivision(R('emerald', 5)) > skillDivision(R('platinum', 1)), true);

/* ── A Master in the group tightens the limit to 3 ─────────────────────────── */
eq('master gap 2 narrow',        compareRanks(R('master', 3), R('master', 1)).status, 'narrow');
eq('master gap 4 wide',          compareRanks(R('master', 5), R('master', 1)).status, 'wide');
eq('master threshold is 3',      compareRanks(R('master', 5), R('master', 1)).threshold, 3);
eq('one master tightens a pair', compareRanks(R('diamond', 1), R('master', 5)).threshold, 3);

/* ── Grandmaster and Champion are always wide, and capped at 2 ─────────────── */
eq('identical GMs still wide',   compareRanks(R('grandmaster', 3), R('grandmaster', 3)).status, 'wide');
eq('identical champions wide',   compareRanks(R('ultimate', 1), R('ultimate', 1)).status, 'wide');
eq('GM pair within cap',
   classifyGroup([R('grandmaster', 3), R('grandmaster', 3)]).overCap, false);
eq('GM trio over cap',
   classifyGroup([R('grandmaster', 3), R('grandmaster', 3), R('grandmaster', 3)]).overCap, true);

/* ── Groups use the widest spread; unranked members are reported ───────────── */
const five = classifyGroup([R('gold', 5), R('gold', 1), R('platinum', 3), null, R('silver', 1)]);
eq('group spans silver1..plat3', five.gap, 8);
eq('group is wide',              five.status, 'wide');
eq('unranked counted',           five.unrankedCount, 1);
eq('ranked counted',             five.ranked, 4);
eq('all unranked is unknown',    classifyGroup([null, null]).status, 'unknown');
eq('single ranked is not a verdict', classifyGroup([R('gold', 1), null]).ranked, 1);

/* ── Sorting uses a player's best role ─────────────────────────────────────── */
eq('peak picks the highest role',
   peakSkill({ tank: R('gold', 3), damage: null, support: R('diamond', 5), open: null }),
   skillDivision(R('diamond', 5)));
eq('peak of nothing', peakSkill(null), -1);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);

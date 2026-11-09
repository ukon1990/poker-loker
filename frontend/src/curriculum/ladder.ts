import { type Card, cards } from '@/engine/core/cards';
import { CATEGORY_NAMES, handName, ROYAL_FLUSH } from '@/engine/eval/describe';
import { categoryOf, HandCategory, type HandRank, rankFive } from '@/engine/eval/rank';

export type LadderGroup = 'small' | 'strong' | 'monster';

/** One step of the hand rankings. */
export interface Rung {
  termId: string;
  name: string;
  /** The name as it reads inside a sentence, such as "a flush". */
  phrase: string;
  group: LadderGroup;
  /** A few words on what makes this hand. */
  tag: string;
  /** What this hand needs, to finish the sentence "A flush needs ...". */
  rule: string;
  /** Ways to make exactly this hand from five cards of a standard deck. */
  combos: number;
  /** A tidy example, in order and with matching cards together. */
  sample: readonly Card[];
}

export const LADDER_GROUPS: readonly { id: LadderGroup; label: string }[] = [
  { id: 'small', label: 'Small hands' },
  { id: 'strong', label: 'Strong hands' },
  { id: 'monster', label: 'Monsters' },
];

const FIVE_CARD_HANDS = 2_598_960;

/** The ten hands as they are taught, weakest first. */
export const LADDER: readonly Rung[] = [
  {
    termId: 'high-card',
    name: CATEGORY_NAMES[HandCategory.HighCard],
    phrase: 'high card',
    group: 'small',
    tag: 'Nothing matches',
    rule: 'no matching ranks, no run, and not all one suit',
    combos: 1_302_540,
    sample: cards('Ad Js 8h 5c 2s'),
  },
  {
    termId: 'pair',
    name: CATEGORY_NAMES[HandCategory.Pair],
    phrase: 'a pair',
    group: 'small',
    tag: '2 of a rank',
    rule: 'two cards of the same rank',
    combos: 1_098_240,
    sample: cards('Ks Kd 9h 6c 3s'),
  },
  {
    termId: 'two-pair',
    name: CATEGORY_NAMES[HandCategory.TwoPair],
    phrase: 'two pair',
    group: 'small',
    tag: '2 + 2 of a rank',
    rule: 'two different pairs',
    combos: 123_552,
    sample: cards('Js Jd 4h 4c 9s'),
  },
  {
    termId: 'three-of-a-kind',
    name: CATEGORY_NAMES[HandCategory.ThreeOfAKind],
    phrase: 'three of a kind',
    group: 'small',
    tag: '3 of a rank',
    rule: 'three cards of the same rank',
    combos: 54_912,
    sample: cards('8s 8d 8h Kc 3s'),
  },
  {
    termId: 'straight',
    name: CATEGORY_NAMES[HandCategory.Straight],
    phrase: 'a straight',
    group: 'strong',
    tag: '5 in a row',
    rule: 'five cards in a row',
    combos: 10_200,
    sample: cards('5c 6d 7h 8s 9c'),
  },
  {
    termId: 'flush',
    name: CATEGORY_NAMES[HandCategory.Flush],
    phrase: 'a flush',
    group: 'strong',
    tag: '5 of one suit',
    rule: 'five cards of one suit',
    combos: 5_108,
    sample: cards('2h 6h 9h Jh Kh'),
  },
  {
    termId: 'full-house',
    name: CATEGORY_NAMES[HandCategory.FullHouse],
    phrase: 'a full house',
    group: 'strong',
    tag: '3 + 2 of a rank',
    rule: 'three of one rank and two of another',
    combos: 3_744,
    sample: cards('Qs Qd Qh 7c 7s'),
  },
  {
    termId: 'four-of-a-kind',
    name: CATEGORY_NAMES[HandCategory.FourOfAKind],
    phrase: 'four of a kind',
    group: 'monster',
    tag: 'All 4 of a rank',
    rule: 'all four cards of one rank',
    combos: 624,
    sample: cards('9s 9d 9h 9c Ks'),
  },
  {
    termId: 'straight-flush',
    name: CATEGORY_NAMES[HandCategory.StraightFlush],
    phrase: 'a straight flush',
    group: 'monster',
    tag: 'In a row, one suit',
    rule: 'five cards in a row, all of one suit',
    combos: 36,
    sample: cards('5s 6s 7s 8s 9s'),
  },
  {
    termId: 'royal-flush',
    name: ROYAL_FLUSH,
    phrase: 'a royal flush',
    group: 'monster',
    tag: '10 to ace, one suit',
    rule: 'ten to ace, all of one suit',
    combos: 4,
    sample: cards('Ts Js Qs Ks As'),
  },
];

/** Other words for a hand on the ladder. */
const TERM_ALIASES: Partial<Record<string, string>> = {
  trips: 'three-of-a-kind',
  set: 'three-of-a-kind',
  quads: 'four-of-a-kind',
  wheel: 'straight',
};

export function rungForTerm(termId: string): Rung | undefined {
  const id = TERM_ALIASES[termId] ?? termId;
  return LADDER.find((rung) => rung.termId === id);
}

export function rungOfRank(rank: HandRank): Rung {
  const name = handName(rank);
  return LADDER.find((rung) => rung.name === name) as Rung;
}

/** The engine's category for a hand on the ladder. */
export function rungCategory(rung: Rung): HandCategory {
  return categoryOf(rankFive(rung.sample));
}

/** How often five random cards make this hand, such as "1 in 509". */
export function oneIn(rung: Rung): string {
  const odds = FIVE_CARD_HANDS / rung.combos;
  if (odds < 10 && Math.abs(odds - Math.round(odds)) > 0.1) return `2 in ${Math.round(odds * 2)}`;
  return `1 in ${Math.round(odds).toLocaleString('en-US')}`;
}

/** Where a hand sits, in words. Worked out from its position on the ladder. */
export function rungNote(target: Rung): string {
  const index = LADDER.indexOf(target);
  if (index === 0) return 'The weakest hand. Every other hand beats it.';
  if (index === LADDER.length - 1) return 'The strongest hand. Nothing beats it.';
  return `Beats ${LADDER[index - 1].phrase}. Loses to ${LADDER[index + 1].phrase}.`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function rungNamed(name: string): Rung | undefined {
  return LADDER.find((rung) => rung.name === name);
}

/** Weaker hands that a stronger hand also contains, by the stronger hand's glossary id. */
const CONTAINS: Partial<Record<string, readonly string[]>> = {
  'two-pair': ['pair'],
  'three-of-a-kind': ['pair'],
  'full-house': ['pair', 'two-pair', 'three-of-a-kind'],
  'four-of-a-kind': ['pair', 'three-of-a-kind'],
  'straight-flush': ['straight', 'flush'],
  'royal-flush': ['straight', 'flush', 'straight-flush'],
};

/** For someone who named a hand wrongly: what they said it was, and what it really is. */
export function wrongNameNote(pickedName: string, actual: Rung): string | undefined {
  const picked = rungNamed(pickedName);
  if (!picked || picked === actual) return undefined;
  if (CONTAINS[actual.termId]?.includes(picked.termId)) {
    return `It does contain ${picked.phrase}, but always name the strongest hand. This hand has ${actual.rule}, so it is ${actual.phrase}.`;
  }
  return `${capitalise(picked.phrase)} needs ${picked.rule}. This hand has ${actual.rule}, so it is ${actual.phrase}.`;
}

/** For someone who picked the wrong five cards. */
export function bestFiveMistake(picked: HandRank, best: HandRank): string | undefined {
  if (picked === best) return undefined;
  const pickedRung = rungOfRank(picked);
  const bestRung = rungOfRank(best);
  if (pickedRung === bestRung) {
    return `You found ${bestRung.phrase}, but higher cards were available to play with it.`;
  }
  return `Those five make ${pickedRung.phrase}, but ${bestRung.phrase} was possible.`;
}

const STEP_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Where a hand really sits compared with another, such as "A flush is two steps above a pair." */
export function stepsAwayNote(pickedName: string, from: Rung): string | undefined {
  const picked = rungNamed(pickedName);
  if (!picked) return undefined;
  const distance = LADDER.indexOf(picked) - LADDER.indexOf(from);
  const count = STEP_WORDS[Math.abs(distance)] ?? String(Math.abs(distance));
  const steps = `${count} ${Math.abs(distance) === 1 ? 'step' : 'steps'}`;
  return `${capitalise(picked.phrase)} is ${steps} ${distance > 0 ? 'above' : 'below'} ${from.phrase}.`;
}

/** The first pair put the wrong way round, given hand names from strongest to weakest. */
export function orderMistake(names: readonly string[]): string | undefined {
  const rungs = names.map(rungNamed);
  for (let index = 0; index + 1 < rungs.length; index++) {
    const upper = rungs[index];
    const lower = rungs[index + 1];
    if (upper && lower && LADDER.indexOf(upper) < LADDER.indexOf(lower)) {
      return `You put ${upper.phrase} above ${lower.phrase}, but ${lower.phrase} is stronger.`;
    }
  }
  return undefined;
}

/** Why one type of hand beats another. Empty when both are the same type. */
export function rarityNote(first: HandRank, second: HandRank): string {
  const [winner, loser] = (first > second ? [first, second] : [second, first]).map(rungOfRank);
  if (winner === loser) return '';
  return `Rarer hands win. In five random cards, ${winner.phrase} comes up about ${oneIn(winner)} times and ${loser.phrase} about ${oneIn(loser)}.`;
}

import { categoryOf, HandCategory, type HandRank } from '@/engine/eval/rank';

const SINGULAR: Record<number, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
};

const PLURAL: Record<number, string> = {
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
  7: 'sevens',
  8: 'eights',
  9: 'nines',
  10: 'tens',
  11: 'jacks',
  12: 'queens',
  13: 'kings',
  14: 'aces',
};

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High card',
  [HandCategory.Pair]: 'Pair',
  [HandCategory.TwoPair]: 'Two pair',
  [HandCategory.ThreeOfAKind]: 'Three of a kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full house',
  [HandCategory.FourOfAKind]: 'Four of a kind',
  [HandCategory.StraightFlush]: 'Straight flush',
};

/** Glossary id for each category. */
export const CATEGORY_TERMS: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'high-card',
  [HandCategory.Pair]: 'pair',
  [HandCategory.TwoPair]: 'two-pair',
  [HandCategory.ThreeOfAKind]: 'three-of-a-kind',
  [HandCategory.Straight]: 'straight',
  [HandCategory.Flush]: 'flush',
  [HandCategory.FullHouse]: 'full-house',
  [HandCategory.FourOfAKind]: 'four-of-a-kind',
  [HandCategory.StraightFlush]: 'straight-flush',
};

export function rankName(rank: number): string {
  return SINGULAR[rank];
}

export function rankNamePlural(rank: number): string {
  return PLURAL[rank];
}

/** The ranks packed into a hand rank, most significant first. */
export function tiebreaks(rank: HandRank): number[] {
  return [16, 12, 8, 4, 0].map((shift) => (rank >>> shift) & 0xf);
}

/** A short description such as "two pair, kings and nines". */
export function describeHand(rank: HandRank): string {
  const [a, b] = tiebreaks(rank);

  switch (categoryOf(rank)) {
    case HandCategory.HighCard:
      return `${SINGULAR[a]} high`;
    case HandCategory.Pair:
      return `a pair of ${PLURAL[a]}`;
    case HandCategory.TwoPair:
      return `two pair, ${PLURAL[a]} and ${PLURAL[b]}`;
    case HandCategory.ThreeOfAKind:
      return `three ${PLURAL[a]}`;
    case HandCategory.Straight:
      return `a straight to the ${SINGULAR[a]}`;
    case HandCategory.Flush:
      return `a flush, ${SINGULAR[a]} high`;
    case HandCategory.FullHouse:
      return `a full house, ${PLURAL[a]} over ${PLURAL[b]}`;
    case HandCategory.FourOfAKind:
      return `four ${PLURAL[a]}`;
    case HandCategory.StraightFlush:
      return a === 14 ? 'a royal flush' : `a straight flush to the ${SINGULAR[a]}`;
  }
}

/** The description, marked so the whole phrase links to its glossary entry. */
export function describeHandMarked(rank: HandRank): string {
  return `{${CATEGORY_TERMS[categoryOf(rank)]}|${describeHand(rank)}}`;
}

/** Why one hand beats another that has the same short description, in words. */
function firstDifference(winner: HandRank, loser: HandRank): string {
  const a = tiebreaks(winner);
  const b = tiebreaks(loser);
  const index = a.findIndex((value, i) => value !== b[i]);
  return index === -1 ? '' : `${SINGULAR[a[index]]} beats ${SINGULAR[b[index]]}`;
}

/** Explains why `winner` beats `loser`. The text marks terms for the glossary. */
export function explainWin(
  winnerName: string,
  winner: HandRank,
  loserName: string,
  loser: HandRank,
): string {
  const winnerText = describeHand(winner);
  const loserText = describeHand(loser);

  if (winnerText === loserText) {
    return `${winnerName} and ${loserName} both have ${describeHandMarked(winner)}. The {kicker} decides it: ${firstDifference(winner, loser)}.`;
  }
  return `${winnerName} has ${describeHandMarked(winner)}, which beats ${describeHandMarked(loser)}.`;
}

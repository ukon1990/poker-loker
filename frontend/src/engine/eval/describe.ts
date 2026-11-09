import { type Card, rankOf, suitOf } from '@/engine/core/cards';
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

export const ROYAL_FLUSH = 'Royal flush';

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

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

/** A card in words, such as "king of diamonds". */
export function cardName(card: Card): string {
  return `${SINGULAR[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`;
}

/** Two starting cards in words, such as "ace-king suited" or "a pair of sixes". */
export function startingHandName(hole: readonly Card[]): string {
  const [high, low] = [...hole].sort((a, b) => rankOf(b) - rankOf(a));
  if (rankOf(high) === rankOf(low)) return `a pair of ${PLURAL[rankOf(high)]}`;
  const suited = suitOf(high) === suitOf(low) ? 'suited' : 'offsuit';
  return `${SINGULAR[rankOf(high)]}-${SINGULAR[rankOf(low)]} ${suited}`;
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

function isRoyal(rank: HandRank): boolean {
  return categoryOf(rank) === HandCategory.StraightFlush && tiebreaks(rank)[0] === 14;
}

/** The name players know a hand by. A royal flush is only a straight flush to the engine. */
export function handName(rank: HandRank): string {
  return isRoyal(rank) ? ROYAL_FLUSH : CATEGORY_NAMES[categoryOf(rank)];
}

/** The description, marked so the whole phrase links to its glossary entry. */
export function describeHandMarked(rank: HandRank): string {
  const term = isRoyal(rank) ? 'royal-flush' : CATEGORY_TERMS[categoryOf(rank)];
  return `{${term}|${describeHand(rank)}}`;
}

/** Why one hand beats another that has the same short description, in words. */
export function firstDifference(winner: HandRank, loser: HandRank): string {
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
    // All five cards of a flush are part of the hand, so none of them is a kicker.
    const decider = categoryOf(winner) === HandCategory.Flush ? 'next highest card' : '{kicker}';
    return `${winnerName} and ${loserName} both have ${describeHandMarked(winner)}. The ${decider} decides it: ${firstDifference(winner, loser)}.`;
  }
  return `${winnerName} has ${describeHandMarked(winner)}, which beats ${describeHandMarked(loser)}.`;
}

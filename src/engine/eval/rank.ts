import { type Card, type Rank, rankOf, suitOf } from '@/engine/core/cards';

/** A comparable hand strength: a larger number is a better hand, equal numbers tie. */
export type HandRank = number;

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const;

export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

// Packs the category and up to five 4-bit tiebreak ranks, most significant first.
function encode(category: HandCategory, a = 0, b = 0, c = 0, d = 0, e = 0): HandRank {
  return (category << 20) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e;
}

export function categoryOf(rank: HandRank): HandCategory {
  return (rank >>> 20) as HandCategory;
}

const ACE_LOW_STRAIGHT = (1 << 14) | (1 << 5) | (1 << 4) | (1 << 3) | (1 << 2);

/** High card of the straight formed by five distinct ranks, or 0 if there is none. */
function straightHigh(rankMask: number): Rank {
  if (rankMask === ACE_LOW_STRAIGHT) return 5;
  const high = 31 - Math.clz32(rankMask);
  return rankMask === 0b11111 << (high - 4) ? high : 0;
}

// Reused between calls: this runs millions of times during equity calculation.
const counts = new Uint8Array(15);
const singles = new Uint8Array(5);

/** Ranks exactly five cards under standard high-hand rules. */
export function rankFive(hand: readonly Card[]): HandRank {
  counts.fill(0);
  let rankMask = 0;
  let isFlush = true;
  const firstSuit = suitOf(hand[0]);

  for (let i = 0; i < 5; i++) {
    const rank = rankOf(hand[i]);
    counts[rank]++;
    rankMask |= 1 << rank;
    if (suitOf(hand[i]) !== firstSuit) isFlush = false;
  }

  let four = 0;
  let three = 0;
  let highPair = 0;
  let lowPair = 0;
  let singleCount = 0;

  for (let rank = 14; rank >= 2; rank--) {
    const count = counts[rank];
    if (count === 1) singles[singleCount++] = rank;
    else if (count === 2) {
      if (highPair === 0) highPair = rank;
      else lowPair = rank;
    } else if (count === 3) three = rank;
    else if (count === 4) four = rank;
  }

  if (singleCount === 5) {
    const high = straightHigh(rankMask);
    if (isFlush && high > 0) return encode(HandCategory.StraightFlush, high);
    if (isFlush) {
      return encode(HandCategory.Flush, singles[0], singles[1], singles[2], singles[3], singles[4]);
    }
    if (high > 0) return encode(HandCategory.Straight, high);
    return encode(
      HandCategory.HighCard,
      singles[0],
      singles[1],
      singles[2],
      singles[3],
      singles[4],
    );
  }

  if (four > 0) return encode(HandCategory.FourOfAKind, four, singles[0]);
  if (three > 0 && highPair > 0) return encode(HandCategory.FullHouse, three, highPair);
  if (three > 0) return encode(HandCategory.ThreeOfAKind, three, singles[0], singles[1]);
  if (lowPair > 0) return encode(HandCategory.TwoPair, highPair, lowPair, singles[0]);
  return encode(HandCategory.Pair, highPair, singles[0], singles[1], singles[2]);
}

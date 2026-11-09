import {
  ALL_RANKS,
  ALL_SUITS,
  type Card,
  makeCard,
  type Rank,
  rankOf,
  type Suit,
} from '@/engine/core/cards';
import { shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import { categoryOf, HandCategory, rankFive } from '@/engine/eval/rank';

export interface GenContext {
  /** Words taught in earlier lessons. */
  knownTerms: readonly string[];
  /** Words taught in this lesson. */
  lessonTerms: readonly string[];
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[rng.nextInt(items.length)];
}

export const NAMES = ['Rook', 'Mags', 'Otto', 'Tilda', 'Wren', 'Dot', 'Fenn', 'Juno'];

/** Two different names. */
export function twoNames(rng: Rng): [string, string] {
  const [a, b] = shuffle(NAMES, rng);
  return [a, b];
}

/** Shuffled options containing the answer and up to `count - 1` distinct wrong answers. */
export function optionSet(
  correct: string,
  wrong: readonly string[],
  rng: Rng,
  count = 4,
): { options: string[]; answer: number } {
  const distinct = [...new Set(wrong)].filter((option) => option !== correct);
  const options = shuffle([correct, ...shuffle(distinct, rng).slice(0, count - 1)], rng);
  return { options, answer: options.indexOf(correct) };
}

function group(rank: Rank, count: number, rng: Rng): Card[] {
  return shuffle(ALL_SUITS, rng)
    .slice(0, count)
    .map((suit) => makeCard(rank, suit));
}

function straightRanks(rng: Rng): Rank[] {
  const high = 5 + rng.nextInt(10);
  return [high, high - 1, high - 2, high - 3, high - 4].map((rank) => (rank === 1 ? 14 : rank));
}

function suited(ranks: readonly Rank[], suit: Suit): Card[] {
  return ranks.map((rank) => makeCard(rank, suit));
}

function draft(category: HandCategory, rng: Rng): Card[] {
  const [a, b, c, d, e] = shuffle(ALL_RANKS, rng);
  const single = (rank: Rank) => group(rank, 1, rng);

  switch (category) {
    case HandCategory.HighCard:
      return [a, b, c, d, e].flatMap(single);
    case HandCategory.Pair:
      return [...group(a, 2, rng), ...[b, c, d].flatMap(single)];
    case HandCategory.TwoPair:
      return [...group(a, 2, rng), ...group(b, 2, rng), ...single(c)];
    case HandCategory.ThreeOfAKind:
      return [...group(a, 3, rng), ...[b, c].flatMap(single)];
    case HandCategory.Straight:
      return straightRanks(rng).flatMap(single);
    case HandCategory.Flush:
      return suited([a, b, c, d, e], pick(ALL_SUITS, rng));
    case HandCategory.FullHouse:
      return [...group(a, 3, rng), ...group(b, 2, rng)];
    case HandCategory.FourOfAKind:
      return [...group(a, 4, rng), ...single(b)];
    case HandCategory.StraightFlush:
      return suited(straightRanks(rng), pick(ALL_SUITS, rng));
  }
}

/** Matching cards together and the rest in order, so the pattern is easy to see. */
export function tidyHand(hand: readonly Card[]): Card[] {
  const counts = new Map<Rank, number>();
  for (const card of hand) counts.set(rankOf(card), (counts.get(rankOf(card)) ?? 0) + 1);
  const count = (card: Card) => counts.get(rankOf(card)) ?? 0;
  // In ace to five the ace plays low, so it belongs at the start of the run.
  const wheel = [14, 2, 3, 4, 5].every((rank) => counts.has(rank));
  const order = (card: Card) => (wheel && rankOf(card) === 14 ? 1 : rankOf(card));
  return [...hand].sort((a, b) => count(b) - count(a) || order(a) - order(b));
}

const MAX_BUILD_TRIES = 5000;

/** Builds five cards that make exactly `category`, avoiding `used`. Rare hands need no luck. */
export function buildHand(
  category: HandCategory,
  rng: Rng,
  used: ReadonlySet<Card> = new Set(),
): Card[] {
  for (let tries = 0; tries < MAX_BUILD_TRIES; tries++) {
    const hand = draft(category, rng);
    if (!hand.some((card) => used.has(card)) && categoryOf(rankFive(hand)) === category) {
      return shuffle(hand, rng);
    }
  }
  throw new Error(`Could not build a hand of category ${category}`);
}

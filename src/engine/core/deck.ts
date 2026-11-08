import {
  ALL_RANKS,
  ALL_SUITS,
  type Card,
  makeCard,
  type Rank,
  type Suit,
} from '@/engine/core/cards';
import type { Rng } from '@/engine/core/rng';

export interface DeckSpec {
  ranks: readonly Rank[];
  suits: readonly Suit[];
}

export const STANDARD_52: DeckSpec = { ranks: ALL_RANKS, suits: ALL_SUITS };

export function buildDeck(spec: DeckSpec): Card[] {
  return spec.ranks.flatMap((rank) => spec.suits.map((suit) => makeCard(rank, suit)));
}

/** Returns a shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
